# Análise da ROM

Investigação estática do arquivo fornecido (`ROMS/1.zip` → `Super Mario World (U) [!].smc`).

Toda a análise foi feita **somente leitura**, sobre uma cópia em área de trabalho. O arquivo original não foi alterado.

---

## 1. Identificação do arquivo

| Propriedade | Valor |
|---|---|
| Nome | `Super Mario World (U) [!].smc` |
| Tamanho do arquivo | 524.800 bytes |
| Header de copier | **presente** — 512 bytes (`0x200`) |
| Payload da ROM | 524.288 bytes = **4 Mbit** |
| SHA-256 (arquivo completo) | `d70c9c7716ad12c674fc7dd744736aa48d4d7b4237f58066be620fda26024872` |
| CRC-32 | `A31BEAD4` |

O `.smc` com 512.800 bytes é o formato clássico de dump com header de copier. O header foi descartado antes de qualquer leitura de estrutura; todas as compensações abaixo referem-se ao **payload** (a ROM em si).

```
0x000000 ┌──────────────────────────┐
         │ header de copier (512 B) │  descartado
0x000200 ├──────────────────────────┤
         │ banco 00                 │  $00:8000–$00:FFFF
         │ ...                      │
0x07FC0  │ header interno           │  título, mapping, checksum
0x07FE0  ├──────────────────────────┤
         │ vetores 65816            │
0x080000 └──────────────────────────┘  32 bancos × 16 KiB
```

---

## 2. Header interno (`0x7FC0`)

| Campo | Offset | Bytes | Interpretação |
|---|---|---|---|
| Título | `0x7FC0` | 21 | `SUPER MARIOWORLD` |
| Map mode | `0x7FD5` | 1 | `0x20` → **LoROM**, sem FastROM |
| Tipo de cartucho | `0x7FD6` | 1 | `0x02` → ROM + RAM + bateria |
| Tamanho da ROM | `0x7FD7` | 1 | `0x09` → 512 KiB |
| Tamanho da SRAM | `0x7FD8` | 1 | `0x01` → 2 KiB |
| Região | `0x7FD9` | 1 | `0x01` → EUA / Canadá (NTSC) |
| Licenciado | `0x7FDA` | 1 | `0x01` |
| Versão | `0x7FDB` | 1 | `1.0` |
| Checksum | `0x7FDC` | 2 | `0x5F25` |
| Complemento | `0x7FDE` | 2 | `0xA0DA` |

### Por que LoROM importa

Em LoROM, cada banco de 16 KiB aparece em `$xx:8000–$xx:FFFF`; os 32 KiB inferiores de cada banco de 64 KiB ficam espelhados ou reservados. É o mapeamento usado pela maioria dos cartuchos de 4 Mbit — inclusive este.

---

## 3. Vetores de interrupção (banco 0)

| Vetor | Endereço | Valor |
|---|---|---|
| Reset emulation | `0x7FFC` | `$00:82C3` |
| Reset native | `0x7FFA` | `$00:8000` |
| NMI native | `0x7FEA` | `$00:816A` |
| IRQ native | `0x7FEE` | `$00:8374` |

O vetor nativo aponta para `$8000`, o início do banco 0 — típico de um vetor de entrada que salta para a rotina de inicialização real. O vetor de emulação (`$82C3`) fica na região de boot usada quando o cartucho é iniciado no modo 6502-compatível.

---

## 4. Checksum

| Medida | Valor |
|---|---|
| Checksum declarado | `0x5F25` |
| Complemento declarado | `0xA0DA` |
| Par válido (`cks ^ comp == 0xFFFF`) | **sim** |
| Soma de bytes calculada¹ | `0x9EDC` |
| Confere? | **não** |

¹ Soma de todos os bytes do payload, exceto os quatro bytes do próprio campo de checksum, truncada em 16 bits.

O par declarado é internamente consistente, mas o valor não corresponde à soma real do payload. Isso **não impede a execução**: o núcleo não valida esse campo para rodar o jogo. Dumps com header de copier e patches de tradução frequentemente apresentam essa divergência.

O aplicativo exibe esse resultado como **"divergente"** no inspetor, sem bloquear o uso — é informação, não um erro de importação.

---

## 5. Estrutura e entropia

32 bancos de 16 KiB. Entropia de Shannon por banco (bits/byte):

| Banco | Entropia | Banco | Entropia | Banco | Entropia | Banco | Entropia |
|---|---|---|---|---|---|---|---|
| B00 | 7,07 | B08 | 6,66 | B16 | 6,40 | B24 | 7,01 |
| B01 | 6,96 | B09 | 6,53 | B17 | 6,69 | B25 | 6,81 |
| B02 | 6,97 | B10 | 7,00 | B18 | 6,54 | B26 | 6,68 |
| B03 | 6,89 | B11 | 5,75 | B19 | 6,53 | B27 | 6,13 |
| B04 | 6,93 | B12 | 7,38 | B20 | 6,57 | B28 | 6,99 |
| B05 | 6,87 | B13 | 6,20 | B21 | 6,61 | B29 | 5,53 |
| B06 | 6,66 | B14 | 7,18 | B22 | 6,75 | B30 | 6,71 |
| B07 | 6,57 | B15 | 6,43 | B23 | 6,23 | B31 | 5,70 |

Leitura:

- **B12 (7,38)** e **B14 (7,18)** são os mais densos — compatíveis com gráficos comprimidos e código.
- **B29 (5,53)**, **B31 (5,70)** e **B11 (5,75)** são os mais esparsos — tabelas, padding ou dados repetitivos.
- Não há banco vazio: os 32 bancos estão em uso.
- Os 256 valores de byte possuem ao menos uma ocorrência no payload.

Essa medição é heurística: entropia alta indica compressão ou código, não identifica o formato por si só.

---

## 6. O que **não** foi extraído

Para deixar explícito o escopo:

- Não foram extraídos sprites, tilesets, paletas, mapas, músicas ou efeitos sonoros.
- Não foi feita desmontagem completa do código 65816.
- Não há engenharia reversa de física, colisão ou IA neste repositório.

O motivo é técnico e jurídico, e está detalhado em [`DECISAO.md`](DECISAO.md): reconstruir o jogo exigiria redistribuir assets protegidos da Nintendo e reimplementar manualmente um sistema de 1990 com dezenas de milhares de linhas de assembly. A alternativa escolhida — executar a ROM original em um núcleo de referência — entrega fidelidade de 100% sem redistribuir nada.

---

## 7. Reproduzir a análise

O script usado está em `work/analyze.py` (fora do pacote de entrega) e a mesma lógica foi portada para TypeScript em `web/src/core/rom.ts`, que alimenta a tela **Inspecionar** do aplicativo.

Para conferir pelo próprio app: importe a ROM, clique no ícone de chip no cartão e compare os valores desta página com os exibidos.
