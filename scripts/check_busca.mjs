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
  `produtos: ${db.produtos.length} (legado sobreposto pelo APC: ${db.sobrepostos}; APC fora da lista 2025: ${db.ocultos}; linhas repetidas: ${db.repetidos})`
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
assert.equal(apc("1117").tipo, "Raspador metálico");
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
// Raspadores GA/GAE/GAG/AGK1/GA1/AGK2 têm carcaça metálica: Tipo "Raspador metálico", perfil/material/aplicação mantidos
for (const m of ["GA", "GAE", "GAG", "AGK1", "GA1", "AGK2"]) {
  const ps = db.produtos.filter((p) => p.origem === "apc" && p.perfil === m);
  assert.ok(ps.length > 0 && ps.every((p) => p.tipo === "Raspador metálico" && p.modelo === m), m);
}
assert.equal(apc("1117").material, "NBR");
// A CSV antiga raspador-metalico.csv entra no mesmo Tipo, com o Perfil "Metálico"
const legMet = db.produtos.filter((p) => p.origem === "raspador-metalico.csv");
assert.ok(legMet.length > 0 && legMet.every((p) => p.tipo === "Raspador metálico" && p.modelo === "Metálico"));
assert.ok(!db.produtos.some((p) => p.tipo === "Raspador" && p.modelo === "Metálico"));
// Código da lista com erro de dígito na Referência casa pela medida; "STD.GAXETA" não vira código
assert.ok(apc("5720") && apc("5749") && apc("6566") && apc("6187") && apc("6268"));
assert.equal(db.produtos.filter((p) => p.codigo.startsWith("625002874")).length, 0);
// Sigla que o catálogo arquiva noutro perfil vira Variante dele (BGO → BG)
assert.equal(apc("RT0911").perfil, "BG");

// Erratas confirmadas no catálogo de retentores 2021
const extra = (p, label) => p.extras.find((e) => e.label === label)?.value;
assert.equal(apc("AG7677").catalogo, "retentores-2021");
assert.deepEqual([apc("AG7677").interno, apc("AG7677").externo, apc("AG7677").altura], [5, 30, 14]);
assert.equal(apc("4502").altura, 15);
assert.equal(apc("1405").externo, 68.15);
assert.equal(apc("AG8255").tipo, "Raspador");
assert.equal(apc("AG8255").perfil, "GR");
assert.equal(apc("AG8255").material, "HNBR");
assert.deepEqual(apc("AG8255").aplicacoes, ["haste"]);
assert.equal(apc("AG8307").material, "FPM");

// Extração limpa da lista 2025 (sem "PC" colado, materiais compostos NBR/NYLON e NBR/FPM)
assert.equal(apc("AX0347").material, "NBR/FPM");
assert.equal(apc("TCS0681").perfil, "AGNA");
assert.equal(apc("TCS0681").material, "NBR/NYLON");

// Cor separada de Material para Extras nos retentores (O-rings mantêm nome da seção)
assert.equal(apc("TCS0849").material, "NBR");
assert.equal(extra(apc("TCS0849"), "Cor"), "Azul");
assert.equal(apc("5839").material, "FPM");
assert.equal(extra(apc("5839"), "Cor"), "Preto");
assert.ok(db.produtos.filter((p) => p.tipo === "Retentor").every((p) => !p.material.includes(" ")));

// Códigos reutilizados na lista 2025 prevalecem sobre o catálogo 2021
assert.equal(apc("3994").catalogo, "lista-2025");
assert.deepEqual([apc("3994").perfil, apc("3994").interno, apc("3994").externo, apc("3994").altura], ["BG", 60.32, 85.1, 11.1]);
assert.equal(apc("4620").tipo, "Raspador metálico");
assert.equal(apc("4620").perfil, "GA1");
assert.equal(apc("6639").tipo, "Raspador metálico");
assert.equal(apc("6639").perfil, "GAE");
assert.equal(apc("TCS0910").catalogo, "lista-2025");
assert.equal(apc("TCS0910").referencia, "03227");

// Equivalência RTxxxx ↔ TCSxxxx: ambos permanecem em linha e pesquisáveis; divergente não vincula
assert.equal(apc("RT0080").material, "NBR");
assert.equal(extra(apc("RT0080"), "Equivalente"), "TCS0080");
assert.equal(extra(apc("TCS0080"), "Equivalente"), "RT0080");
assert.equal(extra(apc("RT0911"), "Equivalente"), "TCS0911");
assert.equal(apc("TCS0544").referencia, "01181");
assert.equal(extra(apc("RT0021"), "Equivalente"), undefined);
assert.equal(apc("TCS0021"), undefined);
assert.equal(extra(apc("RT1005"), "Equivalente"), undefined);

