// Teste de integração do carregamento + busca + funil, fora do Vite.
// Substitui import.meta.glob por leitura em disco e roda os cenários das specs.
// Uso: node scripts/check_busca.mjs
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "src/data");
const url = (p) => pathToFileURL(join(root, p)).href;

const ler = (nomes) =>
  JSON.stringify(Object.fromEntries(nomes.map((n) => [`../data/${n}`, readFileSync(join(dataDir, n), "utf-8")])));
const legado = readdirSync(dataDir).filter((n) => /^data_.*\.csv$/.test(n));

let src = readFileSync(join(root, "src/services/DatabaseService.js"), "utf-8")
  .replace(/import\.meta\.glob\('\.\.\/data\/catalogo_apc\.csv'[^)]*\)/, ler(["catalogo_apc.csv"]))
  .replace(/import\.meta\.glob\('\.\.\/data\/data_\*\.csv'[^)]*\)/, ler(legado))
  .replace("'../config/taxonomia'", `'${url("src/config/taxonomia.js")}'`)
  .replace("'../utils/units'", `'${url("src/utils/units.js")}'`)
  .replace("from 'papaparse'", `from '${url("node_modules/papaparse/papaparse.js")}'`);
const dir = mkdtempSync(join(tmpdir(), "vimasi-"));
const tmp = join(dir, "db.mjs");
writeFileSync(tmp, src);
// imports sem extensão (estilo Vite) não resolvem no Node
const facetsTmp = join(dir, "facets.mjs");
writeFileSync(
  facetsTmp,
  readFileSync(join(root, "src/utils/facets.js"), "utf-8").replace('"../config/taxonomia"', `"${url("src/config/taxonomia.js")}"`)
);

const { default: db } = await import(pathToFileURL(tmp).href);
const { aplicarFacetas, contarFacetas, etapasFunil, SELECAO_VAZIA } = await import(pathToFileURL(facetsTmp).href);
const { parseInch } = await import(url("src/utils/units.js"));

db.loadData();
console.log(`produtos: ${db.produtos.length} (legado sobreposto pelo APC: ${db.sobrepostos})`);

// Código duplicado entre fontes aparece uma vez, com facetas do APC
const p8016 = db.buscar({ codigo: "8016PM" }).filter((p) => p.codigo === "8016PM");
assert.equal(p8016.length, 1);
assert.equal(p8016[0].modelo, "AG 13");
assert.equal(p8016[0].material, "Polymax");

// Busca por referência
assert.ok(db.buscar({ codigo: "12500250" }).some((p) => p.referencia.includes("12500250") && p.codigo !== "12500250"));

// Medida em polegada = medida em mm
const porMm = db.buscar({ tolerancia: 0.5, medidas: { interno: 44.45 } });
const porPol = db.buscar({ tolerancia: 0.5, medidas: { interno: parseInch("1 3/4") } });
assert.equal(porMm.length, porPol.length);
assert.ok(porMm.every((p) => Math.abs(p.interno - 44.45) <= 0.5 + 1e-9));

// Funil: Gaxeta → B → Polymax → Haste
const passos = [
  ["tipo", "Gaxeta"],
  ["modelo", "B"],
  ["material", "Polymax"],
  ["aplicacao", "haste"],
];
let sel = { ...SELECAO_VAZIA };
const contagens = [porMm.length];
for (const [k, v] of passos) {
  const ops = contarFacetas(porMm, sel)[k];
  assert.ok(ops.some((o) => o.valor === v), `opção ${k}=${v} disponível`);
  sel = { ...sel, [k]: [v] };
  contagens.push(aplicarFacetas(porMm, sel).length);
}
console.log("funil Ø44,45 ±0,5:", contagens.join(" → "));
assert.deepEqual(etapasFunil(porMm, sel).map((e) => e.count), contagens);
const final = aplicarFacetas(porMm, sel);
assert.ok(final.length > 0 && final.every((p) => p.ficha?.pressao === 8000));

// Ordem livre: Polymax primeiro
const soPm = aplicarFacetas(porMm, { ...SELECAO_VAZIA, material: ["Polymax"] });
assert.ok(soPm.every((p) => p.material === "Polymax"));
const tiposPm = contarFacetas(porMm, { ...SELECAO_VAZIA, material: ["Polymax"] }).tipo;
assert.equal(tiposPm.reduce((a, o) => a + o.count, 0), soPm.length);

// Seção
const sec = db.buscar({ tolerancia: 0, medidas: { secao: 3.175 } });
assert.ok(sec.length > 0 && sec.every((p) => Math.abs(p.secao - 3.175) < 1e-6));

// Legado agora pesquisável (Teflon)
assert.ok(db.buscar({ tolerancia: 0.5, medidas: { interno: 25.4 } }).some((p) => p.origem === "data_anel_teflon.csv"));

console.log("busca/funil: todos os cenários OK");
