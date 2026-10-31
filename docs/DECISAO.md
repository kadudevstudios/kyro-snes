# Decisão de arquitetura: emulação × reconstrução nativa

## Contexto

O pedido original era um port do jogo para web e Windows, preservando gráficos, áudio, física, colisões, menus, fases e comportamento dos inimigos.

Duas estratégias foram avaliadas conforme o briefing:

- **A. Port nativo / reconstrução** — reescrever a lógica em uma arquitetura moderna, usando recursos extraídos da ROM.
- **B. Emulação** — executar a ROM original em um núcleo SNES confiável, com uma camada de aplicação moderna em volta.

## Comparação

| Critério | A. Reconstrução nativa | B. Emulação |
|---|---|---|
| Fidelidade de gameplay | Depende de reimplementar cada regra | **Total, por construção** |
| Fidelidade visual | Precisa extrair e converter todos os assets | **Total** |
| Fidelidade sonora | Precisa reimplementar o driver de áudio | **Total** |
| Esforço | Meses a anos; dezenas de milhares de linhas de 65816 | Dias |
| Risco de regressão | Alto (física, colisão, IA, timing) | **Nenhum** |
| Distribuição de assets | Exige redistribuir sprites/músicas protegidos | **Não redistribui nada** |
| Situação jurídica | Problemática | **Compatível** (usuário fornece a ROM) |
| Tamanho do binário | Pequeno | ~1,1 MB de núcleo + runtime |
| Portabilidade | Reimplementar por plataforma | **Mesmo build WASM em web e desktop** |
| Manutenção | Código próprio, mas enorme | Runtime maduro e testado |

## Análise jurídica

Um port nativo que "preserve sprites originais, músicas, cenários e fases" implica **redistribuir material protegido da Nintendo** dentro do executável e do build web. Não é uma questão de licença de código: os assets e a expressão do jogo são protegidos, e o próprio briefing pede, na seção 12, para não distribuir assets protegidos sem autorização.

A emulação não redistribui nada: o núcleo é software livre (GPL) e a ROM é fornecida pelo próprio usuário, no dispositivo dele. O produto final separa código de conteúdo, exatamente como pedido.

## Análise técnica

O jogo é um cartucho de 4 Mbit com código 65816 escrito à mão, compressão de gráficos própria (`LC_LZ2`), driver de áudio baseado em samples e um motor de física com colisão por tile e por sprite. Reimplementar isso fielmente não é "portar": é reescrever o jogo inteiro, com risco alto de divergências invisíveis (subpixel, ordem de atualização, RNG, timing de IRQ).

A emulação entrega **100% de fidelidade** com um núcleo de referência mantido há décadas, e permite que todo o esforço de engenharia seja investido no que realmente agrega: experiência de uso moderna.

## Decisão

**Estratégia B — emulação**, com uma camada de aplicação própria:

- runtime **EmulatorJS 4.2.3** auto-hospedado;
- núcleo **snes9x** (libretro) compilado para WebAssembly;
- shell em **TypeScript** com biblioteca, inspeção de ROM, save states, remapeamento, HUD e ajustes;
- **Electron** para o `.exe`, servindo o mesmo build por HTTP local.

## Consequências

**Ganhos**

- Fidelidade integral: é o jogo original, não uma aproximação.
- Web e Windows compartilham o mesmo código de jogo.
- Nenhum asset protegido é distribuído.
- O trabalho de engenharia vai para UX, persistência, controles e robustez.

**Custos**

- O aplicativo **não funciona sem a ROM** do usuário.
- O binário carrega um núcleo de ~1,1 MB e um runtime de ~430 KB.
- O shell não "possui" a lógica do jogo: não é possível, por exemplo, alterar regras de gameplay sem patches de ROM.

## Quando esta decisão mudaria

A reconstrução nativa faria sentido se:

1. o objetivo fosse um jogo **inspirado** no original, com assets próprios e regras próprias; ou
2. houvesse autorização escrita do detentor dos direitos para usar os assets; ou
3. existisse um projeto de decompilação com código-fonte compatível e licença permissiva (por exemplo, um port de código aberto do mesmo jogo) — nesse caso, o port nativo poderia ser construído sobre ele, sem redistribuir assets proprietários.

Nenhuma dessas condições está presente neste projeto.

## O que foi feito da estratégia A

A parte de **engenharia reversa** foi mantida onde é legítima e útil: o aplicativo inclui um inspetor que lê o header do cartucho, valida checksum, calcula SHA-256/CRC-32 e mede entropia por banco. É análise real do binário, integrada ao produto — não documentação morta.

Ver [`ANALISE-ROM.md`](ANALISE-ROM.md).
