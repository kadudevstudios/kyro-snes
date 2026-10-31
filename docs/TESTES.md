# Testes e validação

Todos os números abaixo vêm de execuções reais do build de produção, com a ROM
fornecida pelo usuário, em Chrome headless (SwiftShader) via Playwright.

---

## 1. Como reproduzir

```powershell
cd web
npm install
npm run build            # tsc --noEmit + vite build

cd ..\tests
npm install
$env:KYRO_TEST_ROM = "C:\caminho\para\sua\rom.smc"
node run-e2e.mjs
```

Saída esperada: uma linha `PASS`/`FAIL` por verificação, as requisições feitas ao
runtime e o total (`39/39 verificações passaram.`). Código de saída `0` em caso
de sucesso.

Artefatos gerados em `tests/artifacts/`:

| Arquivo | Conteúdo |
|---|---|
| `01-library.png` | Biblioteca com a ROM importada |
| `02-inspector.png` | Relatório técnico do cartucho |
| `03-gameplay.png` | Canvas do núcleo rodando o jogo |
| `03b-after-start.png` | Tela após pressionar Start |
| `04-paused.png` | Overlay de pausa |
| `05-settings.png` | Tela de configurações |
| `desktop-app.png` | Janela do `.exe` empacotado rodando o jogo |
| `e2e-log.txt` | Log completo da execução |

---

## 2. O que é verificado

### Shell e biblioteca

| # | Verificação | Como |
|---|---|---|
| 1 | App shell monta | `.topbar` e marca visíveis |
| 2 | Estado vazio aparece | `.empty` visível antes de importar |
| 3 | ROM importada e identificada | Título interno lido do header == `SUPER MARIOWORLD` |
| 4 | Metadados na UI | Cartão mostra `LoROM` |

### Inspeção da ROM

| # | Verificação | Como |
|---|---|---|
| 5 | Mapping | Texto do inspetor contém `LoROM` |
| 6 | Região | Contém `EUA` |
| 7 | SHA-256 | Regex de 64 hex no relatório |

### Player e núcleo

| # | Verificação | Como |
|---|---|---|
| 8 | iframe do player carregou | Frame `player.html` presente |
| 9 | Botão de iniciar presente | `.ejs_start_button` visível |
| 10 | Núcleo iniciou o jogo | Status do HUD == `Em execução` |
| 11 | Canvas renderiza imagem | > 40 cores distintas no screenshot do canvas |
| 12 | Quadro não está vazio | > 8% dos pixels não-pretos |
| 13 | Resolução nativa | Canvas ≥ 256×224 |
| 14 | Núcleo servido localmente | `200 /emu/cores/snes9x-legacy-wasm.data` |
| 15 | Entrada chega ao console | Start muda a tela (diferença de pixels) |

### Sessão

| # | Verificação | Como |
|---|---|---|
| 16 | Pausa funciona | `Esc` mostra `.pause-overlay` |
| 17 | Snapshot na pausa | `.pause-overlay__shot` recebe um `src` `data:image/...` |
| 18 | Retomada funciona | Botão *Continuar* esconde o overlay |
| 19 | Avanço rápido disponível | Botão aparece quando o núcleo expõe `toggleFastForward` |
| 20 | Avanço rápido liga | Clique → `aria-pressed="true"` e classe `is-active` |
| 21 | Avanço rápido desliga | Segundo clique → `aria-pressed="false"` |
| 22 | Save state grava | Toast `Estado salvo no slot 1.` |
| 23 | Estado persistido | `count()` do object store `states` ≥ 1 |
| 24 | Save state carrega | Toast `Estado do slot 1 carregado.` |
| 25 | Confirmação de sobrescrita | Botão *Sobrescrever* abre o diálogo "Sobrescrever slot?" |
| 26 | Sobrescrita grava | Toast `Estado salvo no slot 1.` após confirmar |
| 27 | Lista de slots permanece | O diálogo de slots continua aberto depois de confirmar |
| 28 | HUD reaparece | Mover o mouse sobre o iframe remove `is-hidden` |
| 29 | Proporção 4:3 aplicada | `4:3` nos ajustes rápidos → frame com razão 1,333 |
| 30 | Confirmação ao sair | Clicar em *Sair do jogo* abre o diálogo |
| 31 | Volta para a biblioteca | Grade de ROMs visível após confirmar |

### Configurações e dados

