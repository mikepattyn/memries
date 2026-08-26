import { expect } from '@playwright/test';
import { Given, Then, signIn } from './fixtures';

Given('I am signed in', async ({ page }) => {
  await signIn(page);
});

Then('I should see my memories', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Your memries' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Open (favorited )?photo/ }).first()).toBeVisible();
});
