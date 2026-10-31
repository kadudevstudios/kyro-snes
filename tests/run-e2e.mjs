/**
 * End-to-end verification against the real build and the real ROM.
 *
 * The ROM is never copied into the project: point KYRO_TEST_ROM at a file you
 * are allowed to use. The script drives the actual UI, starts the actual WASM
 * core, and inspects rendered pixels.
 */

import { chromium } from "playwright";
import { PNG } from "pngjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createServer } = require("../desktop/static-server.js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "web", "dist");
const ARTIFACTS = path.join(__dirname, "artifacts");
const PORT = 4181;

const ROM =
  process.env.KYRO_TEST_ROM ??
  path.resolve(ROOT, "..", "work", "rom", "Super Mario World (U) [!].smc");

const results = [];
function check(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
  if (!condition) process.exitCode = 1;
}

function analyze(pngBuffer) {
  const png = PNG.sync.read(pngBuffer);
  const colors = new Set();
  let nonBlack = 0;
  let total = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i];
    const g = png.data[i + 1];
    const b = png.data[i + 2];
    total += 1;
    if (r + g + b > 24) nonBlack += 1;
    if (colors.size < 4096) colors.add((r << 16) | (g << 8) | b);
  }
  return { uniqueColors: colors.size, nonBlackRatio: nonBlack / total, width: png.width, height: png.height };
}

/** Fraction of pixels that changed noticeably between two PNG buffers. */
function pixelDiff(a, b) {
  const first = PNG.sync.read(a);
  const second = PNG.sync.read(b);
  if (first.width !== second.width || first.height !== second.height) return 1;
  let changed = 0;
  for (let i = 0; i < first.data.length; i += 4) {
    const delta =
      Math.abs(first.data[i] - second.data[i]) +
      Math.abs(first.data[i + 1] - second.data[i + 1]) +
      Math.abs(first.data[i + 2] - second.data[i + 2]);
    if (delta > 24) changed += 1;
  }
  return changed / (first.width * first.height);
}

