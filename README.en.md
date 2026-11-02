# Kyro SNES Port

[Português](README.md) · **English**

A playable port of a Super Nintendo game for the **browser** and **Windows**, faithful to the original because the game runs on the **snes9x** core compiled to WebAssembly instead of a reimplementation.

> **No ROM is distributed with this project.** The app does not contain the game. You import a file you already own; it is read on your device and stored only there.

**Download:** [Releases](https://github.com/kadudevstudios/kyro-snes/releases) — portable Windows executable and source code.
**Play in the browser:** <https://kadudevstudios.github.io/kyro-snes/>

---

## What this is

A **modern shell** around a reference SNES emulation core:

- local ROM library with cartridge header inspection;
- player with integer or fitted scaling, 8:7 or 4:3 aspect, filter, scanlines, its own HUD and fast-forward;
- 3 save-state slots with thumbnails, persisted in IndexedDB;
- keyboard and gamepad remapping;
- audio settings (with test tone), HUD, SRAM autosave, export/import and reset;
- static web build and a Windows `.exe` (version **1.1.0**).

The architecture decision (emulation vs. native reconstruction) is documented in [`docs/DECISAO.md`](docs/DECISAO.md) (Portuguese).

---

## Requirements

| Platform | Requirements |
|---|---|
| Web | Modern browser with WebAssembly and WebGL (recent Chrome/Edge/Firefox/Safari) |
| Windows | Windows 10/11 x64 |
| Development | Node.js 20+ and npm |

---

## Quick start

### Web (development)

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:5173`, drag your ROM (`.smc`, `.sfc`, `.fig`, `.bin` or `.zip`) and click **Jogar** (Play).

### Web (production build)

```bash
cd web
npm install
npm run build      # writes web/dist
npm run preview    # serves the build on http://localhost:4173
```

`web/dist` is fully static and can be hosted on any HTTP server (Netlify, Vercel, nginx, GitHub Pages). **Do not open it via `file://`**: ES modules and the WASM core need HTTP.

### Windows (.exe)

```bash
powershell -ExecutionPolicy Bypass -File scripts/build-all.ps1
```

The portable executable is written to `desktop/release/Kyro-SNES-Port-1.1.0.exe` (~107 MiB). It is not code-signed, so SmartScreen may ask for confirmation on first run.

Development mode:

```bash
cd desktop
npm install
npm start
```

> **npm 11+ note:** the `allow-scripts` policy may block Electron's postinstall. If the binary is missing, run `node node_modules/electron/install.js` inside `desktop/`.

---

## Using it

1. **Import** — drag the ROM into the window or use *Importar ROM*. `.zip` files are extracted automatically.
2. **Inspect** — the chip button on the card opens the header analysis (region, mapping, checksum, SHA-256, per-bank entropy).
3. **Play** — click *Jogar*, then *Iniciar jogo* (the click is required to unlock audio in the browser).
4. **Save** — `F5` saves to slot 1; `F8` loads it. The UI has 3 slots with thumbnails.

### Shortcuts

| Key | Action |
|---|---|
| `Esc` | Pause / resume (or leave fullscreen) |
| `F` | Toggle fast-forward |
| `F5` | Save state to slot 1 |
| `F8` | Load state from slot 1 |
| `F11` | Fullscreen |
| `M` | Mute |

Default SNES mapping:

| SNES | Keyboard | Gamepad |
|---|---|---|
| D-pad | Arrow keys | D-pad / stick |
| A | `X` | Button 1 |
| B | `Z` | Button 2 |
| X | `S` | Button 3 |
| Y | `A` | Button 4 |
| L / R | `Q` / `W` | LB / RB |
| Start | `Enter` | Start |
| Select | `Tab` | Select |

Everything can be remapped in **Settings → Controls** (or in the quick settings during play).

---

## Features

- **Local library** with automatic header identification (title, region, mapping, size, checksum).
- **Technical inspection**: header at `0x7FC0`, checksum pair, SHA-256, CRC-32, 16 KB per-bank entropy, copier-header detection.
- **Player** with integer/fitted scaling, 8:7 or 4:3 aspect, sharp/smooth filter, optional scanlines, fullscreen, auto-hiding HUD and fast-forward.
- **Pause** with the current frame blurred behind the card, plus resume, restart and exit.
- **Save states**: 3 slots with a large thumbnail, confirmation before overwriting/deleting, alongside the game's own SRAM (in-game saves).
- **Controls**: keyboard, gamepad (Gamepad API) and touch on mobile.
- **Persistence** in IndexedDB/localStorage — nothing leaves your device.
- **Auto-pause** on focus loss (configurable).

---

## Structure

```text
KYRO-SNES-PORT/
├── docs/                     # decision, architecture, ROM analysis, tests (pt-BR)
├── web/
│   ├── public/emu/           # EmulatorJS runtime + snes9x core (self-hosted)
│   ├── src/
│   │   ├── core/             # ROM, IndexedDB, settings, controls, ZIP
│   │   ├── emulator/         # protocol and bridge (iframe ↔ shell)
│   │   ├── player/           # emulator iframe entry point
│   │   ├── ui/               # shell, screens, components
│   │   └── styles/
│   ├── index.html
│   ├── player.html
│   └── vite.config.ts
├── desktop/                  # Electron + packaging
├── scripts/                  # build and runtime re-vendoring
├── tests/                    # Playwright e2e + pixel analysis, CI smoke
└── .github/workflows/        # CI and GitHub Pages deploy
```

---

## Known limitations

- **Not a native reconstruction.** The game logic runs inside the snes9x core; there is no game source code in this repository. See [`docs/DECISAO.md`](docs/DECISAO.md).
- **A ROM is required.** Without the game file the app opens an empty library.
- **Cheats, netplay and video recording** are not exposed in the UI (the runtime supports them).
- **WebGL2** is not enabled by default; the core uses the legacy (WebGL1) renderer, which is EmulatorJS's tested default and works on more machines.
- **Audio** depends on a user gesture (click *Iniciar jogo*) by browser policy.
- **SRAM** (in-game saves) is handled by the runtime; save states are managed by the shell.

---

## Tests

```bash
cd web && npm run build
cd ../tests && npm install
set KYRO_TEST_ROM=C:\path\to\your\rom.smc
node run-e2e.mjs
```

The suite loads the real build in Chrome, imports the ROM, starts the core, **analyses rendered pixels**, pauses/resumes (checking the snapshot), toggles fast-forward, saves and loads states, overwrites a slot with confirmation and inspects IndexedDB. 39 checks; results in [`docs/TESTES.md`](docs/TESTES.md).

A ROM-free smoke test runs in CI:

```bash
cd tests && node run-smoke.mjs
```

---

## Licensing and credits

- Shell code: MIT.
- **EmulatorJS 4.2.3** — GPL-3.0 (runtime in `web/public/emu`), unmodified.
- **snes9x** (libretro core, EmulatorJS WebAssembly build) — GPL-2.0 or later. The binary is redistributed under the GPL; the corresponding source is at <https://github.com/libretro/snes9x> and the build scripts at <https://github.com/EmulatorJS/build>.
- Full notices, exact versions and the written source offer are in [`web/public/emu/THIRD-PARTY-NOTICES.md`](web/public/emu/THIRD-PARTY-NOTICES.md).
- **Super Mario World** and all game assets are Nintendo's property. This project distributes no ROM, BIOS, sprites, music or any other protected material.

By using this software you state that you are authorised to use the ROM you import.
