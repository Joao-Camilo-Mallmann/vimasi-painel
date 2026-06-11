/**
 * Retorna o estilo CSS (cores de fundo, texto e borda) correspondente
 * a cada tipo de peça de vedação.
 *
 * @param {string} tipo - O tipo da peça (ex: ZW, ZO, ZR).
 * @returns {object} Objeto com estilos CSS aplicáveis.
 */
export const getTipoBadgeStyle = (tipo) => {
  if (!tipo) return {};
  const t = tipo.trim().toUpperCase();

  switch (t) {
    case "ZW":
      return {
        backgroundColor: "#22d3ee", // Ciano sólido
        color: "#050505", // Texto escuro (base floor)
        borderColor: "#22d3ee",
      };
    case "ZO":
      return {
        backgroundColor: "#e4c7aa", // Dourado sólido
        color: "#050505", // Texto escuro
        borderColor: "#e4c7aa",
      };
    case "ZR":
      return {
        backgroundColor: "#e53935", // Vermelho sólido
        color: "#ffffff", // Texto claro
        borderColor: "#e53935",
      };
    default:
      return {
        backgroundColor: "#555555", // Cinza neutro
        color: "#ffffff", // Texto claro
        borderColor: "#555555",
      };
  }
};
