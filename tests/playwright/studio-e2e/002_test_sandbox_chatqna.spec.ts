import { test, expect } from '@playwright/test';
import { waitForStatusText } from '../utils';
import path from 'path';

const sampleWorkflow = path.resolve(__dirname, '../../../sample-workflows/sample_workflow_chatqna.json');
const uploadPDF1 = path.resolve(__dirname, '../../test-files/Q3 24_EarningsRelease.pdf');
const uploadPDF2 = path.resolve(__dirname, '../../test-files/tennis_tutorial.pdf');

const question = "what is intel third-quarter 2024 revenue?";
const keyword = "$13.3 billion";

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
                            const cleanedData = line.slice(8, -1).trim(); // Remove 'data: ' prefix
                            apiResponse.value += cleanedData;
                        }
                    }
                }
            } else {
                console.error('Response is not SSE');
            }
        }
    });
}

test('002_test_sandbox_chatqna', async ({ page, baseURL }) => {
    test.setTimeout(600000);
    let apiResponse = { value: '' };
  
    const IDC_URL = baseURL || ""
    await page.goto(IDC_URL);
    await page.getByRole('button', { name: 'Create New Workflow' }).click();
    await page.getByRole('button', { name: 'Settings' }).click();
    let fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import Workflow' }).click();
    let fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(sampleWorkflow);
    await page.getByRole('button', { name: 'Save Workflow' }).click();
    await page.getByPlaceholder('My New Chatflow').click();
    await page.getByPlaceholder('My New Chatflow').fill('test_002');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.goto(IDC_URL);
    await expect(page.locator('td.MuiTableCell-root div.MuiStack-root p.MuiTypography-root').first()).toHaveText('Not Running', { timeout: 60000 });
    await page.getByLabel('a dense table').locator('button').first().click();
    await waitForStatusText(page, 'td.MuiTableCell-root div.MuiStack-root p.MuiTypography-root', 'Ready', 5, 60000);
    await page.waitForTimeout(8000);

    // Open APP-UI
    const page2Promise = page.waitForEvent('popup');
    await page.getByLabel('Click to open Application UI').getByRole('button').nth(0).click();
    const page2 = await page2Promise;
    await setupResponseListener(page2, apiResponse);

    // Here perform all the Upload Document + RAG
    // Chat Attempt 1
    await page2.waitForTimeout(2000);
    await page2.getByPlaceholder('Ask a question').fill(question);
    await page2.getByRole('button').nth(3).click();
    await page2.waitForTimeout(10000);
    let responseContainsKeyword = apiResponse && apiResponse.value.includes(keyword.replace(/\s+/g, ''));
    if (responseContainsKeyword) {
        throw new Error('LLM already has knowledge of this guide!')
    }
    apiResponse.value = "";

    // Document Upload 1
    await page2.getByRole('button').nth(2).click();
    await page2.getByRole('button').nth(2).click();
    fileChooserPromise = page2.waitForEvent('filechooser');
    await page2.getByRole('button', { name: 'Choose File' }).click()
    fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(uploadPDF1); // TBD: Update the path to the file
    await page2.getByRole('button', { name: 'Upload', exact: true }).click();
    await page2.waitForSelector('tr:nth-of-type(1) button[data-variant="light"] .tabler-icon-check', { state: 'visible', timeout: 300000 });
    // Refresh page and verify upload with retry 
    let isVisible = false;
    for (let i = 0; i < 2; i++) {
        await page2.reload();
        await page2.waitForTimeout(1500);
        await page2.getByRole('button').nth(2).click();
        try {
            await expect(page2.getByRole('cell', { name: 'Q3 24_EarningsRelease' })).toBeVisible({ timeout: 60000 });
            isVisible = true;
            break;
        } catch (error) {
            console.log(`Attempt ${i + 1} failed: ${error}`);
        }
    }

    // Document Upload 2
    fileChooserPromise = page2.waitForEvent('filechooser');
    await page2.getByRole('button', { name: 'Choose File' }).click()
    fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(uploadPDF2); // TBD Update the file path
    await page2.getByRole('button', { name: 'Upload', exact: true }).click();
    await page2.waitForSelector('tr:nth-of-type(2) button[data-variant="light"] .tabler-icon-check', { state: 'visible', timeout: 300000 });
    // Refresh page and verify upload with retry 
    isVisible = false;
    for (let i = 0; i < 2; i++) {
        await page2.reload();
        await page2.waitForTimeout(1500);
        await page2.getByRole('button').nth(2).click();
        try {
        await expect(page2.getByRole('cell', { name: 'tennis_tutorial.pdf' })).toBeVisible({ timeout: 60000 });
        isVisible = true;
        break;
        } catch (error) {
        console.log(`Attempt ${i + 1} failed: ${error}`);
        }
    }

    // Link Upload
    await page2.getByRole('button', { name: 'Use Link' }).click();
    await page2.getByPlaceholder('URL').click();
    await page2.getByPlaceholder('URL').fill('https://pnatraj.medium.com/kubectl-exec-plugin-invalid-apiversion-client-authentication-k8s-io-v1alpha1-870aace51998');
    await page2.getByRole('button', { name: 'Upload', exact: true }).click();
    await page2.waitForSelector('tr:nth-of-type(3) button[data-variant="light"] .tabler-icon-check', { state: 'visible', timeout: 300000 });
    // Refresh page and verify upload with retry 
    isVisible = false;
    for (let i = 0; i < 2; i++) {
        await page2.reload();
        await page2.waitForTimeout(1500);
        await page2.getByRole('button').nth(2).click();
        try {
        await expect(page2.getByRole('cell', { name: 'https://pnatraj.medium.com/' })).toBeVisible({ timeout: 60000 });
        isVisible = true;
        break;
        } catch (error) {
        console.log(`Attempt ${i + 1} failed: ${error}`);
        }
    }
    await page2.getByRole('banner').getByRole('button').click();

    // Chat Attempt 2
    await page2.getByPlaceholder('Ask a question').fill(question);
    await page2.getByRole('button').nth(3).click();
    await page2.waitForTimeout(10000);
    responseContainsKeyword = apiResponse && apiResponse.value.includes(keyword.replace(/\s+/g, ''));
    if (!responseContainsKeyword) {
        throw new Error('RAG failed')
    }

    // Delete 1 document + Check data sources successfully deduct 1 or not
    await page2.waitForTimeout(5000);
    await page2.getByRole('button').nth(3).click();
    await page2.getByRole('row', { name: 'tennis_tutorial.pdf' }).getByRole('button').click();
    await expect(page2.getByRole('cell', { name: 'tennis_tutorial.pdf' })).toBeHidden( { timeout: 60000 } );

    // Stop & Delete Sandbox
    await page.bringToFront();
    await page.locator('button:has([data-testid="StopCircleOutlinedIcon"])').first().click();
    await waitForStatusText(page, 'td.MuiTableCell-root div.MuiStack-root p.MuiTypography-root', 'Not Running', 5, 60000);
    await page.locator('#demo-customized-button').first().click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
  });