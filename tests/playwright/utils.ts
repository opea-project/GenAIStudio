import { expect } from '@playwright/test';

export async function waitForStatusText(page: any, selector: string, statusText: string, maxAttempts: number = 10, intervalTimeout: number = 60000) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const text = await page.locator(selector).first().innerText();
            if (text === 'Error' || text === 'failed') {
                throw new Error(`Encountered unwanted status text "Error" in element "${selector}"`);
            }
            await expect(page.locator(selector).first()).toHaveText(statusText, { timeout: intervalTimeout });
            return;
        } catch (error) {
            console.log(`Attempt ${i + 1} failed: ${error}`);
        }
    }
    throw new Error(`Failed to find text "${statusText}" in element "${selector}" after ${maxAttempts} attempts`);
}