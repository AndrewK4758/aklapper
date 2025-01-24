import { test, expect } from '@playwright/test';

const homeH1Title = "Hi, I'm Andrew Klapper";

test.describe('Test Layout & HomePage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Renders Menus when clicked', async ({ page }) => {
    await expect(page.getByTestId('home-button')).toBeVisible();
    await expect(page.getByTestId('games-button')).toBeVisible();
    await expect(page.getByTestId('crud-button')).toBeVisible();
    await expect(page.getByTestId('gen-ai-button')).toBeVisible();
    await expect(page.getByTestId('contact-menu-button')).toBeVisible();
  });

  test('has title', async ({ page }) => {
    expect(await page.locator('h1').innerText()).toContain(homeH1Title);
  });
});

test.describe('Test Header links & Email / Appointment Maker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('contact-menu-button').click();
  });

  test.afterEach(async ({ page }) => {
    await page.reload();
  });

  test('Github Link', async ({ page }) => {
    await expect(page.getByTestId('github-icon')).toHaveAttribute('href', 'https://github.com/AndrewK4758/aklapper');

    const githubPagePromise = page.waitForEvent('popup');

    await page.getByTestId('github-icon').click();

    const githubPage = await githubPagePromise;

    expect(githubPage.url()).toEqual('https://github.com/AndrewK4758/aklapper');
  });

  test('Facebook Link', async ({ page }) => {
    await expect(page.getByTestId('facebook-icon')).toHaveAttribute('href', 'https://www.facebook.com/AKlapper47');

    const facebookPagePromise = page.waitForEvent('popup');

    await page.getByTestId('facebook-icon').click();

    const facebookPage = await facebookPagePromise;

    expect(facebookPage.url()).toEqual('https://www.facebook.com/AKlapper47');
  });

  test('LinkedIn Link', async ({ page }) => {
    await expect(page.getByTestId('linkedin-icon')).toHaveAttribute(
      'href',
      'https://www.linkedin.com/in/andrew-klapper-a9204b23b/'
    );

    const linkedinPagePromise = page.waitForEvent('popup');

    await page.getByTestId('linkedin-icon').click();

    const linkedinPage = await linkedinPagePromise;

    expect(linkedinPage.url()).toEqual('https://www.linkedin.com/in/andrew-klapper-a9204b23b/');
  });

  test('HuggingFace Link', async ({ page }) => {
    await expect(page.getByTestId('hugging-face-icon')).toHaveAttribute('href', 'https://huggingface.co/ak475826');

    const huggingfacePromise = page.waitForEvent('popup');

    await page.getByTestId('hugging-face-icon').click();

    const huggingfacePage = await huggingfacePromise;

    expect(huggingfacePage.url()).toEqual('https://huggingface.co/ak475826');
  });

  test('X Link', async ({ page }) => {
    await expect(page.getByTestId('x-icon')).toHaveAttribute('href', 'https://x.com/ak475826');

    const xPagePromise = page.waitForEvent('popup');

    await page.getByTestId('x-icon').click();

    const xPage = await xPagePromise;

    expect(xPage.url()).toEqual('https://x.com/ak475826');
  });

  test('Email Dialog', async ({ page }) => {
    await page.getByTestId('email-icon').click();
    await expect(page.getByTestId('email-dialog')).toBeVisible();
  });
});
