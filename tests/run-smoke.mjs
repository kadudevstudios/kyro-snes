/**
 * ROM-free smoke test used by CI.
 *
 * Boots the built shell in headless Chrome and verifies that the app mounts,
 * the empty library renders and no console errors happen. The full suite
 * (tests/run-e2e.mjs) needs a ROM the CI cannot ship.
 */

import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createServer } = require("../desktop/static-server.js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "..", "web", "dist");
const PORT = 4183;

const checks = [];
function check(name, ok, detail = "") {
  checks.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

const server = createServer(DIST);
const REMOTE = process.env.KYRO_SMOKE_URL;
if (!REMOTE) await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--mute-audio"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().includes("favicon")) errors.push(message.text());
});

try {
  await page.goto(REMOTE ?? `http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });
  await page.waitForSelector(".topbar", { timeout: 15_000 });

  check("shell monta", await page.locator(".brand__text").isVisible());
  check("estado vazio aparece", await page.locator(".empty").isVisible());
  check("navegação presente", (await page.locator(".nav button").count()) >= 2);
  check("sem erros de console", errors.length === 0, errors.join(" | "));
} finally {
  await browser.close();
  if (!REMOTE) server.close();
}

const failed = checks.filter((ok) => !ok).length;
console.log(`\n${checks.length - failed}/${checks.length} verificações de fumaça passaram.`);
