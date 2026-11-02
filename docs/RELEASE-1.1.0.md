# Kyro SNES Port 1.1.0

Player mais confortável, captura de tela confiável e correções de diálogos.

## Novidades

- **Avanço rápido** — botão no HUD e tecla `F`, com estado visível. O botão só
  aparece quando o núcleo oferece o recurso.
- **Pausa com snapshot** — o quadro atual aparece desfocado atrás do cartão de
  pausa, em vez de uma tela preta.
- **Slots melhores** — miniaturas maiores, confirmação antes de sobrescrever ou
  apagar e a lista continua aberta depois de confirmar.
- **Cursor escondido** junto com o HUD, sem atrapalhar o jogo.
- **`docs/CHANGELOG.md`** e licença MIT no repositório.

## Correções

- **Diálogos de confirmação** funcionavam ao contrário: o modal fechava antes do
  clique, então a resposta era sempre "cancelar". Remover ROM e sair do jogo
  agora funcionam de verdade.
- **Modais empilhados** — abrir uma confirmação sobre a lista de slots não a
  fecha mais; só o diálogo do topo responde a `Esc`.
- **Screenshot/pausa preto** — a captura agora acontece com o jogo rodando e
  repete até obter um quadro com pixels reais.

## Configurações (desde 1.0.0)

- Escala (inteira/ajustar) e proporção (8:7/4:3) independentes.
- HUD configurável, confirmação ao sair, save automático da SRAM
  (desligado/30 s/1 min/2 min).
- Tom de teste de áudio, exportar/importar configurações e restaurar padrões.

## Instalação

- **Windows:** baixe `Kyro-SNES-Port-1.1.0.exe` e execute. É portátil, não
  instala nada. O binário não é assinado; o SmartScreen pode pedir confirmação.
- **Web:** jogue em <https://kadudevstudios.github.io/kyro-snes/> ou hospede o
  conteúdo de `web/dist` em qualquer servidor HTTP.

Nenhuma ROM é distribuída. Importe o arquivo que você já possui; ele fica
apenas no seu dispositivo.

## Verificação

- `tsc --noEmit` e `vite build` sem erros.
- 39/39 verificações e2e em Chrome real com o núcleo snes9x em WebAssembly.
- Smoke test do `.exe` empacotado com código de saída 0.

Detalhes em `docs/TESTES.md` e `docs/CHANGELOG.md`.

## Requisitos

Windows 10/11 x64 · navegador com WebAssembly e WebGL.

---

**Créditos:** EmulatorJS 4.2.3 (GPL-3.0) e núcleo snes9x (GPL-2.0+) — avisos
completos em `web/public/emu/THIRD-PARTY-NOTICES.md`. Super Mario World e os
assets do jogo pertencem à Nintendo.
