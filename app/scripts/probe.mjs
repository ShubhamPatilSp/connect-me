import { chromium } from "playwright-core";
const EXE = "C:/Users/Shubh/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe";
const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
await page.goto("http://127.0.0.1:3100/onboarding");
const phone = `9${String(Date.now()).slice(-9)}`;
await page.fill('input[placeholder="98765 43210"]', phone);
await page.getByRole("button", { name: /send code/i }).click();
await page.waitForSelector("input[autocomplete='one-time-code']");
await page.waitForTimeout(400);
const code = (await page.locator("code").first().textContent()).trim();
await page.fill("input[autocomplete='one-time-code']", code);
await page.getByRole("button", { name: /^verify$/i }).click();
await page.waitForSelector('input[placeholder="Rohan"]');
await page.fill('input[placeholder="Rohan"]', "Test");
await page.fill('input[type="date"]', "1998-04-12");
await page.getByRole("button", { name: /^continue$/i }).click();
await page.waitForSelector("text=Where in Khandesh?");
await page.click("text=Bhusawal");
await page.getByRole("button", { name: /^continue$/i }).click();
await page.waitForSelector('button[class*="photoTile"]');
const s = page.locator('button[class*="photoTile"]');
await s.nth(0).click(); await s.nth(1).click(); await s.nth(2).click();
await page.getByRole("button", { name: /^continue$/i }).click();
await page.waitForSelector("text=What are you into?");
for (const t of ["Street Food","Chai","Music"]) await page.getByRole("button", { name: t, exact: true }).click();
await page.getByRole("button", { name: /^continue$/i }).click();
await page.waitForSelector("text=What brings you here?");
await page.waitForTimeout(500);
const info = await page.evaluate(() => {
  const el = document.querySelector('[class*="body"]');
  const cs = getComputedStyle(el);
  return {
    dataFade: el.dataset.fade,
    mask: cs.maskImage || cs.webkitMaskImage,
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
