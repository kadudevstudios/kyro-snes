# Kyro SNES Port

Um port jogável de um jogo de Super Nintendo para **navegador** e **Windows**, com fidelidade total ao original — porque o jogo roda no núcleo **snes9x** compilado para WebAssembly, em vez de uma reimplementação.

> **Nenhuma ROM é distribuída com este projeto.** O aplicativo não contém o jogo. Você importa o arquivo que já possui; ele é lido no seu dispositivo e guardado apenas nele.

**Download:** [Releases](https://github.com/kadudevstudios/kyro-snes/releases) — executável portátil para Windows e código-fonte.

---

## O que é isto

Um **shell moderno** em volta de um núcleo de emulação SNES de referência:

- biblioteca local de ROMs, com inspeção técnica do cartucho;
- player com escala inteira ou ajustada, proporção 8:7 ou 4:3, filtro, scanlines, HUD próprio e avanço rápido;
- save states em 3 slots com miniatura, persistidos em IndexedDB;
- remapeamento de teclado e gamepad;
- configurações de áudio (com tom de teste), HUD, save automático da SRAM, exportar/importar e restaurar padrões;
- build web estática e executável Windows `.exe` (versão **1.1.0**).

A decisão de arquitetura (emulação × reconstrução nativa) está documentada em [`docs/DECISAO.md`](docs/DECISAO.md).

---

## Requisitos

| Plataforma | Requisitos |
|---|---|
| Web | Navegador moderno com WebAssembly e WebGL (Chrome/Edge/Firefox/Safari recentes) |
| Windows | Windows 10/11 x64 |
| Desenvolvimento | Node.js 20+ e npm |

---

## Começar rápido

### Web (desenvolvimento)

```bash
cd web
npm install
npm run dev
```

Abra `http://localhost:5173`, arraste sua ROM (`.smc`, `.sfc`, `.fig`, `.bin` ou `.zip`) e clique em **Jogar**.

### Web (build de produção)

```bash
cd web
npm install
npm run build      # gera web/dist
npm run preview    # serve o build em http://localhost:4173
```

O conteúdo de `web/dist` é estático e pode ser hospedado em qualquer servidor HTTP (Netlify, Vercel, nginx, GitHub Pages). **Não abra via `file://`**: módulos ES e o carregamento do WASM exigem HTTP.

### Windows (.exe)

```bash
powershell -ExecutionPolicy Bypass -File scripts/build-all.ps1
```

O executável portátil é gerado em `desktop/release/Kyro-SNES-Port-1.1.0.exe` (~107 MiB). O binário não é assinado, então o SmartScreen pode pedir confirmação na primeira execução.

Para rodar em modo de desenvolvimento:

```bash
cd desktop
npm install
npm start
```

> **Nota sobre npm 11+:** a política de `allow-scripts` pode bloquear o postinstall do Electron. Se `electron` não baixar o binário, rode `node node_modules/electron/install.js` dentro de `desktop/`.

---

## Como usar

1. **Importar** — arraste a ROM para a janela ou use *Importar ROM*. Arquivos `.zip` são abertos automaticamente.
2. **Inspecionar** — o botão de chip no cartão abre a análise do header (região, mapeamento, checksum, SHA-256, entropia por banco).
3. **Jogar** — clique em *Jogar* e depois em *Iniciar jogo* (o clique é necessário para liberar o áudio no navegador).
4. **Salvar** — `F5` grava o estado no slot 1; `F8` carrega. A interface tem 3 slots com miniatura.

### Atalhos

| Tecla | Ação |
|---|---|
| `Esc` | Pausar / retomar (ou sair da tela cheia) |
| `F` | Ligar/desligar avanço rápido |
| `F5` | Salvar estado no slot 1 |
| `F8` | Carregar estado do slot 1 |
| `F11` | Tela cheia |
| `M` | Silenciar |

Mapeamento padrão do controle SNES:

| SNES | Teclado | Gamepad |
|---|---|---|
| D-pad | Setas | D-pad / analógico |
| A | `X` | Botão 1 |
| B | `Z` | Botão 2 |
| X | `S` | Botão 3 |
| Y | `A` | Botão 4 |
| L / R | `Q` / `W` | LB / RB |
| Start | `Enter` | Start |
| Select | `Tab` | Select |

Tudo pode ser remapeado em **Configurações → Controles** (ou nos ajustes rápidos durante o jogo).

---

## Funcionalidades

- **Biblioteca local** com identificação automática pelo header interno (título, região, mapeamento, tamanho, checksum).
- **Inspeção técnica** da ROM: header em `0x7FC0`, par de checksum, SHA-256, CRC-32, entropia por banco de 16 KB, detecção de header de copier.
- **Player** com escala inteira ou ajustada, proporção 8:7/4:3, filtro nítido/suave, scanlines opcionais, tela cheia, HUD que se esconde sozinho e avanço rápido.
- **Pausa** com captura do quadro atual ao fundo, retomada, reinício e saída.
- **Save states** de 3 slots com miniatura grande, confirmação antes de sobrescrever/apagar, mais o SRAM do próprio jogo (salvos de fase).
- **Controles**: teclado, gamepad (Gamepad API) e toque em dispositivos móveis.
- **Persistência** em IndexedDB/localStorage — nada sai do dispositivo.
- **Pausa automática** ao perder o foco (configurável).

---

## Estrutura

```text
KYRO-SNES-PORT/
├── docs/
│   ├── ANALISE-ROM.md        # engenharia reversa do cartucho fornecido
│   ├── ARQUITETURA.md        # módulos, fluxo de dados, protocolo
│   ├── DECISAO.md            # emulação × reconstrução nativa
│   ├── CHANGELOG.md          # histórico de versões
│   └── TESTES.md             # o que foi validado e como
├── web/
│   ├── public/emu/           # runtime EmulatorJS + núcleo snes9x (auto-hospedado)
│   ├── src/
│   │   ├── core/             # ROM, IndexedDB, settings, controles, ZIP
│   │   ├── emulator/         # protocolo e bridge (iframe ↔ shell)
│   │   ├── player/           # entrada do iframe do emulador
│   │   ├── ui/               # shell, telas, componentes
│   │   └── styles/
│   ├── index.html
│   ├── player.html
│   └── vite.config.ts
├── desktop/                  # Electron + empacotamento
│   ├── main.js
│   ├── preload.js
│   ├── static-server.js
│   └── build/icon.ico
├── scripts/                  # build e re-vendorização do runtime
├── tests/                    # e2e com Playwright + análise de pixels
└── README.md
```

---

## Limitações conhecidas

- **Não é uma reconstrução nativa.** A lógica do jogo é executada pelo núcleo snes9x; não há código-fonte do jogo neste repositório. Ver [`docs/DECISAO.md`](docs/DECISAO.md).
- **ROM necessária.** Sem o arquivo do jogo, o aplicativo abre apenas a biblioteca vazia.
- **Cheats, netplay e gravação de vídeo** do EmulatorJS estão desativados na interface (o runtime os suporta, mas não foram expostos).
- **WebGL2** não é habilitado por padrão; o núcleo usa o renderizador legado (WebGL1), que é o padrão testado do EmulatorJS e funciona em mais máquinas.
- **Áudio** depende de um gesto do usuário (clique em *Iniciar jogo*), por política dos navegadores.
- **SRAM** (save do próprio jogo) é mantida pelo runtime; save states são geridos pelo shell.

---

## Testes

```bash
cd web && npm run build
cd ../tests && npm install
set KYRO_TEST_ROM=C:\caminho\para\sua\rom.smc
node run-e2e.mjs
```

O teste abre o build real no Chrome, importa a ROM, inicia o núcleo, **analisa os pixels renderizados**, pausa/retoma (verificando o snapshot), alterna o avanço rápido, grava e carrega save states, testa a sobrescrita de slot com confirmação e verifica o IndexedDB. São 39 verificações; resultados em [`docs/TESTES.md`](docs/TESTES.md).

---

## Licenciamento e créditos

- Código do shell: MIT.
- **EmulatorJS 4.2.3** — GPL-3.0 (runtime em `web/public/emu`), sem modificações.
- **snes9x** (núcleo libretro, build WebAssembly do EmulatorJS) — GPL-2.0 ou posterior. O binário é redistribuído sob os termos da GPL; o código-fonte correspondente está em <https://github.com/libretro/snes9x> e os scripts de build em <https://github.com/EmulatorJS/build>.
- Avisos completos, versões exatas e a oferta escrita de código-fonte estão em [`web/public/emu/THIRD-PARTY-NOTICES.md`](web/public/emu/THIRD-PARTY-NOTICES.md) (também publicado em `/emu/THIRD-PARTY-NOTICES.md` no build).
- **Super Mario World** e todos os assets do jogo são propriedade da Nintendo. Este projeto não distribui ROM, BIOS, sprites, músicas nem qualquer material protegido.

Ao usar este software você declara ter autorização para usar a ROM que importar.
