/**
 * Registry central de todas as categorias de peças.
 *
 * Cada entrada define:
 *   - tipo:      código curto exibido no badge
 *   - label:     nome legível para o dropdown
 *   - csvFile:   nome do arquivo CSV correspondente (importado via ?raw)
 *   - columns:   quais colunas de dimensão esse CSV possui
 *   - fields:    quais campos de busca exibir no formulário
 *   - badge:     cores do badge (bg, text, border)
 */

// ── Fields de busca disponíveis ─────────────────────────────────
export const FIELD_DEFS = {
  interno:      { label: "Ø Interno",    placeholder: "0.00", unit: "mm" },
  externo:      { label: "Ø Externo",    placeholder: "0.00", unit: "mm" },
  alturaBase:   { label: "Alt. Base",    placeholder: "0.00", unit: "mm" },
  altura:       { label: "Altura",       placeholder: "0.00", unit: "mm" },
  diametro:     { label: "Diâmetro",     placeholder: "0.00", unit: "mm" },
  espessura:    { label: "Espessura",    placeholder: "0.00", unit: "mm" },
  largura:      { label: "Largura",      placeholder: "0.00", unit: "mm" },
  comprimento:  { label: "Comprimento",  placeholder: "0.00", unit: "m"  },
  v:            { label: "V (gap)",      placeholder: "0.00", unit: "mm" },
  dim1:         { label: "Dim 1",        placeholder: "0.00", unit: "mm" },
  dim2:         { label: "Dim 2",        placeholder: "0.00", unit: "mm" },
  dim3:         { label: "Dim 3",        placeholder: "0.00", unit: "mm" },
};

// ── Mapeamento campo de busca → coluna do CSV ───────────────────
// Quando o nome do campo difere do header CSV, mapear aqui.
const FIELD_TO_CSV = {
  interno:     "Interno",
  externo:     "Externo",
  alturaBase:  "AlturaBase",
  altura:      "Altura",
  diametro:    "Diametro",
  espessura:   "Espessura",
  largura:     "Largura",
  comprimento: "Comprimento",
  v:           "V",
  dim1:        "Dim1",
  dim2:        "Dim2",
  dim3:        "Dim3",
};

export { FIELD_TO_CSV };

