import { randomUUID } from 'node:crypto';

import {
  gotoStreamedPage,
  trackPageErrors,
  waitForStreamedReveal,
} from '@aklapper/tooling/playwright';
import { expect, test } from '@playwright/test';

import {
  buildIsolatedTestIp,
  cleanupIsolatedAuthState,
  HAS_DATABASE_URL,
  seedIsolatedAdmin,
  sha256Hex,
} from './admin-helpers.js';

test.describe('admin per-route workspace keep-alive and sign-out boundary', () => {
  test('clears stale admin workspace sessionStorage keys when rendering /login without touching portal keys', async ({
    page,
  }) => {
    const getErrors = trackPageErrors(page);

    await page.addInitScript(() => {
      window.sessionStorage.setItem('aklapper.admin.workspace.v1:/ops', '{"stale":true}');
      window.sessionStorage.setItem('aklapper.portal.workspace.v1:/', '{"portal":true}');
    });

    await gotoStreamedPage(page, '/login', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /Admin Passkey Gate/i })).toBeVisible();

    const storageState = await page.evaluate(() => ({
      adminOps: window.sessionStorage.getItem('aklapper.admin.workspace.v1:/ops'),
      portalHome: window.sessionStorage.getItem('aklapper.portal.workspace.v1:/'),
    }));

    expect(storageState.adminOps).toBeNull();
    expect(storageState.portalHome).toBe('{"portal":true}');
    expect(getErrors()).toEqual([]);
  });

  test('persists independent admin route workspaces and purges all admin keys on Sign Out', async ({
    page,
  }, testInfo) => {
    test.skip(!HAS_DATABASE_URL, 'Requires DATABASE_URL for isolated admin credential seeding');
    test.skip(
      testInfo.project.name === 'mobile-chrome',
      'Desktop per-route keep-alive workspace journey; handheld journeys are covered in mobile-layout.spec.ts',
    );

    const getErrors = trackPageErrors(page);
    const projectName = testInfo.project.name;
    const handle = `e2e-ka-${projectName}-${Date.now()}-${randomUUID().slice(0, 6)}`.toLowerCase();
    const password = `E2ePass-${randomUUID()}`;
    const testIp = buildIsolatedTestIp(projectName, 6 + (testInfo.retry % 5));
    const rateKeys = [
      `auth:login:ip:${sha256Hex(testIp)}`,
      `auth:login:handle:${sha256Hex(handle)}`,
      `auth:totp:ip:${sha256Hex(testIp)}`,
    ];

    await seedIsolatedAdmin(handle, password);
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': testIp });

    try {
      await gotoStreamedPage(page, '/login', { waitUntil: 'networkidle' });
      await page.getByLabel('Admin Handle', { exact: true }).fill(handle);
      await page.getByLabel('Password', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Sign in with Password' }).click();

      const continueBtn = page.getByRole('button', {
        name: /Skip for now|Continue to Console|Continue/i,
      });
      await expect(continueBtn).toBeVisible();
      await continueBtn.click();
      await waitForStreamedReveal(page);

      // Navigate to /analytics and open a second tab
      await page.locator('header').getByRole('link', { name: 'Analytics', exact: true }).click();
      await expect(page).toHaveURL(/\/analytics$/);
      const analyticsLayer = page.locator('[data-route-workspace="/analytics"]');
      await expect(analyticsLayer).toHaveAttribute('data-route-active', 'true');
      await page.keyboard.press('Alt+Shift+N');
      await expect(analyticsLayer.locator('[data-tab-count="2"]')).toBeVisible();

      // Navigate to /cms — starts with 1 tab independently
      await page.locator('header').getByRole('link', { name: 'CMS', exact: true }).click();
      await expect(page).toHaveURL(/\/cms$/);
      const cmsLayer = page.locator('[data-route-workspace="/cms"]');
      await expect(cmsLayer).toHaveAttribute('data-route-active', 'true');
      await expect(cmsLayer.locator('[data-tab-count="1"]')).toBeVisible();

      // Sign Out — purges all aklapper.admin.workspace.* keys and redirects to /login
      await page.getByRole('button', { name: 'Sign Out' }).click();
      await expect(page).toHaveURL(/\/login$/);

      const remainingAdminKeys = await page.evaluate(() => {
        const keys: string[] = [];
        for (let i = 0; i < window.sessionStorage.length; i += 1) {
          const key = window.sessionStorage.key(i);
          if (key?.startsWith('aklapper.admin.workspace.')) {
            keys.push(key);
          }
        }
        return keys;
      });
      expect(remainingAdminKeys).toEqual([]);
      expect(getErrors()).toEqual([]);
    } finally {
      await cleanupIsolatedAuthState([handle], rateKeys);
    }
  });
});
