# Arquitetura

## Visão geral

```text
┌──────────────────────────────────────────────────────────────────┐
│  Shell (TypeScript)                                              │
│  biblioteca · inspetor · configurações · HUD · save states        │
│                                                                  │
│  ┌────────────────────────┐        postMessage (RPC)             │
│  │  <iframe player.html>  │◄──────────────────────────────┐     │
│  │                        │                               │     │
│  │  EmulatorJS 4.2.3      │   init(rom, settings)         │     │
│  │  └─ snes9x (WASM)      │   pause/resume/restart        │     │
│  │     └─ ROM do usuário  │   saveState/loadState         │     │
│  │                        │   screenshot/setVolume/...    │     │
│  └────────────────────────┘                               │     │
│                                                           │     │
│  IndexedDB: roms · states     localStorage: settings      │     │
└──────────────────────────────────────────────────────────────────┘
```

O emulador vive em um **documento isolado** (`player.html`). O shell conversa com ele por um protocolo RPC pequeno. Isso resolve três problemas de uma vez:

1. **Teardown limpo** — sair do jogo destrói o iframe; o próximo jogo começa em um runtime novo, sem estado residual.
2. **Sem colisão de globais** — EmulatorJS registra muitos listeners e variáveis globais; o isolamento evita conflito com a UI.
3. **Ciclo de vida previsível** — carregar o núcleo WASM duas vezes na mesma página é frágil; recriar o documento é determinístico.

## Módulos

| Módulo | Responsabilidade |
|---|---|
| `core/rom.ts` | Parser do header SNES, checksum, CRC-32, SHA-256, entropia por banco. Puro, sem DOM. |
| `core/archive.ts` | Leitor ZIP mínimo (stored + deflate) via `DecompressionStream`. |
| `core/db.ts` | Wrapper de IndexedDB (`roms`, `states`, `meta`). |
| `core/settings.ts` | Preferências tipadas + normalização (localStorage e importação) + persistência. |
| `core/controls.ts` | 12 botões SNES, padrões, rótulos e conversão para o formato do EmulatorJS. |
| `emulator/protocol.ts` | Contrato de mensagens shell ↔ iframe. |
| `emulator/bridge.ts` | Cliente RPC: correlação por `id`, timeout, eventos, `dispose()`. |
| `player/player.ts` | Dono do runtime dentro do iframe: carrega o núcleo, aplica ajustes, executa comandos. |
| `ui/app.ts` | Shell, roteador por hash, importação, ciclo de vida das telas. |
| `ui/library.ts` | Grade de cartuchos, estado vazio, drag & drop. |
| `ui/inspector.ts` | Relatório técnico da ROM + exportação JSON. |
| `ui/settings.ts` | Vídeo, áudio, jogo, controles, dados (exportar/importar/restaurar) e sobre. |
| `ui/controls.ts` | Tabela de remapeamento (teclado e gamepad). |
| `ui/player.ts` | Palco, HUD, pausa, slots de save, ajustes rápidos, atalhos. |
| `ui/modal.ts`, `ui/toast.ts`, `ui/dom.ts` | Componentes base. |

## Fluxo de importação

```text
File / drop
   │
   ├─ .zip? ──► extractRomFromZip() ──► ArrayBuffer
   │
   ├─ valida tamanho (32 KiB … 16 MiB)
   ├─ stripCopierHeader()  (512 B, se size % 1024 == 512)
   ├─ parseHeader(0x7FC0)  → título, mapping, região, checksum
   ├─ computeChecksum()    → comparação
   ├─ SHA-256              → identidade estável (id)
   └─ IndexedDB.put({ id, data, info, ... })
```

O `id` é o SHA-256: reimportar a mesma ROM é detectado e não duplica.

## Protocolo shell ↔ player

Mensagens são objetos com `kind`. O shell inicia; o player responde.

| Direção | Mensagem | Efeito |
|---|---|---|
| shell → player | `init { rom, gameId, gameName, settings }` | Cria o Blob, configura globais `EJS_*`, injeta `loader.js`. |
| player → shell | `ready` | Runtime montado; botão *Iniciar jogo* disponível. |
| player → shell | `progress { text }` | Texto de carregamento do núcleo (observado no DOM). |
| player → shell | `started` | Jogo rodando (`EJS_onGameStart`). |
| player → shell | `error { message }` | Falha de rede/núcleo. |
| shell → player | `cmd { id, cmd, payload }` | Chamada RPC. |
| player → shell | `reply { id, ok, result }` | Resposta correlacionada. |

Comandos: `pause`, `resume`, `restart`, `saveState`, `loadState`, `screenshot`, `setVolume`, `setMuted`, `setFilter`, `getControls`, `setControl`, `resetControls`, `toggleFullscreen`, `flush`, `fastForward`, `status`.

O `ArrayBuffer` da ROM é **transferido** (zero-copy) para o iframe. Como o shell precisa manter a ROM para a próxima sessão, ele envia `rom.data.slice(0)` — uma cópia — e preserva o original no IndexedDB.

## Save states

```text
F5 ──► bridge.call('saveState')
         └─ player: gameManager.getState()  (Uint8Array)
                    └─ copia + screenshot
         ◄── { data: ArrayBuffer, thumbnail: dataURL }
       └─ IndexedDB.put({ id: `${romId}:${slot}`, ... })
```

