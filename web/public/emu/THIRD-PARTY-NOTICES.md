# Avisos de terceiros — runtime do emulador

Este diretório contém o runtime de emulação que o Kyro SNES Port carrega
localmente (nenhuma CDN é usada em tempo de execução). Os arquivos abaixo **não
foram modificados**; são redistribuídos como publicados pelos projetos de
origem.

A ROM não é distribuída com este software. O aplicativo só executa arquivos que
o próprio usuário importa, e o usuário é o único responsável por ter autorização
para usá-los.

---

## 1. EmulatorJS 4.2.3 — GNU GPL v3.0

| Arquivo | Origem |
|---|---|
| `loader.js` | `https://cdn.emulatorjs.org/stable/data/loader.js` |
| `emulator.min.js` | `https://cdn.emulatorjs.org/stable/data/emulator.min.js` |
| `emulator.min.css` | `https://cdn.emulatorjs.org/stable/data/emulator.min.css` |
| `localization/pt-BR.json` | `https://cdn.emulatorjs.org/stable/data/localization/pt-BR.json` |
| `compression/extract7z.js` | `https://cdn.emulatorjs.org/stable/data/compression/extract7z.js` |

- Projeto: <https://github.com/EmulatorJS/EmulatorJS>
- Licença: GNU General Public License, versão 3 — <https://www.gnu.org/licenses/gpl-3.0.html>
- Texto completo da licença: <https://github.com/EmulatorJS/EmulatorJS/blob/main/LICENSE>
- Versão empacotada: **4.2.3** (canal `stable` no momento da vendorização)

O EmulatorJS é um front-end que carrega núcleos libretro compilados para
WebAssembly. Ele é distribuído sob GPL-3.0; por isso esta aplicação também
distribui o runtime como software livre, sem alterações, e disponibiliza o
código-fonte correspondente conforme a seção 6 da licença.

---

## 2. Núcleo snes9x (libretro, build WebAssembly) — GNU GPL v2.0 ou posterior

| Arquivo | Origem |
|---|---|
| `cores/snes9x-wasm.data` | pacote npm `@emulatorjs/core-snes9x@4.2.3` |
| `cores/snes9x-legacy-wasm.data` | pacote npm `@emulatorjs/core-snes9x@4.2.3` |
| `cores/reports/snes9x.json` | pacote npm `@emulatorjs/core-snes9x@4.2.3` |

- Núcleo upstream: <https://github.com/libretro/snes9x>
- Snes9x: <https://www.snes9x.com/>
- Scripts de build usados para gerar os `.data`: <https://github.com/EmulatorJS/build>
- Licença do Snes9x: GNU GPL, versão 2 ou posterior — <https://github.com/libretro/snes9x/blob/master/LICENSE>
- Build reportado pelo próprio pacote: `2025-06-14T17:58:11+00:00` →
  `2025-06-14T18:09:21+00:00` (ver `cores/reports/snes9x.json`)

Os arquivos `.data` são archives 7z contendo o módulo `.wasm`, o `.js` de
carregamento e os metadados do núcleo. Eles são extraídos em memória pelo
`compression/extract7z.js` do próprio EmulatorJS.

O Kyro SNES Port **não** contém BIOS, ROMs, texturas, músicas ou qualquer outro
ativo protegido de console. O núcleo é um emulador: ele interpreta o cartucho
fornecido pelo usuário em tempo de execução.

---

## 3. Oferta escrita de código-fonte (GPL)

Como este pacote redistribui binários cobertos pela GPL (EmulatorJS e o núcleo
snes9x), o código-fonte correspondente está disponível publicamente nos
endereços acima, nas versões indicadas. Adicionalmente, mediante solicitação
por escrito ao mantenedor deste pacote, será fornecido o código-fonte
correspondente exato — incluindo os scripts de build usados para produzir os
arquivos `.data` — por no mínimo três anos a partir da data de distribuição,
pelo custo de mídia e envio, ou por download.

Solicitações devem ser abertas no repositório do projeto.

---

## 4. Dependências de build (não redistribuídas no pacote final)

| Pacote | Licença | Uso |
|---|---|---|
| TypeScript | Apache-2.0 | Compilação |
| Vite | MIT | Build do front-end |
| Playwright | Apache-2.0 | Testes end-to-end |
| Electron 45.1.0 | MIT | Aplicativo desktop |
| electron-builder 26.18.0 | MIT | Empacotamento do `.exe` |

O executável Electron inclui o runtime Chromium/Node.js, cujos avisos de
licença são os do próprio Electron (`LICENSE` e `LICENSES.chromium.html` dentro
de `resources/`).
