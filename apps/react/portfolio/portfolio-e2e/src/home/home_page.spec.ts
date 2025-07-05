import { expect, test } from '@playwright/test';
import testIconClick from '../helpers/icon_click.js';

const homeH1Title = "Hi, I'm Andrew Klapper";

test.beforeEach(async ({ page }) => {
  await page.goto('/portfolio');
});

test.describe('Test Layout & Contact Links', () => {
  test('Renders Menus when clicked', async ({ page }) => {
    await expect(page.getByTestId('home-button')).toBeVisible();
    await expect(page.getByTestId('games-button')).toBeVisible();
    await expect(page.getByTestId('crud-button')).toBeVisible();
    await expect(page.getByTestId('gen-ai-button')).toBeVisible();
  });

  test('has title & intro text', async ({ page }) => {
    expect(await page.locator('h1').innerText()).toContain(homeH1Title);
    expect(page.getByTestId('intro-text')).toBeVisible();

    const homePagePic = page.locator('img');

    expect(homePagePic).toBeVisible();
    expect(await homePagePic.getAttribute('src')).toEqual('/images/self.webp');
  });
});

//------------Seperate-------------//
test.describe('Test Header links & Email / Appointment Maker', () => {
  test.beforeEach(async ({ page }) => {
    const contactDrawer = page.locator('div[data-testid="contact-menu-draw"]');

    await page.getByTestId('contact-menu-button').click();

    await contactDrawer.waitFor({ state: 'visible' });
  });

  test.describe('Test the contact button opens the the side menu, exposes the links, and links work', () => {
    test('Github Link', async ({ page }) => {
      const testId = 'github-icon';
      const href = 'https://github.com/AndrewK4758/aklapper';

      const gitubPageUrl = await testIconClick(testId, href, page);

      expect(gitubPageUrl).toEqual(href);
    });

    test('Facebook Link', async ({ page }) => {
      const testId = 'facebook-icon';
      const href = 'https://www.facebook.com/AKlapper47';

      const facebookPageUrl = await testIconClick(testId, href, page);

      expect(facebookPageUrl).toEqual(href);
    });

    test('LinkedIn Link', async ({ page }) => {
      const testId = 'linkedin-icon';
      const href = 'https://www.linkedin.com/in/andrew-klapper-a9204b23b/';

      const linkedinPageUrl = await testIconClick(testId, href, page);

      expect(linkedinPageUrl).toEqual(href);
    });

    test('HuggingFace Link', async ({ page }) => {
      const testId = 'hugging-face-icon';
      const href = 'https://huggingface.co/ak475826';

      const huggingfacePageUrl = await testIconClick(testId, href, page);

      expect(huggingfacePageUrl).toEqual(href);
    });

    test('X Link', async ({ page }) => {
      const testId = 'x-icon';
      const href = 'https://x.com/ak475826';

      const xPageUrl = await testIconClick(testId, href, page);

      expect(xPageUrl).toEqual(href);
    });
  });

  test('Email Dialog', async ({ page }) => {
    await page.getByTestId('email-icon').click();
    await expect(page.getByTestId('email-dialog')).toBeVisible();
  });
});
