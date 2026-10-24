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
const legado = readdirSync(dataDir).filter((n) => n.endsWith(".csv") && n !== "catalogo_apc.csv");

let src = readFileSync(join(root, "src/services/DatabaseService.js"), "utf-8")
  .replace(/import\.meta\.glob\('\.\.\/data\/catalogo_apc\.csv'[^)]*\)/, ler(["catalogo_apc.csv"]))
  .replace(/import\.meta\.glob\(\['\.\.\/data\/\*\.csv'[^)]*\)/, ler(legado))
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
console.log(
  `produtos: ${db.produtos.length} (legado sobreposto pelo APC: ${db.sobrepostos}; APC fora da lista 2025: ${db.ocultos})`
);

// Lista 2025 = fonte mestra: item dos catálogos fora dela não aparece, nem pela CSV antiga que o repetia
assert.ok(db.ocultos > 0);
assert.ok(db.produtos.filter((p) => p.origem === "apc").every((p) => p.naLista === true));
assert.equal(db.buscar({ codigo: "8016PM" }).length, 0);

// Código duplicado entre fontes aparece uma vez, com facetas do APC
const p9053 = db.buscar({ codigo: "9053PM" }).filter((p) => p.codigo === "9053PM");
assert.equal(p9053.length, 1);
assert.equal(p9053[0].modelo, "AG 13");
assert.equal(p9053[0].material, "Polymax");

// Busca só pelo código: referência não entra
assert.ok(db.buscar({ codigo: "12500250" }).every((p) => p.codigo.includes("12500250")));

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

// Catálogo × desenhos: Tipo B vai na haste e no êmbolo; KDG é raspador; RP-08 é amortecimento
const apc = (cod) => db.produtos.find((p) => p.codigo === cod && p.origem === "apc");
assert.deepEqual(apc("5702").aplicacoes, ["haste", "embolo"]);
assert.equal(apc("6303").tipo, "Raspador");
assert.deepEqual(apc("9898").aplicacoes, ["amortecimento"]);
// Genéricas (sem aplicação) não aparecem em Amortecimento
const amort = aplicarFacetas(db.produtos, { ...SELECAO_VAZIA, aplicacao: ["amortecimento"] });
assert.ok(amort.length > 0 && amort.every((p) => p.aplicacoes.includes("amortecimento")));

// Retentores: índice do catálogo 2021; Tipo Retentor, aplicação Eixo
const r9965 = apc("9965");
assert.equal(r9965.tipo, "Retentor");
assert.equal(r9965.catalogo, "retentores-2021");
assert.deepEqual(r9965.aplicacoes, ["eixo"]);
assert.deepEqual([r9965.interno, r9965.externo, r9965.altura], [15.9, 25.4, 4.5]);
// H1/H2: Altura = H2 (total)
assert.equal(apc("1023").altura, 7);
// Variante de material (BRGF no índice) fica no perfil-base da página
assert.equal(apc("1307").perfil, "BRG");
assert.equal(apc("1307").material, "FPM");
// Raspadores do catálogo de retentores vão na haste
assert.equal(apc("1117").tipo, "Raspador");
assert.deepEqual(apc("1117").aplicacoes, ["haste"]);
// "B" do retentor não se mistura com o Tipo B da gaxeta no funil
assert.ok(db.produtos.filter((p) => p.modelo === "B").every((p) => p.tipo === "Gaxeta"));
assert.ok(db.produtos.some((p) => p.modelo === "B · Retentor"));

// Retentores só na lista 2025: perfil desconhecido do catálogo 2021 vem da descrição; sem perfil = "—"
assert.equal(apc("TCS0855").perfil, "AGNA");
assert.equal(apc("TCS0855").modelo, "AGNA");
assert.equal(apc("TCS0855").tipo, "Retentor");
assert.equal(apc("AG7930").modelo, "—");
assert.ok(!db.produtos.some((p) => p.modelo === "— · Retentor"));
assert.equal(contarFacetas(db.produtos, SELECAO_VAZIA).modelo.at(-1).valor, "—");
// "20,00 X 28,00 6,00": faltou um X na descrição da lista
assert.deepEqual([apc("9203").interno, apc("9203").externo, apc("9203").altura], [20, 28, 6]);
// Variante de material sem material na descrição: BRF / BRG-F → FPM
assert.equal(apc("3531").perfil, "BR");
assert.equal(apc("3531").material, "FPM");
assert.equal(apc("5508-2").material, "FPM");
// Mesmo código em duas tabelas do catálogo: a lista vale para as duas linhas
assert.ok(db.buscar({ codigo: "7044PM" }).some((p) => p.modelo === "AG 14"));
assert.deepEqual(db.produtos.filter((p) => p.codigo === "4862").map((p) => p.modelo).sort(), ["AGK1", "AGK2"]);
// Código da lista com erro de dígito na Referência casa pela medida; "STD.GAXETA" não vira código
assert.ok(apc("5720") && apc("5749") && apc("6566") && apc("6187") && apc("6268"));
assert.equal(db.produtos.filter((p) => p.codigo.startsWith("625002874")).length, 0);
// Sigla que o catálogo arquiva noutro perfil vira Variante dele (BGO → BG)
assert.equal(apc("RT0911").perfil, "BG");

// Funil: Retentor → BR → NBR → Eixo (Ø15,90 ±0,1)
const ret = db.buscar({ tolerancia: 0.1, medidas: { interno: 15.9 } });
let selR = { ...SELECAO_VAZIA };
for (const [k, v] of [["tipo", "Retentor"], ["modelo", "BR"], ["material", "NBR"], ["aplicacao", "eixo"]]) {
  assert.ok(contarFacetas(ret, selR)[k].some((o) => o.valor === v), `opção ${k}=${v} disponível`);
  selR = { ...selR, [k]: [v] };
}
assert.ok(aplicarFacetas(ret, selR).some((p) => p.codigo === "9965"));
// Retentor não aparece em Haste nem Êmbolo
const haste = aplicarFacetas(db.produtos, { ...SELECAO_VAZIA, aplicacao: ["haste", "embolo"] });
assert.ok(!haste.some((p) => p.tipo === "Retentor"));
// Medida em polegada = mm também nos retentores
const retMm = db.buscar({ tolerancia: 0.05, medidas: { interno: 25.4 } }).filter((p) => p.tipo === "Retentor");
const retPol = db.buscar({ tolerancia: 0.05, medidas: { interno: parseInch("1") } }).filter((p) => p.tipo === "Retentor");
assert.ok(retMm.length > 0 && retMm.length === retPol.length);

// Legado agora pesquisável (Teflon)
assert.ok(db.buscar({ tolerancia: 0.5, medidas: { interno: 25.4 } }).some((p) => p.origem === "anel-teflon.csv"));

console.log("busca/funil: todos os cenários OK");
