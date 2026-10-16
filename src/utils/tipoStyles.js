/**
 * Retorna o estilo CSS (cores de fundo, texto e borda) correspondente
 * a cada Tipo de peça (Gaxeta, Raspador, Conjunto...).
 *
 * As cores são fixas em src/config/taxonomia.js (TIPOS).
 *
 * @param {string} tipo - O Tipo da peça.
 * @returns {object} Objeto com estilos CSS aplicáveis.
 */
import { getBadgeByTipo } from "../config/taxonomia";

export const getTipoBadgeStyle = (tipo) => {
  const badge = getBadgeByTipo(tipo);
  return {
    backgroundColor: badge.bg,
    color: badge.text,
    borderColor: badge.border,
  };
};
