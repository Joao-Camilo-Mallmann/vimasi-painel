# Catálogos brutos (fonte: Google Drive)

Pasta de origem: https://drive.google.com/drive/folders/1oBfppBxdZX2nqZUeHn70SU8rPZWI9Gxa
Baixado em: 2026-10-15

| Arquivo local | Nome original no Drive | Drive ID | Observação |
|---|---|---|---|
| `conversao-pol-mm/tabela-pol-mm.csv` | CONVERSÃO POL PARA MM / CÓDIGO CSV.txt | `102t_YpNIAYbKVC97IM-ezqk-dsI_EtEl` | Tabela pol → mm (`;`), 4 pares de colunas |
| `conversao-pol-mm/introducao.pdf` | CONVERSÃO POL PARA MM / INTRODUÇÃO | `1ymItf5f3l-pVnJ5OuTXBtctpLJ7NCKS7` | Mesma tabela do CSV, em PDF |
| `vedacao-embolo/std-pu-5000psi-mm.pdf` | VEDAÇÃO EMBOLO / GAXETAS MODELO STD PU (5000PSI) (-30 +100°C) (0,5m/s) ALTERADO | `1joP2Ti87ztYhP9u3yh_3LpzncpGWJupE` | 4 págs, texto, mm |
| `vedacao-embolo/std-polymax-7000psi-mm.pdf` | VEDAÇÃO EMBOLO / GAXETAS MODELO STD PU (7000PSI) (-45 +135°C) (0,5m/s) ALTERADO | `19FNeb5sQSiTG0sQD1rnY7y4lhcHPbrm5` | 1 pág, **escaneado (sem texto)**, Polymax (sufixo PM) |
| `vedacao-haste/tipo-b-pu-4000psi-pol.pdf` | VEDAÇÕES HASTE / GAXETAS MODELO B PU (4000PSI) (-30 +100°C) (0,5m/s) | `1isZoKnR-KCHBaRHuBKjT5TV58RdWPCZw` | 8 págs, texto, **polegadas (frações)** |
| `vedacao-haste/tipo-b-pu-4000psi-mm.pdf` | VEDAÇÕES HASTE / GAXETAS MODELO B PU (4000PSI) (-30 +100°C) (0,5m/s) ALTERADO | `18QuHeCwfkJVE-aqYEJRY3mGhSdOetIoW` | 8 págs, texto, mm — versão convertida do anterior |
| `vedacao-haste/tipo-b-polymax-8000psi-mm.pdf` | VEDAÇÕES HASTE / GAXETAS MODELO B PU (8000PSI) (-45 +135°C) (0,5m/s) ALTERADO | `1zk1B1W4C2Dy8RI1O_bGzUFmSJmG4apcc` | 3 págs, texto, mm, Polymax (sufixo PM) |

## Padrão da REFERÊNCIA (medidas em milésimos de polegada)

- **STD (êmbolo)** — 8 dígitos `SSS IIIII`: `SSS` = seção/H, `IIIII` = Ø interno.
  Ex.: `18700250` → H 0.187" (4,76 mm), ØINT 0.250" (6,35 mm), ØEXT = ØINT + 2·H = 15,88 mm.
- **Tipo B (haste)** — 11 dígitos `SSS IIIII HHH`: `SSS` = seção radial, `IIIII` = Ø interno, `HHH` = altura.
  Ex.: `12500250250` → seção 1/8", ØINT 1/4", H 1/4" → ØEXT 1/2".
- Prefixo `6-` = peça com medida métrica/especial (código não segue o padrão em polegada).
- Sufixo `PM` = Polymax (versão alta pressão/temperatura).

## Pontos de atenção encontrados na tabela de conversão

- Linha 27: falta a fração `27/32` (valor 21,43 sem pol).
- `11 1/2` = 292,70 → correto é **292,10**.
- `18 1/4` = 463,65 → correto é **463,55**.
- `22` = 558,70 → correto é **558,80**.
