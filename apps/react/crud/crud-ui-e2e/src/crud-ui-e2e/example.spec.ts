import { expect, test } from '@playwright/test';

const homeTitleText = 'Media Data Manager';
const addArtistTextInputValue = 'New Test Artist';
const addArtistAffirmativeBlurValue = 'Artist Not in List';
const addArtistNegativeBlurValue = 'Artist Already Exists';
const addArtistAlreadyInDB = 'AC/DC';

test.describe('Crud-UI e2e Test', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  });

  test.describe('Layout Route', () => {
    test('Has title on initial page load', async ({ page }) => {
      const titleText = page.getByTestId('home-page-title');

      expect(await titleText.textContent()).toMatch(homeTitleText);
    });
  });
  test.describe('Artists path', () => {
    test.beforeEach(async ({ page }) => {
      const artistsButton = page.locator('#artists-button');
      await artistsButton.click();
    });
    test('Navigates to All Artists', async ({ page }) => {
      expect(await page.locator('#artists-label').textContent()).toEqual('Artist List');
    });
    test('Test Add Artist input element', async ({ page }) => {
      const addArtistInput = page.locator('#add-artist-input');

      await addArtistInput.fill(addArtistTextInputValue);

      expect(await addArtistInput.inputValue()).toEqual(addArtistTextInputValue);

      await page.keyboard.press('Tab');

      const addArtistBlurValue = page.locator('#add-artist-blur-value');

      expect(await addArtistBlurValue.textContent()).toEqual(addArtistAffirmativeBlurValue);
    });
    test('Test Add Artist negative blur', async ({ page }) => {
      const artistsButton = page.locator('#artists-button');

      await artistsButton.click();

      await page.waitForURL('**/artists');

      const addArtistInput = page.locator('#add-artist-input');

      await addArtistInput.fill(addArtistAlreadyInDB);

      await page.keyboard.press('Tab');

      const addArtistBlurValue = page.locator('#add-artist-blur-value');

      expect(await addArtistBlurValue.textContent()).toEqual(addArtistNegativeBlurValue);
    });
  });
});
