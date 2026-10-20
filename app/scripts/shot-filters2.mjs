import { chromium } from "playwright-core";
const EXE = "C:/Users/Shubh/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe";
const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded" });
await page.evaluate(async () => {
  await fetch("/api/auth/demo", { method: "POST" });
  await fetch("/api/me", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prefAgeMin: 18, prefAgeMax: 60, prefDistanceKm: 120, prefVerifiedOnly: true }),
  });
});
await page.goto("http://127.0.0.1:3000/discover", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.getByLabel("Filters").click();
await page.waitForTimeout(700);
await page.screenshot({ path: "shots/28-filters-extremes.png" });
// overflow check
const overflow = await page.evaluate(() => {
  const thumbs = [...document.querySelectorAll(".rs-input")].map((el) => el.getBoundingClientRect());
  const sheet = document.querySelector(".sheet").getBoundingClientRect();
  return { sheetLeft: Math.round(sheet.left), sheetRight: Math.round(sheet.right), thumbLefts: thumbs.map(t => Math.round(t.left)) };
});
console.log(JSON.stringify(overflow));
await browser.close();