// Consenso retentores 2021 + lista 2025 contra gaxetas 2022 nos raspadores compartilhados
assert.equal(apc("9094").interno, 30);
assert.equal(apc("1520").material, "PU");
assert.equal(apc("1529").perfil, "GAG");
assert.equal(apc("1529").tipo, "Raspador metálico");
assert.equal(apc("4479").altura, 11);

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

// CSVs antigas pesquisáveis por medida (Arruela STD)
assert.ok(db.buscar({ tolerancia: 0.5, medidas: { interno: 25.4 } }).some((p) => p.origem === "arruela-std.csv"));

// Anéis O-ring (lista 01/2025): Tipo Anel, Perfil O-ring, material da seção, sem aplicação
const aneis = db.produtos.filter((p) => p.tipo === "Anel");
const orings = aneis.filter((p) => p.origem === "apc");
assert.equal(orings.length, 3123);
assert.ok(orings.every((p) => p.modelo === "O-ring" && p.aplicacoes.length === 0));
assert.deepEqual(
  [...new Set(orings.map((p) => p.material))].sort(),
  ["EPDM", "FPM marrom", "FPM preto", "FPM verde", "Nitrílica Dureza 70", "Nitrílica Dureza 90", "Silicone", "Silicone Dureza 70"]
);
// O-ring não é Tipo: o Tipo Anel só tem o Perfil O-ring (lista 01/2025 + os 25 de PU da CSV antiga), sem código repetido
assert.ok(!db.produtos.some((p) => p.tipo === "O-ring"));
assert.ok(aneis.every((p) => p.perfil === "O-ring"));
const oringPu = aneis.filter((p) => p.origem === "o-ring-pu.csv");
assert.equal(oringPu.length, 25);
assert.ok(oringPu.every((p) => p.material === "PU"));
assert.equal(new Set(aneis.map((p) => p.busca)).size, aneis.length);
// PU só traz D.I. e cordão: Ø externo e altura saem da seção
const pu5598 = oringPu.find((p) => p.codigo === "5598");
assert.deepEqual([pu5598.interno, pu5598.externo, pu5598.altura, pu5598.secao], [47.35, 50.91, 1.78, 1.78]);
// D.I. = Ø interno; W = altura e seção; ØEXT = D.I. + 2·W
const o2002 = apc("2002");
assert.equal(o2002.material, "Nitrílica Dureza 70");
assert.deepEqual([o2002.interno, o2002.externo, o2002.altura], [1.07, 3.61, 1.27]);
assert.ok(Math.abs(o2002.secao - 1.27) < 1e-9);
assert.ok(orings.every((p) => Math.abs(p.secao - p.altura) < 1e-3 && p.externo > p.interno));
assert.equal(apc("92003").material, "Nitrílica Dureza 90");
assert.equal(apc("M7581").material, "FPM marrom");
assert.equal(apc("S7526").material, "Silicone");
assert.ok(db.buscar({ tolerancia: 0, medidas: { interno: 1.07, secao: 1.27 } }).some((p) => p.codigo === "2002"));
// Sem aplicação = genérico: aparece em Haste e em Êmbolo, nunca em Eixo
for (const [aplic, esperado] of [["haste", true], ["embolo", true], ["eixo", false]]) {
  const sel = { ...SELECAO_VAZIA, tipo: ["Anel"], modelo: ["O-ring"], material: ["FPM verde"], aplicacao: [aplic] };
  assert.equal(aplicarFacetas(db.produtos, sel).some((p) => p.codigo === "V2005"), esperado, `O-ring em ${aplic}`);
}
// As CSVs antigas de anel (Unitário, Quad / Arruela, Teflon, Backup, GT) saíram do painel
assert.ok(!db.produtos.some((p) => /^anel-/.test(p.origem)));
assert.equal(db.buscar({ codigo: "8006" }).filter((p) => p.codigo === "8006").length, 0);

// Linha repetida idêntica vira um cartão só; gêmeas de perfil diferente continuam as duas
assert.ok(db.repetidos > 0);
assert.equal(db.produtos.filter((p) => p.codigo === "4730PM").length, 1);
assert.equal(db.produtos.filter((p) => p.codigo === "7044PM").length, 2);

console.log("busca/funil: todos os cenários OK");
