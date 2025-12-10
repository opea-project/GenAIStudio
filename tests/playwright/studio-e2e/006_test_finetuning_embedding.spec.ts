import { test, expect } from '@playwright/test';
import { waitForStatusText } from '../utils';
import path from 'path';

const trainDataset = path.resolve(__dirname, '../../test-files/toy_finetune_data.jsonl');

async function setupResponseListener(page, apiResponse) {
    page.on('response', async (response) => {
        if (response.url().includes('/v1/app-backend') && response.request().method() === 'POST') {
            const contentType = response.headers()['content-type'];
            if (contentType.includes('text/event-stream')) {
                const responseBody = await response.text();
                // Parse SSE stream
                const events = responseBody.split('\n\n');
                for (const event of events) {
                    const lines = event.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const cleanedData = line.slice(6, -1).trim(); // Remove 'data: ' prefix
                            apiResponse.value += cleanedData + " ";
                        }
                    }
                }
            } else {
                console.error('Response is not SSE');
            }
        }
    });
}

test('006_test_finetuning_embedding', async ({ browser, baseURL }) => {
    test.setTimeout(1200000);
    let apiResponse = { value: '' };
    const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        recordVideo: {
            dir: './videos/',
            size: { width: 1280, height: 720 }
        }
    });
    const page = await context.newPage();
    const IDC_URL = baseURL || ""
    await page.goto(IDC_URL);
    await page.getByLabel('Username or email').fill('test_automation@gmail.com');
    await page.getByLabel('Password', { exact: true }).click();
    await page.getByLabel('Password', { exact: true }).fill('test');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.getByRole('button', { name: 'Fine-tuning' }).click();
    await page.getByRole('button', { name: 'Create New Job' }).click();
    await page.getByRole('combobox', { name: 'Base Model' }).click();
    await page.getByRole('option', { name: 'BAAI/bge-base-en-v1.5' }).click();
    await page.getByText('Instruction Tuning').click();
    await page.getByRole('option', { name: 'Embedding' }).click();
    let fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose File' }).click();
    let fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(trainDataset);
    await page.waitForTimeout(5000);
    await page.getByRole('button', { name: 'Create Job' }).click();
    await page.waitForTimeout(20000);
    await expect(page.getByRole('cell', { name: 'running' })).toHaveText('running');
    await expect(page.locator('div').filter({ hasText: 'Fine-tuning JobsCreate New' }).nth(3)).toContainText('embedding');
    await waitForStatusText(page, 'td.MuiTableCell-root div.MuiChip-root', 'succeeded', 20, 60000);

    await page.locator('button').nth(5).click();
    await page.getByRole('menuitem', { name: 'Delete Job' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
});