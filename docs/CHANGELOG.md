# Changelog

Todas as mudanças relevantes do Kyro SNES Port. Formato baseado em
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versionamento
semântico.

## [1.1.0] — 2026-10-31

### Adicionado

- **Avanço rápido** no player (botão no HUD e tecla `F`), ativado apenas quando
  o núcleo expõe `toggleFastForward`; o HUD marca o estado com `aria-pressed`.
- **Snapshot na pausa**: o quadro atual é capturado antes de pausar e aparece
  desfocado atrás do cartão de pausa.
- **Confirmação ao sobrescrever ou apagar** um save state, com o nome do slot.
- **Miniaturas maiores** nos slots (128×96, 96×72 em telas estreitas) e realce
  no hover.
- **Modais empilháveis**: o diálogo de confirmação abre sobre a lista de slots
  sem fechá-la; só o modal do topo responde a `Esc`.
- **Cursor escondido** junto com o HUD, para não atrapalhar o jogo.
- Changelog e licença MIT no repositório.

### Corrigido

- `confirmDialog` resolvia `false` antes do clique de confirmação, o que impedia
  remover ROMs e confirmar a saída do jogo.
- `openModal` fechava o modal anterior ao abrir uma confirmação, fazendo a lista
  de slots desaparecer.
- Screenshot da pausa saía preto: a captura agora usa o caminho `retroarch` do
  núcleo (o buffer WebGL não é legível fora do quadro).

### Alterado

- Configurações ganharam proporção separada da escala (8:7 ou 4:3).
- HUD configurável, save automático da SRAM, confirmação ao sair, tom de teste,
  exportar/importar configurações e restaurar padrões.
- Dois botões "Restaurar padrões" foram desambiguados ("Restaurar controles").

## [1.0.0] — 2026-10-30

### Adicionado

- Biblioteca local de ROMs com identificação pelo header e inspeção técnica
  (região, mapeamento, checksum, SHA-256, entropia).
- Player com núcleo snes9x em WebAssembly auto-hospedado, escala inteira ou
  ajustada, filtro, scanlines e tela cheia.
- Save states em 3 slots com miniatura e persistência em IndexedDB.
- Remapeamento de teclado e gamepad, pausa automática ao perder o foco.
- Build web estática e executável Windows portátil.
- Suíte e2e com Playwright e análise de pixels.
