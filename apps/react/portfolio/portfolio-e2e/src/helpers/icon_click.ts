import { expect, type Page } from '@playwright/test';

export default async function testIconClick(testId: string, href: string, page: Page): Promise<string> {
  const linkIcon = page.getByTestId(testId);

  await expect(linkIcon).toHaveAttribute('href', href);

  const pagePromise = page.waitForEvent('popup');

  await page.getByTestId(testId).click();

  const resolvedPagePromise = await pagePromise;

  return resolvedPagePromise.url();
}
