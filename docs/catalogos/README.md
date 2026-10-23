# Catálogos (fontes brutas)

## Fontes atuais

| Arquivo | Origem | Uso |
|---|---|---|
| `gaxetas-raspadores/catalogo-gaxetas-raspadores-2022.pdf` | "catalogo-gaxetas-2022.pdf" | **Gaxetas e raspadores** (ref. 2022, 68 págs.). Índice nas págs. PDF 12–16; tabelas nas págs. 17–65; reparos pneumáticos nas 66–67. Página impressa = página PDF − 16. |
| `retentores/catalogo-retentores-2021.pdf` | "catalogo-retentores-digital2.pdf" | **Retentores** (ref. 2021, 112 págs.). Perfis nas págs. 10–76; referência de mercado nas 77–83; índice "REFERÊNCIA AGEL" (todos os códigos) nas 84–111. |
| `listas/lista-gaxetas-raspadores-2025.pdf` | AGEL 2025 | Código + descrição de gaxetas, raspadores, Polymax, GSK e pneumática. |
| `listas/lista-retentores-2025.pdf` | AGEL 2025 | Código + descrição de retentores. |

As listas 2025 têm só código, descrição, UN e % IPI (sem preço). O script lê apenas código e descrição.

O catálogo 2022 substituiu o APC ref. 02/2019, e as listas 2025 substituíram a lista AGEL 2026. Os dois arquivos antigos continuam no histórico do git.

## Como regenerar os dados

```bash
pip install pdfplumber                     # dependência do script (use um venv)
python -I scripts/ingest_catalogos.py      # gera src/data/catalogo_apc.csv + docs/catalogos/divergencias.md
node scripts/check_units.mjs               # auto-checagem mm ⇄ pol
node scripts/check_busca.mjs               # auto-checagem busca + funil
```

- Novo catálogo ou página: ajustar o manifesto no topo do script (`APLICACOES`, `FICHA`, `DATA_PAGES`, `POLYMAX_PAGES`, `RET_PERFIL_PAGES`, `RET_INDICE_PAGES`).
- O relatório `divergencias.md` lista:
  - mudanças em relação ao CSV do último commit (saíram, entraram, campos alterados)
  - código × valor impresso
  - duplicados
  - retentores: índice × páginas de perfil
  - mesmo código nos dois catálogos
  - sobreposição com as CSVs antigas
  - listas 2025 × catálogos
  - linhas não extraídas

## Gaxetas e raspadores: padrão da REFERÊNCIA (milésimos de polegada)

| Modelo | Padrão | Exemplo |
|---|---|---|
| STD (êmbolo) | `SSS IIIII`: H = seção = SSS, ØINT = IIIII, ØEXT = ØINT + 2·SSS | `18700250` = 3/16 × 1/4 → ØEXT 5/8 |
| Tipo B / AG 4 (BS) | `SSS IIIII HHH`: seção, ØINT, H | `12500250250` = 1/4 × 1/2 × 1/4 |
| Tipo D (raspador) | `D-IIII`: ØINT | `D-3875` = 3 7/8 |

- Milésimos truncados (`187`, `312`, `937`) são arredondados para 1/64".
- Códigos que não ficam perto de uma fração (ex.: `D-0788` = 20 mm) são convertidos direto.
- Prefixo `6-` ou `---` significa peça métrica/especial e usa o valor impresso.
- Sufixo `PM` = Polymax. Sufixo `BS` = AG 4 (BS).
- Na lista o código Tipo B vem com hífen (`12500250-250` = `12500250250`).

## Retentores

- **Fonte primária:** o índice "REFERÊNCIA AGEL" (`CÓDIGO REF MOD. ØINT ØEXT H1/H2 MAT ORI`). As páginas de perfil conferem o índice e completam os códigos que faltam nele.
- **Perfil:** é o da página onde o código aparece. O índice usa variantes de material, que ficam no perfil-base com `Variante=` em Extras:
  - `F` = FPM: `BRGF` → `BRG`
  - `S` = MVQ: `BAS` → `BA`
  - `P` = PTFE
  - número: `AGGK1` → `AGGK`
- **Tipo:** pela descrição da página do perfil.
  - "RASPADOR…" → `Raspador` (aplicação Haste)
  - "RETENTOR…", "VEDADOR…" ou "GUARDA PÓ…" → `Retentor` (aplicação **Eixo**)
- **Altura:** `H1/H2` (ex.: `5,0/7,0`) → Altura = H2 (total); o texto original vai em Extras.
- **ØEXT escalonado:** `110,0/154,0` → Externo = primeiro valor; o texto original vai em Extras.
- **Colunas:** `REF` (referência de mercado) → `Referencia`. `ORI` (LI/H/AH/BI, legenda da pág. 6) → Extras "Orientação do lábio".
- **Código nos dois catálogos** (raspadores GA, GAE, GAG, AGK1…): vale a linha do catálogo de gaxetas. Lá a coluna `h` é o H1; o `H1/H2` do de retentores vai em Extras.

## Recortes antigos (Drive)

As pastas `conversao-pol-mm/`, `vedacao-embolo/` e `vedacao-haste/` vieram da pasta do Drive
`1oBfppBxdZX2nqZUeHn70SU8rPZWI9Gxa`. São **recortes do catálogo APC 2019** (os "ALTERADO" são
as páginas convertidas para mm) e ficam só como referência.

Erros na tabela de conversão do Drive: `11 1/2` = 292,10 (não 292,70); `18 1/4` = 463,55;
`22` = 558,80; falta `27/32` (21,43).
