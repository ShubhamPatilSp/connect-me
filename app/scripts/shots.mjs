import fs from "node:fs";
import { chromium } from "playwright-core";

const EXE = "C:/Users/Shubh/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe";
const BASE = "http://127.0.0.1:3100";

fs.mkdirSync("shots", { recursive: true });

const browser = await chromium.launch({ executablePath: EXE });
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));

async function shot(name) {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `shots/${name}.png` });
  console.log("shot", name);
}

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await shot("01-landing");

await page.evaluate(async () => {
  await fetch("/api/auth/demo", { method: "POST" });
});

const routes = [
  ["02-discover", "/discover"],
  ["03-likes", "/likes"],
  ["04-matches", "/matches"],
  ["05-chat", "/chat/m_1"],
  ["06-me", "/me"],
  ["07-settings", "/settings"],
  ["08-profile-detail", "/u/u_001"],
  ["09-edit", "/me/edit"],
  ["10-onboarding", "/onboarding"],
];

for (const [name, path] of routes) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await shot(name);
}

console.log("\nCONSOLE ERRORS:", errors.length);
for (const e of errors.slice(0, 20)) console.log(" -", e);

await browser.close();
