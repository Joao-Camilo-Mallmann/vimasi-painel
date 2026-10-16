# Catálogos (fontes brutas)

## Fonte principal

| Arquivo | Origem | Uso |
|---|---|---|
| `apc-completo/apc-gaxetas-raspadores-ref-02-2019.pdf` | "APC GAXETAS (3).pdf" | **Fonte principal.** 69 págs. Índice nas págs. PDF 9–13; tabelas nas págs. 15–68. |
| `precos/agel-lista-precos-2026-01.pdf` | "Gaxetas 2026.pdf" | Lista AGEL 01/2026. **Fora do git** (`.gitignore`). Só código e descrição são cruzados; **preço nunca é importado**. |

## Como regenerar os dados

```bash
python -I scripts/ingest_catalogos.py      # gera src/data/catalogo_apc.csv + docs/catalogos/divergencias.md
node scripts/check_units.mjs               # auto-checagem mm ⇄ pol
node scripts/check_busca.mjs               # auto-checagem busca + funil
```

- Novo catálogo ou página: ajustar o manifesto no topo do script (`APLICACOES`, `FICHA`, faixas de página).
- O relatório `divergencias.md` lista:
  - código × valor impresso
  - duplicados
  - sobreposição com as CSVs antigas
  - lista 2026 × catálogo
  - linhas não extraídas

## Padrão da REFERÊNCIA (milésimos de polegada)

| Modelo | Padrão | Exemplo |
|---|---|---|
| STD (êmbolo) | `SSS IIIII`: H = seção = SSS, ØINT = IIIII, ØEXT = ØINT + 2·SSS | `18700250` = 3/16 × 1/4 → ØEXT 5/8 |
| Tipo B / AG 4 (BS) | `SSS IIIII HHH`: seção, ØINT, H | `12500250250` = 1/4 × 1/2 × 1/4 |
| Tipo D (raspador) | `D-IIII`: ØINT | `D-3875` = 3 7/8 |

- Milésimos truncados (`187`, `312`, `937`) são arredondados para 1/64".
- Códigos que não ficam perto de uma fração (ex.: `D-0788` = 20 mm) são convertidos direto.
- Prefixo `6-` ou `---` significa peça métrica/especial e usa o valor impresso.
- Sufixo `PM` = Polymax. Sufixo `BS` = AG 4 (BS).
- Na lista 2026 o código Tipo B vem com hífen (`12500250-250` = `12500250250`).

## Recortes antigos (Drive)

As pastas `conversao-pol-mm/`, `vedacao-embolo/` e `vedacao-haste/` vieram da pasta do Drive
`1oBfppBxdZX2nqZUeHn70SU8rPZWI9Gxa`. São **recortes do catálogo completo** (os "ALTERADO" são
as páginas convertidas para mm) e ficam só como referência.

Erros na tabela de conversão do Drive: `11 1/2` = 292,10 (não 292,70); `18 1/4` = 463,55;
`22` = 558,80; falta `27/32` (21,43).
