/**
 * Conversão e formatação de medidas (mm ⇄ polegada).
 *
 * Regras (ver openspec/changes/catalogo-apc-busca-funil):
 *   - mm: vírgula decimal, 2 casas, arredondamento half-up sobre o valor real.
 *   - pol: fração mais próxima em 1/64", reduzida, número misto; "≈" quando
 *     a fração difere do valor real em mais de 0,01 mm.
 */

export const MM_POR_POL = 25.4;
const DENOMINADOR = 64;
const TOL_EXATO_MM = 0.01;

const isNum = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));

/** 3.175 → "3,18" ; valores inválidos → "—" */
export function formatMm(v) {
  if (!isNum(v)) return "—";
  const n = Math.round((Number(v) + Number.EPSILON) * 100) / 100;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Fração de polegada mais próxima (1/64), sem aspas.
 * @returns {{ texto: string, exato: boolean } | null}
 */
export function fracaoPol(mm) {
  if (!isNum(mm)) return null;
  const pol = Number(mm) / MM_POR_POL;
  const total64 = Math.round(pol * DENOMINADOR);
  const exato = Math.abs((total64 / DENOMINADOR) * MM_POR_POL - Number(mm)) <= TOL_EXATO_MM;
  const inteiro = Math.floor(total64 / DENOMINADOR);
  let num = total64 % DENOMINADOR;
  let den = DENOMINADOR;
  if (num !== 0) {
    const g = gcd(num, den);
    num /= g;
    den /= g;
  }
  let texto;
  if (num === 0) texto = String(inteiro);
  else if (inteiro === 0) texto = `${num}/${den}`;
  else texto = `${inteiro} ${num}/${den}`;
  return { texto, exato };
}

/** 15.875 → '5/8"' ; 22 → '≈ 55/64"' */
export function formatInch(mm) {
  const f = fracaoPol(mm);
  if (!f) return "—";
  return `${f.exato ? "" : "≈ "}${f.texto}"`;
}

/** 15.875 → '15,88 mm · 5/8"' */
export function formatDim(mm) {
  if (!isNum(mm)) return "—";
  return `${formatMm(mm)} mm · ${formatInch(mm)}`;
}

/** "44,45" | "44.45" → 44.45 ; inválido → null */
export function parseMm(texto) {
  const t = String(texto ?? "").trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

/**
 * Polegada → mm. Aceita "1 3/4", "1.1/2" (estilo lista de preços), "3/16",
 * "2", "1.75", "1,75" e aspas opcionais. Inválido → null.
 */
export function parseInch(texto) {
  const t = String(texto ?? "").trim().replace(/["”]/g, "").trim();
  if (!t) return null;
  let m = t.match(/^(\d+)[\s.]+(\d+)\/(\d+)$/);
  if (m) {
    const den = Number(m[3]);
    if (!den) return null;
    return (Number(m[1]) + Number(m[2]) / den) * MM_POR_POL;
  }
  m = t.match(/^(\d+)\/(\d+)$/);
  if (m) {
    const den = Number(m[2]);
    if (!den) return null;
    return (Number(m[1]) / den) * MM_POR_POL;
  }
  m = t.replace(",", ".").match(/^\d+(\.\d+)?$/);
  if (m) return Number(t.replace(",", ".")) * MM_POR_POL;
  return null;
}

/** Converte o texto digitado no campo para mm conforme a unidade ativa. */
export function parseEntrada(texto, unidade) {
  return unidade === "pol" ? parseInch(texto) : parseMm(texto);
}

/** Texto para exibir no campo ao trocar de unidade (sem "≈" nem aspas). */
export function textoParaUnidade(mm, unidade) {
  if (!isNum(mm)) return "";
  if (unidade === "pol") return fracaoPol(mm).texto;
  return formatMm(mm);
}

/** Seção radial = (Externo − Interno) / 2 */
export function secao(interno, externo) {
  if (!isNum(interno) || !isNum(externo)) return null;
  const s = (Number(externo) - Number(interno)) / 2;
  return s > 0 ? s : null;
}
