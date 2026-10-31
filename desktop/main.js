"use strict";

/**
 * Kyro SNES Port — desktop shell.
 *
 * The UI is the same web build, served from a loopback-only HTTP server so
 * that ES modules, WASM and fetch() all behave exactly as they do in a
 * browser (file:// would break the core loader).
 */

const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("node:path");
const { createServer } = require("./static-server.js");

const APP_ROOT = path.join(__dirname, "app");
const SMOKE_TEST = process.argv.includes("--smoke-test");

let mainWindow = null;
let server = null;
let serverPort = 0;

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function startServer() {
  return new Promise((resolve, reject) => {
    server = createServer(APP_ROOT);
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      serverPort = server.address().port;
      resolve(serverPort);
    });
  });
}

function createWindow(options = {}) {
  const window = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 880,
    minHeight: 560,
    show: false,
    backgroundColor: "#08090c",
    autoHideMenuBar: true,
    title: "Kyro SNES",
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
    ...options,
  });

  window.setMenuBarVisibility(false);
  window.loadURL(`http://127.0.0.1:${serverPort}/`);

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${serverPort}`)) event.preventDefault();
  });

  return window;
}

async function waitForApp(window, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const ready = await window.webContents.executeJavaScript(
        'Boolean(window.kyroApp && document.querySelector(".topbar"))',
      );
      if (ready) return true;
    } catch {
      /* page not ready yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  await startServer();

  if (SMOKE_TEST) {
    const window = createWindow({ show: false });
    const ok = await waitForApp(window);
    console.log(`SMOKE ${ok ? "OK" : "FAIL"} port=${serverPort}`);
    app.exit(ok ? 0 : 1);
    return;
  }

  mainWindow = createWindow();
  mainWindow.once("ready-to-show", () => mainWindow.show());

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
      mainWindow.once("ready-to-show", () => mainWindow.show());
    }
  });
});

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  server?.close();
});
