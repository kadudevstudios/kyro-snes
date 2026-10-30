# 🎮 KYRO SNES Port

**A faithful Super Nintendo experience on Windows and the Web.**

KYRO SNES Port is a playable SNES emulator application for Windows and modern browsers, powered by the **Snes9x emulation core compiled to WebAssembly**.

Instead of reimplementing the original game's logic, KYRO uses an established SNES emulation core to reproduce the original hardware behavior.

> **No game ROMs are distributed with this project.** You import a game file you are legally authorized to use. ROM files are processed locally and stored on your device.

---

## 🚀 Download

**Latest version: 1.0.0**

[⬇️ Download KYRO SNES Port 1.0.0](../../releases/latest)

**Windows executable:** `Kyro-SNES-Port-1.0.0.exe`

For the browser version, follow the development and production build instructions below.

---

## ✨ Features

- Local ROM library with cartridge inspection.
- SNES emulator powered by Snes9x through WebAssembly.
- Pixel-perfect scaling and adjustable display ratios (8:7 and 4:3).
- Image filters, optional scanlines and custom HUD.
- Three save-state slots with screenshots.
- SRAM persistence for in-game saves.
- Keyboard and gamepad support.
- Touch controls on compatible mobile devices.
- Remappable controls.
- Audio settings and test tone.
- Automatic SRAM saving.
- Import and export settings.
- Local storage using IndexedDB and localStorage.

---

## 💻 Requirements

| Platform | Requirements |
|---|---|
| Web | Modern browser with WebAssembly and WebGL |
| Windows | Windows 10/11 x64 |
| Development | Node.js 20+ and npm |

Supported browsers include recent versions of Chrome, Edge, Firefox and Safari.

---

## ⚡ Getting Started

### Web development

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:5173`, import your ROM (`.smc`, `.sfc`, `.fig`, `.bin` or `.zip`) and click **Play**.

### Web production build

```bash
cd web
npm install
npm run build
npm run preview
```

The production build is generated in `web/dist`.

It can be hosted on any HTTP server, including Netlify, Vercel, nginx and GitHub Pages.

**Important:** Do not open the application through `file://`. WebAssembly and ES modules require HTTP hosting.

### Windows executable

Build the application using PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-all.ps1
```

The portable executable is generated at:

```text
desktop/release/Kyro-SNES-Port-1.0.0.exe
```

Approximate size: **107 MiB**.

The executable is currently unsigned, so Windows SmartScreen may display a warning on first launch.

#### Windows development mode

```bash
cd desktop
npm install
npm start
```

**Note about npm 11+:** The `allow-scripts` policy may block Electron's postinstall script. If Electron fails to download its binary, run:

```bash
node node_modules/electron/install.js
```

from inside `desktop/`.

---

## 🎮 How to Use

1. **Import:** Drag a ROM into the application or use the Import ROM option.
2. **Inspect:** Open the cartridge information panel to inspect its technical metadata.
3. **Play:** Click Play and then Start Game. The additional click enables browser audio.
4. **Save:** Press `F5` to save a state in slot 1.
5. **Load:** Press `F8` to load the state from slot 1.

### Keyboard shortcuts

| Key | Action |
|---|---|
| `Esc` | Pause / Resume or exit fullscreen |
| `F5` | Save state to slot 1 |
| `F8` | Load state from slot 1 |
| `F11` | Toggle fullscreen |
| `M` | Mute audio |

### Default controller mapping

| SNES Button | Keyboard | Gamepad |
|---|---|---|
| D-pad | Arrow keys | D-pad / Analog |
| A | `X` | Button 1 |
| B | `Z` | Button 2 |
| X | `S` | Button 3 |
| Y | `A` | Button 4 |
| L / R | `Q` / `W` | LB / RB |
| Start | `Enter` | Start |
| Select | `Tab` | Select |

All controls can be remapped under **Settings → Controls**.

---

## 🔬 ROM Inspection

KYRO includes a technical cartridge inspection system with:

- Internal cartridge title.
- Region detection.
- Mapping information.
- ROM size.
- Header inspection at `0x7FC0`.
- Checksum analysis.
- SHA-256 and CRC-32 hashes.
- Entropy analysis per 16 KB bank.
- Copier header detection.

The ROM inspection system helps identify and analyze the imported cartridge without distributing game content.

---

## 🏗️ Project Structure

```text
KYRO-SNES-PORT/
├── docs/
│   ├── ANALISE-ROM.md
│   ├── ARQUITETURA.md
│   ├── DECISAO.md
│   └── TESTES.md
├── web/
│   ├── public/emu/
│   ├── src/
│   │   ├── core/
│   │   ├── emulator/
│   │   ├── player/
│   │   ├── ui/
│   │   └── styles/
│   ├── index.html
│   ├── player.html
│   └── vite.config.ts
├── desktop/
│   ├── main.js
│   ├── preload.js
│   ├── static-server.js
│   └── build/
├── scripts/
├── tests/
└── README.md
```

---

## ⚠️ Known Limitations

- This project is an emulation-based application, not a native reconstruction of the original game.
- A legally obtained ROM is required to play.
- Cheats, netplay and video recording are not exposed in the application interface.
- WebGL1 is used by default for broader compatibility.
- Browser audio requires a user interaction before playback.
- SRAM saves are managed by the emulation runtime, while save states are managed by the KYRO interface.

---

## 🧪 Testing

The project includes automated end-to-end testing with Playwright.

```bash
cd web
npm run build

cd ../tests
npm install
```

Set the path to a ROM you are legally authorized to use:

```powershell
$env:KYRO_TEST_ROM = "C:\path\to\your\rom.smc"
node run-e2e.mjs
```

The test suite can verify ROM import, emulator startup, rendered pixels, pause/resume, save states and IndexedDB persistence.

See [`docs/TESTES.md`](docs/TESTES.md) for details.

---

## 📜 Licensing and Credits

- **KYRO application shell:** MIT.
- **EmulatorJS 4.2.3:** GPL-3.0.
- **Snes9x libretro core:** GPL-2.0-or-later.

Third-party components retain their respective licenses.

The corresponding source code, build scripts, license notices and required GPL compliance materials must be made available according to the applicable license terms.

- [EmulatorJS](https://github.com/EmulatorJS/EmulatorJS)
- [Snes9x Libretro](https://github.com/libretro/snes9x)
- [EmulatorJS Build](https://github.com/EmulatorJS/build)

See [`web/public/emu/THIRD-PARTY-NOTICES.md`](web/public/emu/THIRD-PARTY-NOTICES.md) for third-party notices.

### Legal Notice

KYRO SNES Port is an independent project and is not affiliated with, endorsed by, or sponsored by Nintendo.

Super Nintendo and SNES are trademarks of their respective owners.

No commercial ROMs, BIOS files, game sprites, music or other copyrighted game assets are distributed with this project.

Users are responsible for ensuring they have the legal right to use any ROM files they import.

---

## 🏢 KaduDev Studios

Developed by **KaduDev Studios**.

Built with passion for software engineering, emulation technology and classic gaming.

**KYRO SNES Port — Classic gaming, reimagined.**

---

<sub>KYRO SNES Port · Version 1.0.0 · © 2026 KaduDev Studios</sub>
