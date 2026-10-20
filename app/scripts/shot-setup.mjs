import { chromium } from "playwright-core";

const EXE = "C:/Users/Shubh/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe";
const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2,
});

await page.goto("file:///C:/Users/Shubh/OneDrive/Desktop/dating/mobile/android/app/src/main/assets/setup.html");
await page.waitForTimeout(400);
await page.screenshot({ path: "shots/11-android-setup.png" });
console.log("shot setup");

// Exercise the validation path the way the WebView bridge would.
await page.fill("#url", "192.168.1.42:3000");
await page.click("#go");
await page.waitForTimeout(300);
console.log("bridge present in browser:", await page.evaluate(() => typeof window.AndroidBridge));
await page.screenshot({ path: "shots/12-android-setup-filled.png" });
console.log("shot setup-filled");

await browser.close();
