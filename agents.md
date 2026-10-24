# Vimasi Painel — AI Agent Guidelines

> Especificação de regras, convenções e comportamentos para assistentes de IA que operam neste projeto.
> Mantenha este arquivo atualizado sempre que surgirem novos padrões relevantes.

---

## 🎯 Diretrizes Gerais de Comportamento

- **Use `/grill-me`** sempre que o contexto for ambíguo ou requisitos estiverem incompletos antes de propor soluções.
- **Leia sempre este arquivo e os arquivos referenciados** (DESIGN.md, specs, etc.) antes de qualquer implementação.
- **Atualize este arquivo proativamente** sempre que novos padrões ou decisões de arquitetura emergirem durante a sessão.
- **Nunca adivinhe uma mudança** — consulte o `openspec list` ou pergunte antes de agir sobre changes.

---

## 🛠️ Stack do Projeto

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework UI | **React** | ^19.2.7 |
| Build Tool | **Vite** | ^8.1.5 |
| Estilização | **Tailwind CSS v4** | ^4.3.3 |
| Backend / DB | **Supabase** | ^2.110.8 |
| Ícones | **Lucide React** | ^1.25.0 |
| Parse de CSV | **PapaParse** | ^5.5.4 |
| Linguagem | **JavaScript (ESM)** | — |
| Package manager | **npm** (tem também bun.lock) | — |

### Scripts disponíveis
```bash
npm run dev       # Inicia dev server (Vite)
npm run build     # Build de produção
npm run lint      # ESLint
npm run preview   # Preview da build

python -I scripts/ingest_catalogos.py   # Regenera src/data/catalogo_apc.csv + docs/catalogos/divergencias.md
node scripts/check_units.mjs            # Auto-checagem mm ⇄ pol
node scripts/check_busca.mjs            # Auto-checagem busca + funil de facetas
```

---

## 📁 Estrutura de Pastas

```
src/
├── App.jsx                  # Componente raiz — auth guard + lógica central
├── main.jsx                 # Entry point React
├── index.css / App.css      # Estilos globais + design tokens Tailwind
│
├── components/
│   ├── Login.jsx            # Tela de login (Supabase Auth)
│   ├── SearchForm.jsx       # Busca por medida (ØINT/ØEXT/Altura/Seção, mm|pol) + código/referência
│   └── FacetFilter.jsx      # Funil Tipo → Modelo → Material → Aplicação (com contagens)
│
├── services/
│   └── DatabaseService.js   # Carrega catálogo APC + CSVs antigas num único Product[] e busca por medida
│
├── config/
│   └── taxonomia.js         # Tipos (badges fixos), facetas, campos de medida, LEGACY_MAP (fonte da verdade)
│
├── utils/
│   ├── supabase.js          # Inicialização do cliente Supabase
│   ├── tipoStyles.js        # Estilo inline do badge por Tipo
│   ├── units.js             # mm ⇄ pol: formatMm, formatInch (1/64"), parseInch, secao
│   └── facets.js            # Contagem disjuntiva das facetas + etapas do funil
│
└── data/
    ├── catalogo_apc.csv     # GERADO por scripts/ingest_catalogos.py — não editar à mão
    └── <tipo>-<perfil>.csv  # CSVs antigas (anel-teflon.csv, conjunto-zo.csv…; facetas via LEGACY_MAP)

scripts/                     # Ferramentas de dev (não entram no bundle)
docs/catalogos/              # PDFs brutos + divergencias.md (ver README da pasta)

supabase/
└── migrations/
    └── 001_create_estoque_table.sql  # Tabela de estoque com RLS

openspec/
├── specs/                   # Specs principais (fonte da verdade de requisitos)
│   ├── admin-auth/spec.md
│   └── centralized-stock/spec.md
└── changes/
    └── archive/             # Changes implementadas e arquivadas
```

---

## 🔐 Supabase & Autenticação

### Auth
- Autenticação via **Email + Password** (`signInWithPassword`).
- **Sem cadastro público** — nenhuma interface de sign-up deve ser exposta.
- `App.jsx` usa `onAuthStateChange` para reagir a mudanças de sessão.
- Renderização condicional: se não há sessão ativa → exibe `<Login />`.
- Botão de **Sign Out** presente no header da aplicação.

