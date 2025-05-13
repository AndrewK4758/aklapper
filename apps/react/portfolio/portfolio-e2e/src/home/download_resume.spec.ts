import { expect, test } from '@playwright/test';

test.describe('Test download resume link', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });
  test('Test download resume', async ({ page }) => {
    const resumeDownProm = page.waitForEvent('download');

    const resumeButton = page.getByTestId('card-media-resume-button');

    await resumeButton.click();

    const resume = await resumeDownProm;

    expect(resume.suggestedFilename()).toEqual('andrew-klapper-resume.pdf');
  });
});