| # | Verificação | Como |
|---|---|---|
| 32 | Tela de configurações | Controles segmentados visíveis |
| 33 | Opção de proporção presente | Texto da tela contém `Proporção` |
| 34 | Save automático configurável | Texto contém `Save automático do jogo` |
| 35 | Dados exportáveis | Botões *Exportar* e *Importar* presentes |
| 36 | Exporta configurações | `download` com nome `kyro-snes-config.json` |
| 37 | Restaurar padrões | Volume alterado para 20% volta a 70% |
| 38 | Remoção de ROM funciona | Confirma no diálogo e a biblioteca fica vazia |
| 39 | Sem erros de console | Nenhum `pageerror`/`console.error` (fora 404 de favicon) |

---

## 3. Resultado da última execução

```
PASS  app shell monta
PASS  estado vazio aparece
PASS  ROM importada e identificada  — título="SUPER MARIOWORLD"
PASS  metadados do header na UI
PASS  inspetor mostra mapping
PASS  inspetor mostra região
PASS  inspetor mostra SHA-256
PASS  iframe do player carregou
PASS  botão de iniciar presente
PASS  núcleo iniciou o jogo
PASS  canvas renderiza imagem  — 42 cores
PASS  quadro não está vazio  — 80.1% não-preto
PASS  resolução nativa do núcleo  — 1024×896
PASS  núcleo snes9x servido localmente  — 200 /emu/cores/snes9x-legacy-wasm.data
PASS  entrada (Start) chega ao console  — 30.3% dos pixels mudaram
PASS  pausa funciona
PASS  pausa mostra snapshot do jogo  — 68.7% não-preto
PASS  retomada funciona
PASS  avanço rápido disponível no núcleo
PASS  avanço rápido liga  — aria-pressed=true
PASS  avanço rápido desliga
PASS  save state grava  — Estado salvo no slot 1.
PASS  estado persistido no IndexedDB  — 1 estado(s)
PASS  save state carrega  — Estado do slot 1 carregado.
PASS  pede confirmação ao sobrescrever slot
PASS  sobrescrever slot grava  — Estado salvo no slot 1.
PASS  lista de slots continua aberta
PASS  HUD reaparece ao mover o mouse
PASS  proporção 4:3 aplicada  — 1.334
PASS  confirmação ao sair aparece
PASS  volta para a biblioteca
PASS  tela de configurações
PASS  opção de proporção presente
PASS  save automático configurável
PASS  dados exportáveis
PASS  exporta configurações  — kyro-snes-config.json
PASS  restaurar padrões volta ao default  — volume=70
PASS  remoção de ROM funciona
PASS  sem erros de console

39/39 verificações passaram.
```

Requisições observadas (todas locais, nenhuma CDN):

```
200 /emu/loader.js
200 /emu/emulator.min.js
200 /emu/emulator.min.css
200 /emu/localization/pt-BR.json
200 /emu/cores/reports/snes9x.json
200 /emu/cores/snes9x-legacy-wasm.data
200 /emu/compression/extract7z.js
```

O núcleo escolhido é o **legacy** porque o EmulatorJS usa `webgl2Enabled = null`
por padrão (renderizador legado). Os dois núcleos são servidos; habilitar WebGL2
nas configurações do runtime troca para `snes9x-wasm.data`.

---

## 4. Verificação visual

`03b-after-start.png` mostra a tela de seleção de arquivo do jogo
(`MARIO A ... EMPTY`, `MARIO B ... EMPTY`, `MARIO C ... EMPTY`, `ERASE DATA`),
alcançada pressionando Start. Isso confirma, além da mudança de pixels, que:

- o núcleo executou o jogo real (não um placeholder);
- o teclado atravessou o iframe e chegou ao console emulado;
- o mapeamento `Enter → Start` está correto.

`03-gameplay.png` mostra a tela de título com o logo, o sprite do Mario e o
copyright `1990-1991 Nintendo` renderizados pelo núcleo.

### Bug encontrado pelos novos testes

O teste de confirmação de saída revelou que `confirmDialog` sempre resolvia
`false`: o `openModal` fechava o diálogo (disparando `onClose` → "cancelar")
antes de executar o `onClick` do botão de confirmar. A ordem foi corrigida em
`ui/modal.ts` — a ação roda primeiro e o modal fecha em seguida, em `finally`.
Isso também consertou a remoção de ROM no inspetor, que nunca apagava nada.
A verificação 38 cobre exatamente esse caminho.

