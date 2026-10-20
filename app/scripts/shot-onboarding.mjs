import { chromium } from "playwright-core";

const EXE = "C:/Users/Shubh/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe";
const BASE = "http://127.0.0.1:3100";

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2,
});

const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(`${BASE}/onboarding`, { waitUntil: "domcontentloaded" });

const phone = `9${String(Date.now()).slice(-9)}`;
await page.fill('input[placeholder="98765 43210"]', phone);
await page.getByRole("button", { name: /send code/i }).click();

await page.waitForSelector("input[autocomplete='one-time-code']", { timeout: 15000 });
await page.waitForTimeout(400);

const code = (await page.locator("code").first().textContent()).trim();
console.log("otp:", code);
await page.fill("input[autocomplete='one-time-code']", code);
await page.waitForTimeout(200);
await page.getByRole("button", { name: /^verify$/i }).click();

try {
  await page.waitForSelector('input[placeholder="Rohan"]', { timeout: 15000 });
} catch (err) {
  await page.screenshot({ path: "shots/debug-verify.png" });
  console.log("STUCK. body text:\n", (await page.innerText("body")).slice(0, 600));
  throw err;
}
await page.fill('input[placeholder="Rohan"]', "Test");
await page.fill('input[type="date"]', "1998-04-12");
await page.click("text=Continue");

await page.waitForSelector("text=Where in Khandesh?", { timeout: 10000 });
await page.waitForTimeout(500);

const metrics = await page.evaluate(() => ({
  bodyHeight: document.body.scrollHeight,
  viewport: window.innerHeight,
  innerScroll: (() => {
    const el = document.querySelector('[class*="cityScroll"]');
    return el ? { client: el.clientHeight, scroll: el.scrollHeight } : null;
  })(),
}));
console.log("layout:", JSON.stringify(metrics));

await page.screenshot({ path: "shots/13-city-picker.png" });
console.log("shot 13-city-picker");

await page.click("text=Bhusawal");
await page.waitForTimeout(300);
await page.screenshot({ path: "shots/14-city-selected.png" });
console.log("shot 14-city-selected");

await page.fill('input[placeholder="Search your town"]', "shir");
await page.waitForTimeout(300);
await page.screenshot({ path: "shots/15-city-search.png" });
console.log("shot 15-city-search");

// Walk the remaining steps to confirm the fixed-height layout didn't break them.
await page.fill('input[placeholder="Search your town"]', "");
await page.waitForTimeout(200);
await page.getByRole("button", { name: /^continue$/i }).click();

await page.waitForSelector('button[class*="photoTile"]', { timeout: 10000 });
const samples = page.locator('button[class*="photoTile"]');
await samples.nth(0).click();
await samples.nth(1).click();
await samples.nth(2).click();
await page.waitForTimeout(300);
await page.screenshot({ path: "shots/16-photos.png" });
console.log("shot 16-photos");

await page.getByRole("button", { name: /^continue$/i }).click();
await page.waitForSelector("text=What are you into?", { timeout: 10000 });
for (const tag of ["Street Food", "Chai", "Music"]) {
  await page.getByRole("button", { name: tag, exact: true }).click();
}
await page.waitForTimeout(300);
await page.screenshot({ path: "shots/17-interests.png" });
console.log("shot 17-interests");

await page.getByRole("button", { name: /^continue$/i }).click();
await page.waitForSelector("text=What brings you here?", { timeout: 10000 });
await page.waitForTimeout(400);
await page.screenshot({ path: "shots/18-intent.png" });
console.log("shot 18-intent");

const heights = await page.evaluate(() => ({
  body: document.body.scrollHeight,
  viewport: window.innerHeight,
  ctaVisible: (() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      /create my profile/i.test(b.textContent || ""),
    );
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight;
  })(),
}));
console.log("step 7 layout:", JSON.stringify(heights));

console.log("page errors:", errors.length ? errors : "none");
await browser.close();
