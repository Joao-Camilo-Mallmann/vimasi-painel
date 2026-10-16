/**
 * Taxonomia de produtos — fonte única das facetas do funil
 * (Medida → Tipo → Modelo → Material → Aplicação).
 *
 * - O catálogo APC (src/data/catalogo_apc.csv) já vem com as facetas,
 *   geradas por scripts/ingest_catalogos.py a partir do índice do PDF.
 * - As CSVs antigas (src/data/data_*.csv) recebem as facetas por LEGACY_MAP.
 *
 * Cores de badge são hex fixos aplicados via style inline
 * (nunca interpolar classes Tailwind).
 */

// ── Tipos (ordem de exibição + badge) ───────────────────────────
export const TIPOS = {
  Gaxeta: { bg: "#e4c7aa", text: "#050505", border: "#d4af37" },
  Raspador: { bg: "#64748b", text: "#ffffff", border: "#475569" },
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
};

// Peças sem aplicação (genéricas) atendem só estas
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
  "data_an_is_quad_e_arruela_borracha.csv": { tipo: "Anel", modelo: "Quad / Arruela", material: "Borracha", aplicacoes: [] },
  "data_anel_gt.csv": { tipo: "Anel", modelo: "GT", material: "", aplicacoes: [] },
  "data_anel_teflon.csv": { tipo: "Anel", modelo: "Teflon", material: "PTFE", aplicacoes: [] },
  "data_anel_unit_rio.csv": { tipo: "Anel", modelo: "Unitário", material: "", aplicacoes: [] },
  "data_arr_de_pu_modelo_ov.csv": { tipo: "Arruela", modelo: "OV", material: "PU", aplicacoes: [] },
  "data_arruelas_std_pu.csv": { tipo: "Arruela", modelo: "STD", material: "PU", aplicacoes: [] },
  "data_backup.csv": { tipo: "Anel", modelo: "Backup", material: "", aplicacoes: [] },
  "data_buffer_seals_od.csv": { tipo: "Buffer seal", modelo: "OD", material: "", aplicacoes: ["haste"] },
  "data_buffer_seals_oe.csv": { tipo: "Buffer seal", modelo: "OE", material: "", aplicacoes: ["haste"] },
  "data_cappedt_seal.csv": { tipo: "Conjunto", modelo: "Capped T", material: "", aplicacoes: ["embolo"] },
  "data_conjunto_753.csv": { tipo: "Conjunto", modelo: "753", material: "", aplicacoes: ["embolo"] },
  "data_conjunto_bp.csv": { tipo: "Conjunto", modelo: "BP", material: "", aplicacoes: ["embolo"] },
  "data_conjunto_de_uhmw.csv": { tipo: "Conjunto", modelo: "UHMW", material: "UHMW", aplicacoes: ["embolo"] },
  "data_conjunto_zo.csv": { tipo: "Conjunto", modelo: "ZO", material: "", aplicacoes: ["embolo"] },
  "data_conjunto_zw.csv": { tipo: "Conjunto", modelo: "ZW", material: "", aplicacoes: ["embolo"] },
  "data_dual_ring.csv": { tipo: "Conjunto", modelo: "Dual Ring", material: "", aplicacoes: ["embolo"] },
  "data_fita_guia_ptfe.csv": {
    tipo: "Fita guia", modelo: "PTFE", material: "PTFE", aplicacoes: [],
    colunas: { Largura: "Largura", Espessura: "Espessura", Comprimento: "Comprimento" },
  },
  "data_gaxeta.csv": { tipo: "Gaxeta", modelo: "Diversas", material: "", aplicacoes: [] },
  "data_gaxeta_chevron.csv": {
    tipo: "Gaxeta", modelo: "Chevron", material: "", aplicacoes: [],
    colunas: { ...DIM_PADRAO, V: "Lábios (V)" },
  },
  "data_gaxeta_gsk.csv": { tipo: "Gaxeta", modelo: "GSK", material: "GSK", aplicacoes: [] },
  "data_oring_de_pu.csv": {
    tipo: "O-ring", modelo: "PU", material: "PU", aplicacoes: [],
    // O-ring: Diametro = Ø interno, Espessura = seção (corda)
    colunas: { Diametro: "interno", Espessura: "secao" },
  },
  "data_raspador_azul.csv": { tipo: "Raspador", modelo: "Azul", material: "", aplicacoes: ["haste"] },
  "data_raspador_metalico.csv": { tipo: "Raspador", modelo: "Metálico", material: "", aplicacoes: ["haste"] },
  "data_v_ring_guarda_po.csv": { tipo: "V-Ring", modelo: "Guarda-pó", material: "", aplicacoes: ["haste"] },
};

export const getColunasLegado = (cfg) => cfg.colunas || DIM_PADRAO;
