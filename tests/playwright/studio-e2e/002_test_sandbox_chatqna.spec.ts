import { test, expect } from '@playwright/test';
import { waitForStatusText } from '../utils';
import path from 'path';

const sampleWorkflow = path.resolve(__dirname, '../../../sample-workflows/sample_workflow_chatqna.json');
const uploadPDF1 = path.resolve(__dirname, '../../test-files/tennis_tutorial.pdf');
const uploadPDF2 = path.resolve(__dirname, '../../test-files/Q3 24_EarningsRelease.pdf');

const question = "what is intel third-quarter 2024 revenue?";
const keywords = ["billion", "13.3", "$13.3-14.3", "above the midpoint", "guidance"]; // more keywords needed

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

test('002_test_sandbox_chatqna', async ({ browser, baseURL }) => {
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
    await page.getByPlaceholder('My New Chatflow').fill('test_002');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.goto(IDC_URL);
    await expect(page.locator('td.MuiTableCell-root div.MuiStack-root p.MuiTypography-root').first()).toHaveText('Not Running', { timeout: 60000 });
    await page.getByLabel('a dense table').locator('button').first().click();
    await waitForStatusText(page, 'td.MuiTableCell-root div.MuiStack-root p.MuiTypography-root', 'Ready', 20, 60000);
    await page.waitForTimeout(10000);

    // Open APP-UI
    const page2Promise = page.waitForEvent('popup', { context });
    await page.getByLabel('Click to open Application UI').getByRole('button').nth(0).click();
    const page2 = await page2Promise;
    await page2.bringToFront();
    await setupResponseListener(page2, apiResponse);

    // Here perform all the Upload Document + RAG
    // Chat Attempt 1
    // const buttons = page2.getByRole('button');
    // const buttonCount = await buttons.count();
    // console.log(`Found ${buttonCount} buttons:`);
    // for (let i = 0; i < buttonCount; i++) {
    //     const button = buttons.nth(i);
    //     const text = await button.textContent();
    //     const box = await button.boundingBox();
    //     if (box) {
    //         console.log(`Button ${i}: Text="${text}", Location: x=${box.x}, y=${box.y}, width=${box.width}, height=${box.height}`);
    //     } else {
    //         console.log(`Button ${i}: Text="${text}", Location: Not visible or no bounding box`);
    //     }
    // }
    await page2.waitForTimeout(2000);
    await page2.getByPlaceholder('Ask a question').fill(question);
    await page2.getByRole('button').nth(4).click();
    await page2.waitForTimeout(20000);
    let responseContainsKeyword = apiResponse && containsAnyKeyword(apiResponse.value, keywords);
    console.log ('response:', apiResponse.value);
    await page2.screenshot({ path: 'screenshot_chat_attempt1.png' });

    if (responseContainsKeyword) {
        throw new Error('LLM already has knowledge of this guide!')
    }
    apiResponse.value = "";

    await page2.getByRole('button').nth(2).click();
    await page2.getByRole('button').nth(2).click(); // Double click

    // Document Upload 1
    fileChooserPromise = page2.waitForEvent('filechooser');
    await page2.getByRole('button', { name: 'Choose File' }).click()
    fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(uploadPDF1);
    await page2.getByRole('button', { name: 'Upload', exact: true }).click();
    await page2.waitForSelector('tr:nth-of-type(1) button[data-variant="light"] .tabler-icon-check', { state: 'visible', timeout: 300000 });
    // Refresh page and verify upload with retry 
    let isVisible1 = false;
    for (let i = 0; i < 2; i++) {
        await page2.reload();
        await page2.waitForTimeout(1500);
        await page2.getByRole('button').nth(2).click();
        try {
            await expect(page2.getByRole('cell', { name: 'tennis_tutorial.pdf' })).toBeVisible({ timeout: 60000 });
            isVisible1 = true;
            break;
        } catch (error) {
            console.log(`Attempt ${i + 1} failed: ${error}`);
        }
    }
    await page2.waitForTimeout(1000);
    
    // Document Upload 2
    fileChooserPromise = page2.waitForEvent('filechooser');
    await page2.getByRole('button', { name: 'Choose File' }).click()
    fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(uploadPDF2);
    await page2.getByRole('button', { name: 'Upload', exact: true }).click();
    await page2.waitForSelector('tr:nth-of-type(2) button[data-variant="light"] .tabler-icon-check', { state: 'visible', timeout: 300000 });
    // Refresh page and verify upload with retry 
    let isVisible2 = false;
    for (let i = 0; i < 2; i++) {
        await page2.reload();
        await page2.waitForTimeout(1500);
        await page2.getByRole('button').nth(2).click();
        try {
            await expect(page2.getByRole('cell', { name: 'Q3 24_EarningsRelease' })).toBeVisible({ timeout: 60000 });
            isVisible2 = true;
            break;
        } catch (error) {
            console.log(`Attempt ${i + 1} failed: ${error}`);
        }
    }
    await page2.waitForTimeout(1000);

    // Link Upload
    await page2.getByRole('button', { name: 'Use Link' }).click();
    await page2.getByPlaceholder('URL').click();
    await page2.getByPlaceholder('URL').fill('https://pnatraj.medium.com/kubectl-exec-plugin-invalid-apiversion-client-authentication-k8s-io-v1alpha1-870aace51998');
    await page2.getByRole('button', { name: 'Upload', exact: true }).click();
    await page2.waitForSelector('tr:nth-of-type(3) button[data-variant="light"] .tabler-icon-check', { state: 'visible', timeout: 300000 });
    // Refresh page and verify upload with retry 
    let isVisible3 = false;
    for (let i = 0; i < 2; i++) {
        await page2.reload();
        await page2.waitForTimeout(1500);
        await page2.getByRole('button').nth(2).click();
        try {
            await expect(page2.getByRole('cell', { name: 'https://pnatraj.medium.com/' })).toBeVisible({ timeout: 60000 });
            await page2.screenshot({ path: 'screenshot_upload_document.png' });

            isVisible3 = true;
        break;
        } catch (error) {
            console.log(`Attempt ${i + 1} failed: ${error}`);
        }
    }
    await page2.waitForTimeout(1000);

    await page2.getByRole('banner').getByRole('button').click();
    await page2.waitForTimeout(10000);

    // Chat Attempt 2
    // const buttons = page2.getByRole('button');
    // const buttonCount = await buttons.count();
    // console.log(`Found ${buttonCount} buttons:`);
    // for (let i = 0; i < buttonCount; i++) {
    //     const button = buttons.nth(i);
    //     const text = await button.textContent();
    //     const box = await button.boundingBox();
    //     if (box) {
    //         console.log(`Button ${i}: Text="${text}", Location: x=${box.x}, y=${box.y}, width=${box.width}, height=${box.height}`);
    //     } else {
    //         console.log(`Button ${i}: Text="${text}", Location: Not visible or no bounding box`);
    //     }
    // }
    console.log ('Chat Attempt 2-------------------');
    await page2.getByPlaceholder('Ask a question').fill(question);
    await page2.getByRole('button').nth(4).click();
    await page2.waitForTimeout(30000);
    responseContainsKeyword = apiResponse && containsAnyKeyword(apiResponse.value, keywords);
    console.log ('response:', apiResponse.value);
    console.log ("responseContainsKeyword:", responseContainsKeyword);

    if (!responseContainsKeyword) {
        console.log('First attempt failed. Asking a follow-up question...');
        apiResponse.value = ""; // Clear the response listener buffer
    
        // Ask another question
        const followUpQuestion = "How is Intel performing in Q3 2024?";
        await page2.getByPlaceholder('Ask a question').fill(followUpQuestion);
        await page2.getByRole('button').nth(4).click();
        await page2.waitForTimeout(30000);
    
        responseContainsKeyword = apiResponse && containsAnyKeyword(apiResponse.value, keywords);
        console.log ('response:', apiResponse.value);
        console.log ("responseContainsKeyword:", responseContainsKeyword);

        if (!responseContainsKeyword) {
            throw new Error('RAG failed after follow-up question');
        }
    }
    await page2.screenshot({ path: 'screenshot_chat_attempt2.png' });

    // Delete 1 document + Check data sources successfully deduct 1 or not
    await page2.waitForTimeout(3000);
        const buttons = page2.getByRole('button');
    const buttonCount = await buttons.count();
    console.log(`Found ${buttonCount} buttons:`);
    for (let i = 0; i < buttonCount; i++) {
        const button = buttons.nth(i);
        const text = await button.textContent();
        const box = await button.boundingBox();
        if (box) {
            console.log(`Button ${i}: Text="${text}", Location: x=${box.x}, y=${box.y}, width=${box.width}, height=${box.height}`);
        } else {
            console.log(`Button ${i}: Text="${text}", Location: Not visible or no bounding box`);
        }
    }
    console.log ('Delete 1 document + Check data sources successfully deduct 1 or not-------------------');

    await page2.getByRole('button').nth(3).click();
    await page2.getByRole('row', { name: 'tennis_tutorial.pdf' }).getByRole('button').click();
    await expect(page2.getByRole('cell', { name: 'tennis_tutorial.pdf' })).toBeHidden( { timeout: 60000 } );
    await page2.screenshot({ path: 'screenshot_delete_file.png' });
    console.log ("Document tennis_tutorial.pdf deleted");

    // Stop & Delete Sandbox
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