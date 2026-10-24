/**
 * Taxonomia de produtos — fonte única das facetas do funil
 * (Medida → Tipo → Modelo → Material → Aplicação).
 *
 * - O catálogo APC (src/data/catalogo_apc.csv) já vem com as facetas,
 *   geradas por scripts/ingest_catalogos.py a partir dos catálogos de
 *   gaxetas/raspadores e de retentores + listas AGEL 2025.
 * - As CSVs antigas (src/data/<tipo>-<perfil>.csv, ex.: anel-teflon.csv) recebem as facetas por LEGACY_MAP.
 *
 * Cores de badge são hex fixos aplicados via style inline
 * (nunca interpolar classes Tailwind).
 */

// ── Tipos (ordem de exibição + badge) ───────────────────────────
export const TIPOS = {
  Gaxeta: { bg: "#e4c7aa", text: "#050505", border: "#d4af37" },
  Raspador: { bg: "#64748b", text: "#ffffff", border: "#475569" },
  Retentor: { bg: "#f472b6", text: "#050505", border: "#ec4899" },
  Conjunto: { bg: "#a3e635", text: "#050505", border: "#84cc16" },
  "Buffer seal": { bg: "#fb923c", text: "#050505", border: "#f97316" },
  Anel: { bg: "#fbbf24", text: "#050505", border: "#f59e0b" },
  Arruela: { bg: "#2dd4bf", text: "#050505", border: "#14b8a6" },
  "O-ring": { bg: "#a78bfa", text: "#050505", border: "#8b5cf6" },
  "V-Ring": { bg: "#22d3ee", text: "#050505", border: "#06b6d4" },
  "Fita guia": { bg: "#ffffff", text: "#050505", border: "#e5e5e5" },
  "Reparo pneumático": { bg: "#3b82f6", text: "#ffffff", border: "#2563eb" },
  Ferramenta: { bg: "#404040", text: "#ffffff", border: "#525252" },
  Outros: { bg: "#555555", text: "#ffffff", border: "#555555" },
};

const BADGE_FALLBACK = { bg: "#555555", text: "#ffffff", border: "#555555" };

export const ORDEM_TIPOS = Object.keys(TIPOS);

export const getBadgeByTipo = (tipo) => TIPOS[tipo] || BADGE_FALLBACK;

// ── Aplicações ──────────────────────────────────────────────────
export const APLICACOES = {
  haste: "Haste",
  embolo: "Êmbolo",
  amortecimento: "Amortecimento",
  eixo: "Eixo", // retentores (eixo rotativo)
};

// Peças sem aplicação (genéricas) atendem só estas. Retentor sempre vem com "eixo".
export const APLICACOES_GENERICAS = ["haste", "embolo"];

// ── Facetas do funil (ordem do fluxo principal) ─────────────────
export const FACETAS = [
  { key: "tipo", label: "Tipo" },
  { key: "modelo", label: "Perfil" }, // campo interno "modelo" (B, AG 1, STD…); na tela, "Perfil"
  { key: "material", label: "Material" },
  { key: "aplicacao", label: "Aplicação" },
];

// ── Campos de medida pesquisáveis ───────────────────────────────
export const CAMPOS_MEDIDA = [
  { key: "interno", label: "Ø Interno" },
  { key: "externo", label: "Ø Externo" },
  { key: "altura", label: "Altura" },
  { key: "secao", label: "Seção" },
];

// ── CSVs antigas → facetas ──────────────────────────────────────
// colunas: coluna do CSV → campo do produto. Campos de medida:
// interno, externo, altura, alturaBase, secao. Demais viram "extras".
// Aplicação é rascunho para revisão (proposal: Haste/Êmbolo/Genérico).
const DIM_PADRAO = { Interno: "interno", Externo: "externo", Altura: "altura", AlturaBase: "alturaBase" };

export const LEGACY_MAP = {
  "anel-quad-arruela.csv": { tipo: "Anel", modelo: "Quad / Arruela", material: "Borracha", aplicacoes: [] },
  "anel-gt.csv": { tipo: "Anel", modelo: "GT", material: "", aplicacoes: [] },
  "anel-teflon.csv": { tipo: "Anel", modelo: "Teflon", material: "PTFE", aplicacoes: [] },
  "anel-unitario.csv": { tipo: "Anel", modelo: "Unitário", material: "", aplicacoes: [] },
  "arruela-ov.csv": { tipo: "Arruela", modelo: "OV", material: "PU", aplicacoes: [] },
  "arruela-std.csv": { tipo: "Arruela", modelo: "STD", material: "PU", aplicacoes: [] },
  "anel-backup.csv": { tipo: "Anel", modelo: "Backup", material: "", aplicacoes: [] },
  "buffer-seal-od.csv": { tipo: "Buffer seal", modelo: "OD", material: "", aplicacoes: ["haste"] },
  "buffer-seal-oe.csv": { tipo: "Buffer seal", modelo: "OE", material: "", aplicacoes: ["haste"] },
  "conjunto-capped-t.csv": { tipo: "Conjunto", modelo: "Capped T", material: "", aplicacoes: ["embolo"] },
  "conjunto-753.csv": { tipo: "Conjunto", modelo: "753", material: "", aplicacoes: ["embolo"] },
  "conjunto-bp.csv": { tipo: "Conjunto", modelo: "BP", material: "", aplicacoes: ["embolo"] },
  "conjunto-uhmw.csv": { tipo: "Conjunto", modelo: "UHMW", material: "UHMW", aplicacoes: ["embolo"] },
  "conjunto-zo.csv": { tipo: "Conjunto", modelo: "ZO", material: "", aplicacoes: ["embolo"] },
  "conjunto-zw.csv": { tipo: "Conjunto", modelo: "ZW", material: "", aplicacoes: ["embolo"] },
  "conjunto-dual-ring.csv": { tipo: "Conjunto", modelo: "Dual Ring", material: "", aplicacoes: ["embolo"] },
  "fita-guia-ptfe.csv": {
    tipo: "Fita guia", modelo: "PTFE", material: "PTFE", aplicacoes: [],
    colunas: { Largura: "Largura", Espessura: "Espessura", Comprimento: "Comprimento" },
  },
  "gaxeta-diversas.csv": { tipo: "Gaxeta", modelo: "Diversas", material: "", aplicacoes: [] },
  "gaxeta-chevron.csv": {
    tipo: "Gaxeta", modelo: "Chevron", material: "", aplicacoes: [],
    colunas: { ...DIM_PADRAO, V: "Lábios (V)" },
  },
  "gaxeta-gsk.csv": { tipo: "Gaxeta", modelo: "GSK", material: "GSK", aplicacoes: [] },
  "o-ring-pu.csv": {
    tipo: "O-ring", modelo: "PU", material: "PU", aplicacoes: [],
    // O-ring: Diametro = Ø interno, Espessura = seção (corda)
    colunas: { Diametro: "interno", Espessura: "secao" },
  },
  "raspador-azul.csv": { tipo: "Raspador", modelo: "Azul", material: "", aplicacoes: ["haste"] },
  "raspador-metalico.csv": { tipo: "Raspador", modelo: "Metálico", material: "", aplicacoes: ["haste"] },
  "v-ring-guarda-po.csv": { tipo: "V-Ring", modelo: "Guarda-pó", material: "", aplicacoes: ["haste"] },
};

export const getColunasLegado = (cfg) => cfg.colunas || DIM_PADRAO;