### Estoque (tabela `estoque`)
- Dados de estoque armazenados em **Supabase** (não em localStorage).
- `handleToggleEstoque` usa `insert` / `delete` conforme o estado do checkbox.
- **Row Level Security (RLS)** ativado — requests não autenticados são bloqueados.
- Códigos fora da lista 2025 (ocultos no painel) podem ter linhas órfãs em `estoque`; não quebram nada, só não aparecem.
- Migration em `supabase/migrations/001_create_estoque_table.sql` (deve verificar `pg_policies` em bloco `DO $$` para ignorar se já existir).

### Cliente Supabase
- Inicializado em `src/utils/supabase.js`.
- Variáveis de ambiente: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (ver `.env.example`).
- MCP do Supabase configurado via [.mcp.json](.mcp.json) (`https://mcp.supabase.com/mcp`).

---

## 🎨 Design System & Estética Visual

> Fonte da verdade completa: [.agents/DESIGN.md](.agents/DESIGN.md)

### Filosofia
A estética é **Industrial Premium**: dark canvas pesado + detalhes em Gold e Red. Rejeita flat design — hierarquia via profundidade (Z-axis), glassmorphism, blobs amb nientes e grain overlay.

### Paleta de Cores
| Token | Hex | Uso |
|---|---|---|
| `--color-primary-dark` | `#050505` | Fundo base absoluto |
| `--color-primary-card` | `#121212` | Superfície sólida elevada |
| `--color-accent-gold` | `#e4c7aa` | Destaque premium, ações secundárias |
| Gold border variant | `#d4af37` | Bordas, scrollbars, underlines |
| `--color-accent-red` | `#e53935` | Ação primária, estados ativos, foco |
| WhatsApp Green | `#25D366` | **Somente** botão WhatsApp |

### Regras Críticas de CSS
- **Tailwind v4**: sempre `bg-linear-to-*`, nunca `bg-gradient-to-*`.
- **Sem classes Tailwind dinâmicas interpoladas** (ex: `text-${color}-400` quebra no build). Use estilos inline ou mapeamentos pré-definidos.
- Superfícies translúcidas: `bg-white/5` (repouso) e `bg-white/10` (hover).
- Overlay em imagens: `bg-linear-to-b from-black/80 via-black/50 to-primary-dark`.

### Tipografia
- `font-anton` — títulos estruturais (sempre `uppercase`, `italic`, `tracking-wide`).
- `font-arimo` — corpo, inputs, botões (sentence case, `leading-relaxed`).

### Interatividade
- Hover em cards: `scale-110` na imagem (dentro de `overflow-hidden`), reveal de texto com `max-h-0 → max-h-32`.
- Botões: `hover:scale-105 active:scale-95` + shimmer opcional.
- Transições: mínimo `duration-300`, preferencialmente `duration-700` para elementos maiores.

---

## 🧩 Catálogo, Facetas & Medidas

- **Busca = funil**: medida (± tolerância em mm) → Tipo → Modelo → Material → Aplicação.
  - Na tela, a faceta `modelo` se chama **Perfil** (B, AG 1, STD…). "Linha" = Hidráulica/Pneumática; Polymax é **Material**, não Linha.
  - Facetas em ordem livre, OU dentro do grupo, E entre grupos.
  - Peças sem aplicação são genéricas e atendem Haste e Êmbolo.
  - **Retentor** (Tipo) sempre tem a aplicação **Eixo** e nunca aparece em Haste/Êmbolo. Perfil que existe em mais de um Tipo (ex.: "B") aparece no funil como `B · Retentor` (`desambiguarPerfis` em `DatabaseService.js`). Perfil vazio é `—` ("Não informado", último da lista) em qualquer Tipo e não ganha sufixo.
- **Fonte dos dados**:
  - `src/data/catalogo_apc.csv` é gerado por `scripts/ingest_catalogos.py` a partir de três fontes. Para mudar, edite o script e rode de novo.
    - catálogo de gaxetas e raspadores ref. 2022
    - catálogo de retentores ref. 2021
    - listas AGEL 2025 de gaxetas/raspadores e de retentores
  - Colunas `Catalogo` (`gaxetas-2022` | `retentores-2021` | `lista-2025`) e `NaLista` (`S` = o código está numa lista 2025).
  - **Lista 2025 = fonte mestra do que está em linha**: `DatabaseService.loadData` só carrega códigos com `NaLista=S` (estar na lista é propriedade do código: linhas gêmeas de um mesmo código, ex.: `7044PM` em AG 14 e AG 4 (BS), ficam as duas). Itens dos catálogos 2021/2022 fora das listas são fora de linha: continuam no CSV (`NaLista` vazio) para o histórico do relatório e para seguir sobrepondo as CSVs antigas (`codigosApc` usa todas as linhas), mas não entram em `produtos` (contador `ocultos`). Relatório: seção "Itens dos catálogos fora das listas 2025".
  - Mesmo código nos dois catálogos → o de gaxetas prevalece.
  - CSVs antigas recebem as facetas por `LEGACY_MAP` em `src/config/taxonomia.js`.
  - Mesmo `Codigo` no APC e numa CSV antiga → o APC prevalece.
