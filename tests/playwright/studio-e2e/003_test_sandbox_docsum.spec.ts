import { test, expect } from '@playwright/test';
import { waitForStatusText } from '../utils';
import path from 'path';

const sampleWorkflow = path.resolve(__dirname, '../../../sample-workflows/sample_workflow_docsum.json');//this workflow consists of Hugging Face token! cannot deploy as off now.
const uploadtxt1 = path.resolve(__dirname, '../../test-files/Little Red Riding Hood.txt');

const keywords = ["Little Red Riding Hood", "sick grandmother", "wolf", "woodcutter", "hunter", "closet", "food"]; // more keywords needed

function containsAnyKeyword(response: string, keywords: string[]): boolean {
    return keywords.some((keyword) => response.includes(keyword.replace(/\s+/g, '')));
}

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

test('003_test_sandbox_docsum', async ({ browser, baseURL }) => {
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
    await page.getByRole('button', { name: 'Create New Workflow' }).click();
    await page.getByRole('button', { name: 'Settings' }).click();
    let fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import Workflow' }).click();
    let fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(sampleWorkflow);
    await page.getByRole('button', { name: 'Save Workflow' }).click();
    await page.getByPlaceholder('My New Chatflow').click();
    await page.getByPlaceholder('My New Chatflow').fill('test_003');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.goto(IDC_URL);
    await expect(page.locator('td.MuiTableCell-root div.MuiStack-root p.MuiTypography-root').first()).toHaveText('Not Running', { timeout: 60000 });
    await page.getByLabel('a dense table').locator('button').first().click();
    await waitForStatusText(page, 'td.MuiTableCell-root div.MuiStack-root p.MuiTypography-root', 'Getting Ready', 20, 60000);
    await page.waitForTimeout(10000);

//Open APP-UI
    const page2Promise = page.waitForEvent('popup', { context });
    await page.getByLabel('Click to open Application UI').getByRole('button').nth(0).click();
    const page2 = await page2Promise;
    await page2.bringToFront();
    await setupResponseListener(page2, apiResponse);

//Entering DocSum    
    //await page2.waitForTimeout(2000);
    await page2.getByRole('button', { name: 'Summarize Content' }).click();

//Upload the Story File
    fileChooserPromise = page2.waitForEvent('filechooser');
    await page2.getByRole('button', { name: 'Browse Files' }).click();
    fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(uploadtxt1);
    await page2.getByRole('button', { name: 'Summarize', exact: true }).click();


//Summarization Generation and Response Validation
    await page2.waitForTimeout(60000); 
    let responseContainsKeyword = apiResponse && containsAnyKeyword(apiResponse.value, keywords);
    console.log ('response:', apiResponse.value);
    await page2.screenshot({ path: 'screenshot_docsum_attempt1.png' });

    if (!responseContainsKeyword) {
        throw Error('Incorrect summarization!')
    }
    apiResponse.value = "";
    

//Stop & Delete Sandbox
    console.log ('Stop & Delete Sandbox-------------------');
    await page.bringToFront();
    await page.locator('button:has([data-testid="StopCircleOutlinedIcon"])').first().click();
    await waitForStatusText(page, 'td.MuiTableCell-root div.MuiStack-root p.MuiTypography-root', 'Not Running', 5, 60000);
    await page.locator('#demo-customized-button').first().click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await page2.close();
    await page.close();
    await context.close();
    console.log('Job done');
  });