async function main() {
  if (!fs.existsSync(ROM)) {
    console.error(`ROM de teste não encontrada: ${ROM}`);
    console.error("Defina KYRO_TEST_ROM com o caminho da sua ROM.");
    process.exit(2);
  }
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    console.error("Build ausente. Rode `npm run build` em web/ primeiro.");
    process.exit(2);
  }

  fs.mkdirSync(ARTIFACTS, { recursive: true });

  const server = createServer(DIST);
  await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));

  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: [
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--autoplay-policy=no-user-gesture-required",
      "--mute-audio",
    ],
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });

  const requested = [];
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("/emu/")) requested.push(`${response.status()} ${url.replace(`http://127.0.0.1:${PORT}`, "")}`);
  });

  try {
    /* ------------------------------------------------------------ library */
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });
    // Headless windows are never focused; keep auto-pause out of the way so we
    // measure the emulator instead of the focus policy.
    await page.evaluate(() => {
      const raw = localStorage.getItem("kyro-snes-settings-v1");
      const settings = raw ? JSON.parse(raw) : {};
      settings.pauseOnBlur = false;
      localStorage.setItem("kyro-snes-settings-v1", JSON.stringify(settings));
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector(".topbar");
    check("app shell monta", await page.locator(".brand__text").isVisible());
    check("estado vazio aparece", await page.locator(".empty").isVisible());

    await page.setInputFiles('input[type="file"]', ROM);
    await page.waitForSelector(".rom-card", { timeout: 30_000 });
    // The route fades in; screenshotting immediately captures a blank frame.
    await page.waitForTimeout(700);
    const cardTitle = (await page.locator(".rom-card__title").first().textContent())?.trim();
    check("ROM importada e identificada", cardTitle === "SUPER MARIOWORLD", `título="${cardTitle}"`);
    check("metadados do header na UI", (await page.locator(".rom-card__tag").first().textContent())?.trim() === "LoROM");

    await page.screenshot({ path: path.join(ARTIFACTS, "01-library.png"), fullPage: true });

    /* ---------------------------------------------------------- inspector */
    await page.locator(".rom-card__tools .icon-btn").first().click();
    await page.waitForSelector(".detail-grid");
    const inspectorText = await page.locator(".screen--inspector").innerText();
    check("inspetor mostra mapping", inspectorText.includes("LoROM"));
    check("inspetor mostra região", inspectorText.includes("EUA"));
    check("inspetor mostra SHA-256", /[0-9a-f]{64}/.test(inspectorText));
    await page.screenshot({ path: path.join(ARTIFACTS, "02-inspector.png"), fullPage: true });

    /* ------------------------------------------------------------- player */
    await page.getByRole("button", { name: "Jogar", exact: true }).click();
    await page.waitForSelector(".player__iframe", { timeout: 15_000 });

    const frame = await waitForFrame(page, "player.html", 20_000);
    check("iframe do player carregou", Boolean(frame));
    if (!frame) throw new Error("iframe do player não carregou");

    await frame.waitForSelector(".ejs_start_button", { timeout: 60_000 });
    check("botão de iniciar presente", await frame.locator(".ejs_start_button").isVisible());
    await frame.locator(".ejs_start_button").click();

    await page.waitForFunction(
      () => document.querySelector(".hud__status")?.textContent?.includes("Em execução"),
      undefined,
      { timeout: 120_000 },
    );
    check("núcleo iniciou o jogo", true);

    // The first frames are black while the ROM boots; wait for real pixels.
    const canvas = frame.locator("canvas").first();
    const renderDeadline = Date.now() + 60_000;
    let shot = await canvas.screenshot();
    let stats = analyze(shot);
    while (Date.now() < renderDeadline && (stats.uniqueColors < 40 || stats.nonBlackRatio < 0.08)) {
      await page.waitForTimeout(500);
      shot = await canvas.screenshot();
      stats = analyze(shot);
    }
    fs.writeFileSync(path.join(ARTIFACTS, "03-gameplay.png"), shot);
    check("canvas renderiza imagem", stats.uniqueColors > 40, `${stats.uniqueColors} cores`);
    check("quadro não está vazio", stats.nonBlackRatio > 0.08, `${(stats.nonBlackRatio * 100).toFixed(1)}% não-preto`);
    check(
      "resolução nativa do núcleo",
      stats.width >= 256 && stats.height >= 224,
      `${stats.width}×${stats.height}`,
    );

    const coreLoaded = requested.some(
      (line) => /snes9x(-legacy)?-wasm\.data/.test(line) && line.startsWith("200"),
    );
    check(
      "núcleo snes9x servido localmente",
      coreLoaded,
      requested.find((l) => /snes9x(-legacy)?-wasm\.data/.test(l)) ?? "não requisitado",
    );

    /* --------------------------------------------------------------- input */
    // Focus the game and press Start: the title screen must give way to the
    // file-select screen. This proves key events reach the emulated console.
    await canvas.click();
    await page.waitForTimeout(300);
    const beforeInput = shot;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(3000);
    const afterInput = await canvas.screenshot();
    fs.writeFileSync(path.join(ARTIFACTS, "03b-after-start.png"), afterInput);
    const changed = pixelDiff(beforeInput, afterInput);
    check("entrada (Start) chega ao console", changed > 0.02, `${(changed * 100).toFixed(1)}% dos pixels mudaram`);

    /* -------------------------------------------------------------- pause */
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
    check("pausa funciona", await page.locator(".pause-overlay").isVisible());
    // The snapshot is captured after pausing, so it lands a moment later.
    await page
      .waitForFunction(
        () => {
          const img = document.querySelector(".pause-overlay__shot");
          return Boolean(img && (img.getAttribute("src") || "").startsWith("data:image"));
        },
        { timeout: 8000 },
      )
      .catch(() => undefined);
    const pauseShotSrc = await page.locator(".pause-overlay__shot").getAttribute("src");
    let pauseShotInfo = null;
    if (pauseShotSrc?.startsWith("data:image/png;base64,")) {
      pauseShotInfo = analyze(Buffer.from(pauseShotSrc.split(",")[1], "base64"));
    }
    check(
      "pausa mostra snapshot do jogo",
      Boolean(pauseShotInfo && pauseShotInfo.nonBlackRatio > 0.02),
      pauseShotInfo ? `${(pauseShotInfo.nonBlackRatio * 100).toFixed(1)}% não-preto` : "sem src",
    );
    await page.screenshot({ path: path.join(ARTIFACTS, "04-paused.png") });

    await page.locator(".pause-overlay .btn--primary").click();
    await page.waitForTimeout(500);
    check("retomada funciona", !(await page.locator(".pause-overlay").isVisible()));

    /* -------------------------------------------------------- fast-forward */
    await page.mouse.move(720, 320);
    await page.waitForTimeout(400);
    const ffButton = page.locator(".hud__btn[title='Avanço rápido (F)']");
    const ffAvailable = await ffButton.isVisible().catch(() => false);
    check("avanço rápido disponível no núcleo", ffAvailable);
    if (ffAvailable) {
      await ffButton.click();
      await page.waitForTimeout(400);
      const ffPressed = await ffButton.getAttribute("aria-pressed");
      const ffActive = await ffButton.evaluate((el) => el.classList.contains("is-active"));
      check("avanço rápido liga", ffPressed === "true" && ffActive, `aria-pressed=${ffPressed}`);
      await ffButton.click();
      await page.waitForTimeout(400);
      check("avanço rápido desliga", (await ffButton.getAttribute("aria-pressed")) === "false");
    } else {
      check("avanço rápido liga", false, "botão oculto");
      check("avanço rápido desliga", false, "botão oculto");
    }

    /* --------------------------------------------------------- save states */
    await page.keyboard.press("F5");
    const saveToast = await readToast(page, "Estado salvo");
    check("save state grava", saveToast.includes("Estado salvo"), saveToast.trim());

    const stateCount = await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("kyro-snes", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return new Promise((resolve, reject) => {
        const tx = db.transaction("states", "readonly");
        const request = tx.objectStore("states").count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
    check("estado persistido no IndexedDB", stateCount >= 1, `${stateCount} estado(s)`);

    await page.keyboard.press("F8");
    const loadToast = await readToast(page, "carregado");
    check("save state carrega", loadToast.includes("carregado"), loadToast.trim());

    /* ------------------------------------------------- slots: sobrescrever */
    // Let the previous toasts expire so the new one is unambiguous.
    await page
      .waitForFunction(() => document.querySelectorAll(".toast").length === 0, { timeout: 8000 })
      .catch(() => undefined);
    await page.mouse.move(720, 320);
    await page.waitForTimeout(400);
    await page.locator(".hud__btn[title='Salvar estado (F5)']").click();
    const saveDialog = page.getByRole("dialog", { name: "Salvar estado" });
    await saveDialog.waitFor();
    await saveDialog
      .locator(".slot")
      .first()
      .getByRole("button", { name: "Sobrescrever", exact: true })
      .click();
    const overwriteDialog = page.getByRole("dialog", { name: "Sobrescrever slot?" });
    await overwriteDialog.waitFor();
    check("pede confirmação ao sobrescrever slot", await overwriteDialog.isVisible());
    await overwriteDialog.getByRole("button", { name: "Sobrescrever", exact: true }).click();
    const overwriteToast = await readToast(page, "Estado salvo no slot 1");
    check("sobrescrever slot grava", overwriteToast.includes("slot 1"), overwriteToast.trim());
    check("lista de slots continua aberta", await saveDialog.isVisible());
    await saveDialog.locator(".modal__footer").getByRole("button", { name: "Fechar" }).click();
    await page.waitForTimeout(300);

    /* ------------------------------------------------------- proporção 4:3 */
    // The HUD auto-hides while playing; pointer movement over the game has to
    // bring it back (the events happen inside the iframe document).
    await page.mouse.move(720, 320);
    await page.waitForTimeout(500);
    const hudVisible = await page.locator(".hud").evaluate((el) => !el.classList.contains("is-hidden"));
    check("HUD reaparece ao mover o mouse", hudVisible);

    await page.locator(".hud__btn[title='Ajustes rápidos']").click();
    await page.waitForSelector(".quick");
    await page.locator(".quick .segmented").nth(1).getByRole("button", { name: "4:3", exact: true }).click();
    await page.waitForTimeout(400);
    const frameAspect = await page
      .locator(".player__frame")
      .evaluate((el) => el.getBoundingClientRect().width / el.getBoundingClientRect().height);
    check("proporção 4:3 aplicada", Math.abs(frameAspect - 4 / 3) < 0.02, frameAspect.toFixed(3));
    await page.getByRole("button", { name: "Pronto" }).click();
    await page.waitForTimeout(300);

    // Leaving the game asks for confirmation by default.
    await page.locator(".hud__btn[title='Sair do jogo']").click();
    await page.waitForSelector(".modal");
    check("confirmação ao sair aparece", await page.locator(".modal").isVisible());
    await page.locator(".modal").getByRole("button", { name: "Sair", exact: true }).click();
    await page.waitForSelector(".rom-card", { timeout: 10_000 });
    check("volta para a biblioteca", await page.locator(".rom-grid").isVisible());

    await page.getByRole("navigation").getByRole("button", { name: "Configurações" }).click();
    await page.waitForSelector(".settings-grid");
    check("tela de configurações", await page.locator(".segmented").first().isVisible());
    const settingsText = await page.locator(".screen--settings").innerText();
    check("opção de proporção presente", settingsText.includes("Proporção"));
    check("save automático configurável", settingsText.includes("Save automático do jogo"));
    check(
      "dados exportáveis",
      settingsText.includes("Exportar") && settingsText.includes("Importar"),
    );

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Exportar" }).click(),
    ]);
    check(
      "exporta configurações",
      download.suggestedFilename().endsWith(".json"),
      download.suggestedFilename(),
    );

    await page.locator(".range").first().evaluate((el) => {
      const input = el;
      input.value = "20";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.getByRole("button", { name: "Restaurar padrões" }).click();
    await page.locator(".modal").getByRole("button", { name: "Restaurar", exact: true }).click();
    await page.waitForSelector(".settings-grid");
    await page.waitForTimeout(500);
    const volumeAfter = await page.locator(".range").first().inputValue();
    check("restaurar padrões volta ao default", volumeAfter === "70", `volume=${volumeAfter}`);

    await page.screenshot({ path: path.join(ARTIFACTS, "05-settings.png"), fullPage: true });

    /* ------------------------------------------------------------- remoção */
    // Exercises the confirm dialog end to end (it used to resolve "cancel"
    // before the confirm click, so nothing was ever deleted).
    await page.getByRole("navigation").getByRole("button", { name: "Biblioteca" }).click();
    await page.waitForSelector(".rom-card");
    await page.locator(".rom-card__tools .icon-btn").first().click();
    await page.waitForSelector(".detail-grid");
    await page.locator(".btn--danger").click();
    await page.waitForSelector(".modal");
    await page.locator(".modal").getByRole("button", { name: "Remover", exact: true }).click();
    await page.waitForSelector(".empty", { timeout: 10_000 });
    check("remoção de ROM funciona", await page.locator(".empty").isVisible());

    /* ------------------------------------------------------------- console */
    const realErrors = pageErrors.filter(
      (text) => !/favicon|Failed to load resource.*404/i.test(text),
    );
    check("sem erros de console", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));

    console.log("\nRequisições do runtime:");
    for (const line of requested.slice(0, 12)) console.log("  " + line);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} verificações passaram.`);
  if (failed.length) {
    console.log("Falhas:", failed.map((f) => f.name).join(", "));
    process.exitCode = 1;
  }
}

async function waitForFrame(page, needle, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const frame = page.frames().find((candidate) => candidate.url().includes(needle));
    if (frame) return frame;
    await page.waitForTimeout(150);
  }
  return null;
}

/** Toasts auto-dismiss, so poll for the one we expect instead of racing it. */
async function readToast(page, needle, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const texts = await page.locator(".toast").allInnerTexts();
    const match = texts.find((text) => text.includes(needle));
    if (match) return match;
    await page.waitForTimeout(100);
  }
  return (await page.locator(".toast").allInnerTexts()).join(" | ");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
