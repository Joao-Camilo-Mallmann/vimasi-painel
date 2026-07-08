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
};

// ── Mapeamento campo de busca → coluna do CSV ───────────────────
// Quando o nome do campo difere do header CSV, mapear aqui.
const FIELD_TO_CSV = {
  interno:     "Interno",
  externo:     "Externo",
  alturaBase:  "AlturaBase",
  altura:      "Altura",
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
    badge: { bg: "#a3e635", text: "#050505", border: "#a3e635" },
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
