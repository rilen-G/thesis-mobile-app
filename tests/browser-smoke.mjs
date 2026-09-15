import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const base=process.env.UI_TEST_URL??'http://localhost:8083';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:120000});
 await page.getByText('Welcome back',{exact:true}).waitFor({timeout:30000});
 const setupRequired=await page.getByText(/Backend setup required/).count()>0;
 assert.equal(await page.getByRole('button',{name:'Sign In',exact:true}).isDisabled(),setupRequired);
 await page.getByRole('button',{name:'Go to Sign Up',exact:true}).click();
 await page.getByText('Create staff access',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Back to Login',exact:true}).click();
 await page.getByRole('button',{name:'Forgot password',exact:true}).click();
 await page.getByText('Recover account',{exact:true}).waitFor();
 await page.goto(`${base}/recovery?code=test-expired-link`,{waitUntil:'domcontentloaded'});
 await page.getByText('Account recovery',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Back to sign in',exact:true}).click();
 await page.getByText('Welcome back',{exact:true}).waitFor();
 await page.goto(`${base}/orders`,{waitUntil:'domcontentloaded'});
 await page.getByText('Welcome back',{exact:true}).waitFor();
 await mkdir('.test-artifacts',{recursive:true});await page.screenshot({path:'.test-artifacts/sign-in.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Browser checks passed: setup state, signup/recovery navigation, protected routes, no runtime errors.');
}finally{await browser.close();}


