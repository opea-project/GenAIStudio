import { test, expect } from '@playwright/test';
import { waitForStatusText } from '../utils';
import fs from 'fs';
import path from 'path';
import os from 'os';

test('001_test_sandbox_deployment', async ({ browser, baseURL }) => {
    test.setTimeout(1200000);
    const context = await browser.newContext({
        ignoreHTTPSErrors: true
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
    const filePath = path.resolve(__dirname, '../../../sample-workflows/basic_llm_workflow.json');
    await fileChooser.setFiles(filePath);
    await page.getByRole('button', { name: 'Save Workflow' }).click();
    await page.getByPlaceholder('My New Chatflow').click();
    await page.getByPlaceholder('My New Chatflow').fill('test_001');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.goto(IDC_URL);
    await expect(page.locator('td.MuiTableCell-root div.MuiStack-root p.MuiTypography-root').first()).toHaveText('Not Running', { timeout: 60000 });
    await page.getByLabel('a dense table').locator('button').first().click();
    // for (let i = 0; i < 5; i++) {
    //     try {
    //         await expect(page.locator('td.MuiTableCell-root div.MuiStack-root p.MuiTypography-root').first()).toHaveText('Ready', { timeout: 60000 });
    //         break;
    //     } catch (error) {
    //         console.log(`Attempt ${i + 1} failed: ${error}`);
    //     }
    // }
    await waitForStatusText(page, 'td.MuiTableCell-root div.MuiStack-root p.MuiTypography-root', 'Getting Ready', 10, 60000);
    await page.waitForTimeout(8000);

    // Open APP-UI
    const page2Promise = page.waitForEvent('popup');
    await page.getByLabel('Click to open Application UI').getByRole('button').nth(0).click();
    const page2 = await page2Promise;
    await expect(page2.getByRole('heading', { name: 'OPEA Studio' })).toBeVisible();
    await page.bringToFront();

    // Open Dashboard - update the locator for V1.4
    await page.getByRole('cell', { name: 'Observability Options' }).getByRole('button').click();
    const page3Promise = page.waitForEvent('popup');
    await page.getByRole('menuitem', { name: 'Monitoring Dashboard' }).click();
    const page3 = await page3Promise;
    await expect(page3.getByRole('link', { name: 'Grafana' })).toBeVisible({ timeout: 60000 });
    await page.bringToFront();

    // Open Trace - new for V1.4
    await page.getByRole('cell', { name: 'Observability Options' }).getByRole('button').click();
    const page4Promise = page.waitForEvent('popup');
    await page.getByRole('menuitem', { name: 'LLM Call Traces' }).click();
    const page4 = await page4Promise;
    await expect(page4.getByText('No traces found')).toHaveText(/No traces found/, { timeout: 60000 });
    await page.bringToFront();

    // Open Debug Logs - new for V1.4
    await page.getByRole('cell', { name: 'Observability Options' }).getByRole('button').click();
    const page5Promise = page.waitForEvent('popup');
    await page.getByRole('menuitem', { name: 'Debug Logs' }).click();
    const page5 = await page5Promise;
    await expect(page5.getByRole('heading', { name: 'Workflow name: test_001' })).toHaveText(/Workflow name: test_001/, { timeout: 60000 });
    await page.bringToFront();

    // Generate Deployment Package - to be deleted
        //await page.getByLabel('Generate Deployment Package').getByRole('button').nth(0).click();
        //const downloadPromise = page.waitForEvent('download');
        //await page.getByRole('button', { name: 'Export Package' }).click();
        //const download = await downloadPromise;
        //const downloadDir = path.join(os.homedir(), 'Downloads');
        //const downloadPath = path.resolve(downloadDir, 'deployment_package_downloaded.json');
        //await download.saveAs(downloadPath);
        //expect(fs.existsSync(downloadPath)).toBe(true);
    
    // Stop & Delete Sandbox
    await page.getByRole('button', { name: 'Stop Sandbox' }).click();
    // await expect(page.locator('td.MuiTableCell-root div.MuiStack-root p.MuiTypography-root').first()).toHaveText('Not Running', { timeout: statusChangeTimeout });
    await waitForStatusText(page, 'td.MuiTableCell-root div.MuiStack-root p.MuiTypography-root', 'Not Running', 5, 60000);
    await page.locator('#demo-customized-button').click();
    
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    });