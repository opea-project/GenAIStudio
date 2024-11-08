 ## Getting Started
 ### To run Playwright

Install npm dependencies:
```
# Install package.json npm packages
npm install
# Install playwright dependencies
npx playwright install-deps
```

Find baseURL variable in playwright.config.js and update it to point to your frontend application:
```
# Eg
baseURL: 'http://127.0.0.1:3000',
```

Run the testcases:
```
# Run all testcase
npx playwright test
# Run specific testcase
npx playwright test studio-e2e/<testcase>.spec.ts
```

Open the test report:
```
npx playwright show-report
```

### VSCode setup

Install the 'Playwright Test for VSCode' extension from the Extensions tab in VSCode.

Once installed, open the Settings (Ctrl+,) and search for playwright. Go to Extensions > Playwright > Playwright: Env > Edit in settings.json.

Assuming your vscode is opening GenAIStudio folder, add below in settings.json:
```
"playwright.env": {
    "NODE_PATH": "${workspaceFolder}/tests/playwright/node_modules"
}
```

Open the Testing tab in VSCode. You should be able to see the tests. If not try to click 'Refresh Tests' button (Ctrl+; Ctrl+R).