// ── Categorias ──────────────────────────────────────────────────
const CATEGORIES = [
  {
    tipo: "ZO",
    label: "Conjunto ZO",
    csvFile: "data_conjunto_zo.csv",
    columns: ["Codigo", "Tipo", "Externo", "Interno", "Altura", "AlturaBase"],
    fields: ["interno", "externo", "altura", "alturaBase"],
    badge: { bg: "#e4c7aa", text: "#050505", border: "#e4c7aa" },
  },
  {
    tipo: "ZW",
    label: "Conjunto ZW",
    csvFile: "data_conjunto_zw.csv",
    columns: ["Codigo", "Tipo", "Externo", "Interno", "Altura", "AlturaBase"],
    fields: ["interno", "externo", "altura", "alturaBase"],
    badge: { bg: "#22d3ee", text: "#050505", border: "#22d3ee" },
  },
  {
    tipo: "BP",
    label: "Conjunto BP",
    csvFile: "data_conjunto_bp.csv",
    columns: ["Codigo", "Tipo", "Externo", "Interno", "Altura"],
    fields: ["interno", "externo", "altura"],
    badge: { bg: "#a78bfa", text: "#050505", border: "#a78bfa" },
  },
  {
    tipo: "753",
    label: "Conjunto 753",
    csvFile: "data_conjunto_753.csv",
    columns: ["Codigo", "Tipo", "Externo", "Interno", "Altura", "AlturaBase"],
    fields: ["interno", "externo", "altura", "alturaBase"],
    badge: { bg: "#f472b6", text: "#050505", border: "#f472b6" },
  },
  {
    tipo: "UHMW",
    label: "Conjunto UHMW",
    csvFile: "data_conjunto_de_uhmw.csv",
    columns: ["Codigo", "Tipo", "Externo", "Interno", "Altura"],
    fields: ["interno", "externo", "altura"],
    badge: { bg: "#34d399", text: "#050505", border: "#34d399" },
  },
  {
    tipo: "CHEVRON",
    label: "Gaxeta Chevron",
    csvFile: "data_gaxeta_chevron.csv",
    columns: ["Codigo", "Tipo", "Interno", "Externo", "Altura", "V"],
    fields: ["interno", "externo", "altura", "v"],
    badge: { bg: "#fb923c", text: "#050505", border: "#fb923c" },
  },
  {
    tipo: "GT",
    label: "Anel GT",
    csvFile: "data_anel_gt.csv",
    columns: ["Codigo", "Tipo", "Externo", "Interno", "Altura"],
    fields: ["interno", "externo", "altura"],
    badge: { bg: "#facc15", text: "#050505", border: "#facc15" },
  },
  {
    tipo: "GUIA",
    label: "Anel Guia",
    csvFile: "data_anel_guia.csv",
    columns: ["Codigo", "Tipo", "Externo", "Interno", "Altura"],
    fields: ["interno", "externo", "altura"],
    badge: { bg: "#2dd4bf", text: "#050505", border: "#2dd4bf" },
  },
  {
    tipo: "TEFLON",
    label: "Anel Teflon",
    csvFile: "data_anel_teflon.csv",
    columns: ["Codigo", "Tipo", "Externo", "Interno", "Altura"],
    fields: ["interno", "externo", "altura"],
    badge: { bg: "#818cf8", text: "#ffffff", border: "#818cf8" },
  },
  {
    tipo: "ANEL_UNIT",
    label: "Anel Unitário",
    csvFile: "data_anel_unit_rio.csv",
    columns: ["Codigo", "Tipo", "Externo", "Interno", "Altura"],
    fields: ["interno", "externo", "altura"],
    badge: { bg: "#c084fc", text: "#050505", border: "#c084fc" },
  },
  {
    tipo: "QUAD",
    label: "Anéis Quad / Arruela Borracha",
    csvFile: "data_an_is_quad_e_arruela_borracha.csv",
    columns: ["Codigo", "Tipo", "Interno", "Externo", "Altura"],
    fields: ["interno", "externo", "altura"],
    badge: { bg: "#f87171", text: "#050505", border: "#f87171" },
  },
  {
    tipo: "ORING",
    label: "O-Ring de PU",
    csvFile: "data_oring_de_pu.csv",
    columns: ["Codigo", "Tipo", "Diametro", "Espessura"],
    fields: ["diametro", "espessura"],
    badge: { bg: "#4ade80", text: "#050505", border: "#4ade80" },
  },
  {
    tipo: "BACKUP",
    label: "Backup",
    csvFile: "data_backup.csv",
    columns: ["Codigo", "Tipo", "Interno", "Externo", "Altura"],
    fields: ["interno", "externo", "altura"],
    badge: { bg: "#fbbf24", text: "#050505", border: "#fbbf24" },
  },
  {
    tipo: "BUFFER",
    label: "Buffer Seals",
    csvFile: "data_buffer_seals.csv",
    columns: ["Codigo", "Tipo", "Interno", "Externo", "Altura"],
    fields: ["interno", "externo", "altura"],
    badge: { bg: "#38bdf8", text: "#050505", border: "#38bdf8" },
  },
  {
    tipo: "CAPPED",
    label: "Capped T-Seal",
    csvFile: "data_cappedt_seal.csv",
    columns: ["Codigo", "Tipo", "Interno", "Externo", "Altura"],
    fields: ["interno", "externo", "altura"],
    badge: { bg: "#e879f9", text: "#050505", border: "#e879f9" },
  },
  {
    tipo: "DUAL",
    label: "Dual Ring",
    csvFile: "data_dual_ring.csv",
    columns: ["Codigo", "Tipo", "Interno", "Externo", "Altura"],
    fields: ["interno", "externo", "altura"],
    badge: { bg: "#67e8f9", text: "#050505", border: "#67e8f9" },
  },
  {
    tipo: "FITA",
    label: "Fita Guia PTFE",
    csvFile: "data_fita_guia_ptfe.csv",
    columns: ["Codigo", "Tipo", "Largura", "Espessura", "Comprimento"],
    fields: ["largura", "espessura", "comprimento"],
    badge: { bg: "#a3e635", text: "#050505", border: "#a3e635" },
  },
  {
    tipo: "VRING",
    label: "V-Ring (Guarda Pó)",
    csvFile: "data_v_ring_guarda_po.csv",
    columns: ["Codigo", "Tipo", "Interno", "Externo", "Altura"],
    fields: ["interno", "externo", "altura"],
    badge: { bg: "#f97316", text: "#050505", border: "#f97316" },
  },
  {
    tipo: "OV",
    label: "Arruela PU Modelo OV",
    csvFile: "data_arr_de_pu_modelo_ov.csv",
    columns: ["Codigo", "Tipo", "Interno", "Externo", "Altura"],
    fields: ["interno", "externo", "altura"],
    badge: { bg: "#94a3b8", text: "#050505", border: "#94a3b8" },
  },
  {
    tipo: "ARR_PU",
    label: "Arruelas Std. PU",
    csvFile: "data_arruelas_std_pu.csv",
    columns: ["Codigo", "Tipo", "Interno", "Externo", "Altura"],
    fields: ["interno", "externo", "altura"],
    badge: { bg: "#d946ef", text: "#050505", border: "#d946ef" },
  },
];

export default CATEGORIES;

/**
 * Retorna a configuração de badge para um dado tipo.
 * Fallback para cinza neutro se o tipo não for reconhecido.
 */
export const getBadgeByTipo = (tipo) => {
  if (!tipo) return { bg: "#555555", text: "#ffffff", border: "#555555" };
  const t = tipo.trim().toUpperCase();
  const cat = CATEGORIES.find((c) => c.tipo === t);
  if (cat) {
    return cat.badge;
  }
  return { bg: "#555555", text: "#ffffff", border: "#555555" };
};

/**
 * Retorna a configuração completa de categoria para um dado tipo.
 */
export const getCategoryByTipo = (tipo) => {
  if (!tipo) return null;
  const t = tipo.trim().toUpperCase();
  return CATEGORIES.find((c) => c.tipo === t) || null;
};

/**
 * Retorna os campos de busca aplicáveis dada a seleção de tipo do formulário.
 * Se tipo vazio (todos), retorna a união de campos mais comuns.
 */
export const getFieldsForTipo = (tipo) => {
  if (!tipo) {
    // Busca global: mostrar os campos mais universais
    return ["interno", "externo", "altura"];
  }
  const cat = getCategoryByTipo(tipo);
  if (cat) return cat.fields;
  return ["interno", "externo", "altura"];
};