A cópia (`new Uint8Array(state)`) é obrigatória: transferir o buffer interno do núcleo o destacaria e quebraria o emulador.

Carregar usa `gameManager.loadState(new Uint8Array(buf))` seguido de `play()`, porque o núcleo pode pausar durante a restauração.

## Escala e proporção

O SNES entrega 256×224 (NTSC, sem entrelaçamento). Escala e proporção são
**ajustes independentes**:

- **Escala inteira** — `s = max(1, min(⌊H/224⌋, ⌊W/(224·a)⌋))`; altura `224s`,
  largura `224s·a`. Cada pixel do jogo vira um bloco exato.
- **Escala ajustar** — `w = min(W, H·a)`; altura `w/a`. Preenche o espaço
  disponível, com interpolação definida pelo filtro.
- **Proporção 8:7** — `a = 8/7`; framebuffer puro, pixels quadrados.
- **Proporção 4:3** — `a = 4/3`; como o console aparecia em TVs de tubo.

O cálculo roda em um `ResizeObserver` no palco, então funciona em janela, tela
cheia e redimensionamento, e também nos ajustes rápidos do HUD.

## SRAM, HUD e saída

A SRAM do cartucho vive no mount `IDBFS` do núcleo (`/data/saves`) e o snes9x só
a grava ao sair. O shell força `gameManager.saveSaveFiles()` em três momentos:

1. ao pausar (antes de qualquer teardown);
2. ao sair do jogo, antes de destruir o iframe;
3. em um timer configurável (`sramAutosave`: 30 s, 1 min ou 2 min).

O HUD esconde após `hudAutoHide` milissegundos (0 = nunca) e reaparece com
qualquer movimento de ponteiro ou tecla — inclusive dentro do iframe, porque o
shell espelha esses eventos no documento do jogo.

Sair do jogo pede confirmação quando `confirmExit` está ligado; o diálogo é o
mesmo `confirmDialog` usado para remover ROM, e o teclado do player é suspenso
enquanto um modal está aberto.

## Pausa, avanço rápido e slots

Ao pausar, o shell mostra o overlay imediatamente, pede `flush` da SRAM e um
`screenshot`; o PNG volta como `data:` URL e entra desfocado atrás do cartão de
pausa. O overlay é escondido antes do RPC de `resume`, então não há atraso
perceptível ao continuar.

O avanço rápido usa `gameManager.toggleFastForward(1|0)` do núcleo. Como nem
toda build expõe a função, o shell consulta `fastForward` no boot: se
`supported` for `false`, o botão do HUD fica oculto e o atalho `F` apenas
informa. O estado é desligado ao pausar ou reiniciar.

Os slots de save state mostram a miniatura grande e pedem confirmação para
sobrescrever ou apagar. `ui/modal.ts` mantém uma **pilha**: o diálogo de
confirmação abre por cima da lista de slots, que continua montada e se
atualiza depois — e só o modal do topo responde a `Esc`.

## Controles

O EmulatorJS guarda os vínculos em `EJS_emulator.controls[player][botão] = { value, value2 }`:

- `value` — `KeyboardEvent.keyCode` numérico;
- `value2` — rótulo do gamepad (`BUTTON_1`, `DPAD_UP`, …).

O shell mantém a fonte de verdade em `settings.controls`, injeta via `EJS_defaultControls` no boot e reaplica após `started` (o runtime pode ter carregado preferências antigas do localStorage). Cada remapeamento chama `setControl` + `saveSettings()` no iframe.

A ordem dos botões é a do RetroArch: `0=B, 1=Y, 2=Select, 3=Start, 4..7=direcional, 8=A, 9=X, 10=L, 11=R`.

## Desktop

```text
Electron main
  ├─ createServer(desktop/app)  → http://127.0.0.1:<porta efêmera>
  ├─ BrowserWindow(contextIsolation, sandbox, sem nodeIntegration)
  └─ preload → window.kyroDesktop { isDesktop, platform, versions }
```

Por que um servidor HTTP local em vez de `file://`:

- módulos ES exigem origem HTTP;
- `fetch()` do WASM/`.data` falha em `file://`;
- o EmulatorJS usa `fetch` para o núcleo e para o JSON de localização.

A porta é efêmera (`listen(0)`), o bind é em `127.0.0.1` e a navegação para fora dessa origem é bloqueada. O `static-server.js` também é usado pelos testes, garantindo que teste e produção servem os mesmos bytes.

Empacotamento: `electron-builder --win portable` gera um único `.exe` x64 (alvo `portable`, sem instalador).

## Desempenho

- Núcleo snes9x em WebAssembly, renderizador WebGL — 60 fps estáveis em hardware modesto.
- O canvas é dimensionado pelo iframe; não há upscale em CPU no shell.
- `backgroundThrottling: false` no Electron evita que o jogo congele ao perder foco.
- O runtime é servido com `Cache-Control: max-age=31536000` para `.data`/`.wasm`.

## Segurança

- Nenhuma requisição de rede em tempo de execução: runtime, núcleo e localização são auto-hospedados.
- Nenhum dado sai do dispositivo; ROM e saves ficam em IndexedDB.
- Electron com `contextIsolation`, `sandbox` e sem `nodeIntegration`.
- O parser de ROM e o leitor de ZIP operam sobre `ArrayBuffer` com limites verificados (sem `eval`, sem execução de dados da ROM).