- **Medidas**:
  - Armazenadas em mm. Para exibir, sempre via `src/utils/units.js`. Nunca `toFixed(2)` solto.
  - Formato: `15,88 mm · 5/8"` (vírgula; fração 1/64" com `≈` quando não é exata).
  - Seção = (ØEXT − ØINT) / 2.
- **Referência do fornecedor** (`Referencia`) é a fonte da verdade das medidas em polegada: veja `docs/catalogos/README.md`.
- **Preços** **nunca** entram em `src/` nem no git: o bundle é público. As listas 2025 versionadas em `docs/catalogos/listas/` não têm preço. Se um dia precisar de preço no painel, use Supabase com RLS.
- **Badges de Tipo** têm cores **fixas** em `TIPOS` (`taxonomia.js`), aplicadas via style inline. Nunca gere cores dinâmicas.
- **Colunas CSV antigas**: `Altura` e `AlturaTotal` foram unificadas em `Altura`; `AlturaBase` é separada para peças de conjunto.

---

## 🗂️ OpenSpec & Fluxo de Mudanças

Este projeto usa o workflow **OpenSpec** (schema `spec-driven`) para planejar e rastrear mudanças.

### Specs principais (fonte da verdade de requisitos)
| Spec | Arquivo |
|---|---|
| Autenticação admin | [openspec/specs/admin-auth/spec.md](openspec/specs/admin-auth/spec.md) |
| Estoque centralizado | [openspec/specs/centralized-stock/spec.md](openspec/specs/centralized-stock/spec.md) |

### Comandos úteis
```bash
openspec list --json                        # Listar changes ativas
openspec status --change "<name>" --json    # Status de uma change
openspec validate --specs                   # Validar specs
```

### Changes arquivadas
- `2026-07-24-auth-admin-only` — Autenticação Supabase + estoque centralizado ✅

---

## ✅ Checklist antes de implementar

- [ ] Li o `agents.md` e o `DESIGN.md`
- [ ] Verifiquei as specs em `openspec/specs/` para contexto de requisitos
- [ ] Confirmei que não há change ativa conflitante (`openspec list`)
- [ ] Não estou usando classes Tailwind dinâmicas interpoladas
- [ ] Estou usando cores de `TIPOS` em `taxonomia.js` para badges de peças
- [ ] Medidas exibidas/parseadas via `units.js` (mm + pol)
- [ ] Não expus nenhuma interface de cadastro público
- [ ] Item novo de catálogo só aparece no painel se estiver numa lista 2025 (`NaLista=S`); depois de mexer em dados rodei `python -I scripts/ingest_catalogos.py` e `node scripts/check_busca.mjs`

---

## 🔗 Arquivos de Referência Rápida

| Arquivo | Propósito |
|---|---|
| [.agents/DESIGN.md](.agents/DESIGN.md) | Design system completo e tokens visuais |
| [src/config/taxonomia.js](src/config/taxonomia.js) | Tipos/badges, facetas, mapeamento das CSVs antigas |
| [src/utils/units.js](src/utils/units.js) | Conversão e formatação mm ⇄ pol |
| [scripts/ingest_catalogos.py](scripts/ingest_catalogos.py) | Ingestão dos catálogos APC (gaxetas 2022 + retentores 2021) + cruzamento com as listas 2025 |
| [docs/catalogos/divergencias.md](docs/catalogos/divergencias.md) | Relatório gerado: divergências e cruzamentos |
| [src/utils/supabase.js](src/utils/supabase.js) | Cliente Supabase inicializado |
| [src/services/DatabaseService.js](src/services/DatabaseService.js) | Abstração de queries |
| [.env.example](.env.example) | Variáveis de ambiente necessárias |
| [SUPABASE_SETUP.md](SUPABASE_SETUP.md) | Guia de setup do Supabase |
| [openspec/specs/](openspec/specs/) | Specs de requisitos do sistema |
