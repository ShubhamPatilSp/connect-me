import { chromium } from "playwright-core";
const EXE = "C:/Users/Shubh/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe";
const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1100, height: 1500 }, deviceScaleFactor: 1 });
await page.goto("http://127.0.0.1:3100/seed/contact-sheet.html", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: "shots/20-contact-sheet.png", fullPage: true });
console.log("ok");
await browser.close();
