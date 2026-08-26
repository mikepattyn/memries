import { expect } from '@playwright/test';
import { Given, When, openTab, signIn } from './fixtures';

Given('I am on the {string} tab', async ({ page }, tab: string) => {
  await signIn(page);
  await openTab(page, tab);
});

When('I open the {string} tab', async ({ page }, tab: string) => {
  await openTab(page, tab);
});

When('I reload the page', async ({ page }) => {
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your memries' })).toBeVisible({ timeout: 120_000 });
});
