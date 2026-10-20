import { chromium } from "playwright-core";
const EXE = "C:/Users/Shubh/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe";
const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
// Simulate the Android bridge so the native-only UI renders.
await page.addInitScript(() => {
  window.AndroidBridge = { hasNativeAuth: () => true, signInWithGoogle: () => {}, startPhoneAuth: () => {}, confirmPhoneCode: () => {} };
});
await page.goto("http://127.0.0.1:3000/onboarding", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.screenshot({ path: "shots/23-auth-google.png" });
const m = await page.evaluate(() => ({ h: document.body.scrollHeight, v: window.innerHeight }));
console.log("layout:", JSON.stringify(m));
console.log("google btn:", await page.getByRole("button", { name: /Continue with Google/ }).count());
await browser.close();
