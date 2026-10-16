/**
 * Facetas do funil com contagem disjuntiva:
 * a contagem de cada opção considera as seleções dos OUTROS grupos,
 * para que dê para trocar de opção dentro do grupo sem limpar antes.
 *
 * Dentro de um grupo: OU. Entre grupos: E.
 * Peças genéricas (sem aplicação) atendem Haste e Êmbolo.
 */
import { APLICACOES, APLICACOES_GENERICAS, FACETAS, ORDEM_TIPOS } from "../config/taxonomia";

export const SELECAO_VAZIA = { tipo: [], modelo: [], material: [], aplicacao: [] };

const valores = {
  tipo: (p) => [p.tipo],
  modelo: (p) => [p.modelo],
  material: (p) => [p.material],
  aplicacao: (p) => p.aplicacoes,
};

function atende(p, key, selecionados) {
  if (!selecionados || selecionados.length === 0) return true;
  const vals = key === "aplicacao" && p.aplicacoes.length === 0 ? APLICACOES_GENERICAS : valores[key](p);
  return vals.some((v) => selecionados.includes(v));
}

export function aplicarFacetas(produtos, selecao, ignorar = null) {
  return produtos.filter((p) =>
    FACETAS.every(({ key }) => key === ignorar || atende(p, key, selecao[key]))
  );
}

const ordenar = (key, a, b) => {
  if (key === "tipo") {
    const ia = ORDEM_TIPOS.indexOf(a.valor);
    const ib = ORDEM_TIPOS.indexOf(b.valor);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  }
  if (a.valor === "—") return 1;
  if (b.valor === "—") return -1;
  return a.valor.localeCompare(b.valor, "pt-BR", { numeric: true });
};

/**
 * @returns {Record<string, Array<{valor: string, label: string, count: number}>>}
 */
export function contarFacetas(produtos, selecao) {
  const out = {};
  for (const { key } of FACETAS) {
    const base = aplicarFacetas(produtos, selecao, key);
    const cont = new Map();
    for (const p of base) {
      if (key === "aplicacao") {
        // genéricas contam para todas as aplicações
        const alvo = p.aplicacoes.length ? p.aplicacoes : APLICACOES_GENERICAS;
        for (const v of alvo) cont.set(v, (cont.get(v) || 0) + 1);
      } else {
        for (const v of valores[key](p)) cont.set(v, (cont.get(v) || 0) + 1);
      }
    }
    // opções selecionadas continuam visíveis mesmo zeradas (para poder desmarcar)
    for (const v of selecao[key] || []) if (!cont.has(v)) cont.set(v, 0);
    out[key] = [...cont.entries()]
      .map(([valor, count]) => ({
        valor,
        count,
        label: key === "aplicacao" ? APLICACOES[valor] || valor : valor,
      }))
      .filter((o) => o.count > 0 || (selecao[key] || []).includes(o.valor))
      .sort((a, b) => ordenar(key, a, b));
  }
  return out;
}

/** Contagem após cada etapa do funil, na ordem fixa Tipo → Modelo → Material → Aplicação. */
export function etapasFunil(produtos, selecao) {
  const etapas = [{ key: "medida", label: "Medida", count: produtos.length }];
  let acumulada = { ...SELECAO_VAZIA };
  for (const { key, label } of FACETAS) {
    if (!selecao[key] || selecao[key].length === 0) continue;
    acumulada = { ...acumulada, [key]: selecao[key] };
    etapas.push({
      key,
      label,
      valores: selecao[key].map((v) => (key === "aplicacao" ? APLICACOES[v] || v : v)),
      count: aplicarFacetas(produtos, acumulada).length,
    });
  }
  return etapas;
}