Um segundo problema apareceu no teste de sobrescrita de slot: `openModal`
fechava o modal anterior ao abrir o diálogo de confirmação, então a lista de
slots desaparecia antes de o save ser gravado. `ui/modal.ts` agora mantém uma
**pilha de modais**; o diálogo do topo é o único que responde a `Esc` e a lista
sobrevive à confirmação (verificação 27).

O terceiro foi visual: o PNG da pausa saía preto. O canvas WebGL é limpo logo
após a composição, então a leitura pode cair em um buffer vazio. A captura agora
acontece **com o jogo rodando** (antes do `pause`) e, se a amostra 32×24 vier
toda preta, tenta de novo até 5 vezes — o mesmo caminho usado pelo botão de
câmera. A verificação 17 mede os pixels do snapshot (> 2% não-preto), não só a
presença do `data:` URL.

---

## 5. Testes manuais realizados

| Item | Resultado |
|---|---|
| Build de produção (`npm run build`) | OK, `tsc` sem erros |
| `npx electron . --smoke-test` | `SMOKE OK port=57807`, exit 0 |
| Executável portátil | gerado e executado — ver §6 |
| Importação de `.zip` | OK (o arquivo fornecido é um ZIP) |
| Reimportação da mesma ROM | detectada pelo SHA-256, sem duplicar |
| Tela cheia | entra e sai; escala recalculada no `fullscreenchange` |
| Redimensionamento | `ResizeObserver` recalcula o frame |
| Persistência de configurações | recarregar a página mantém volume, escala, proporção, HUD, autosave e controles |
| Pausa automática ao perder foco | ativa, com guarda de 300 ms para não pausar ao focar o iframe |
| Tom de teste de áudio | toca arpeggio de 3 notas; avisa quando o áudio está silenciado |

---

## 6. Executável portátil (Windows)

| Item | Resultado |
|---|---|
| Build | `npx electron-builder --win portable` — exit 0 |
| Artefato | `desktop/release/Kyro-SNES-Port-1.0.0.exe` — 112.621.288 bytes (107,4 MiB) |
| Conteúdo | `app.asar` com os 16 arquivos do build web (2,89 MiB), incluindo `emu/THIRD-PARTY-NOTICES.md` |
| Smoke | `Kyro-SNES-Port-1.0.0.exe --smoke-test` — **exit code 0** |

O smoke do executável empacotado sobe o servidor HTTP em porta efêmera
(loopback), abre uma janela oculta apontando para ele e espera até que
`window.kyroApp` exista e o `.topbar` esteja no DOM. Exit 0 significa que o
shell real montou dentro do binário final, não apenas que o processo abriu.
O launcher portátil não anexa stdout, então a evidência usada é o código de
saída (o log `SMOKE OK port=…` aparece ao rodar via `npx electron .`).

Além do smoke, a janela do executável foi capturada com o jogo em execução
(`tests/artifacts/desktop-app.png`): tela de título do Super Mario World
renderizada pelo núcleo dentro do binário final, com o servidor estático em
`127.0.0.1` em porta efêmera.

---

## 7. Limites dos testes

- **Não há comparação pixel a pixel com um SNES real.** A referência é o próprio
  núcleo snes9x, que é o padrão de emulação do console; um teste diferencial
  exigiria captura de hardware ou de um segundo emulador, o que não acrescentaria
  garantia sobre a fidelidade do jogo.
- **Gamepad físico** não é exercitado no CI (não há dispositivo no ambiente de
  teste). O caminho de código é o do EmulatorJS, com a atribuição de jogador
  feita explicitamente pelo shell (`syncGamepad`), porque o menu interno do
  runtime — que normalmente faz essa atribuição — está oculto.
- **SRAM** (save do próprio jogo) é gravada no mount `IDBFS` do núcleo e
  flushing explícito é solicitado na pausa e na saída. O teste automatizado cobre
  save states do shell; o save do jogo depende de chegar a um ponto de salvamento
  no jogo.
- **Áudio** é executado com `--mute-audio` no Chrome headless; a cadeia
  Web Audio é inicializada, mas não é medida.
- **Executável não assinado.** Não há certificado de code signing configurado,
  então o Windows pode exibir o aviso do SmartScreen na primeira execução
  ("Windows protegeu o seu PC" → *Mais informações* → *Executar assim mesmo*).
  Assinar exigiria um certificado próprio; o build em si não é afetado.
