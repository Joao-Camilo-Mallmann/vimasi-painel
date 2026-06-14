/**
 * Retorna o estilo CSS (cores de fundo, texto e borda) correspondente
 * a cada tipo de peça de vedação.
 *
 * Agora usa o registry central de categorias para cores fixas
 * de TODAS as 20 categorias.
 *
 * @param {string} tipo - O tipo da peça (ex: ZW, ZO, ORING, CHEVRON).
 * @returns {object} Objeto com estilos CSS aplicáveis.
 */
import { getBadgeByTipo } from "../config/categories";

export const getTipoBadgeStyle = (tipo) => {
  const badge = getBadgeByTipo(tipo);
  return {
    backgroundColor: badge.bg,
    color: badge.text,
    borderColor: badge.border,
  };
};
