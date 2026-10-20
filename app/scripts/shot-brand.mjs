import { chromium } from "playwright-core";
const EXE = "C:/Users/Shubh/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe";
const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
await page.screenshot({ path: "shots/24-brand.png" });
console.log("title:", await page.title());
await browser.close();
