// Auto-checagem de src/utils/units.js (cenários da spec dimension-units).
// Uso: node scripts/check_units.mjs
import assert from "node:assert/strict";
import { formatDim, formatInch, formatMm, parseInch, parseMm, secao, textoParaUnidade } from "../src/utils/units.js";

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≉ ${b}`);

assert.equal(formatMm(3.175), "3,18");
assert.equal(formatMm(""), "—");
assert.equal(formatMm(null), "—");
assert.equal(formatDim(15.875), '15,88 mm · 5/8"');
assert.equal(formatDim(22), '22,00 mm · ≈ 55/64"');
assert.equal(formatInch(50.8), '2"');
assert.equal(formatInch(44.45), '1 3/4"');
assert.equal(formatDim(secao(6.35, 12.7)), '3,18 mm · 1/8"');
assert.equal(secao(null, 12.7), null);

close(parseInch("1 3/4"), 44.45);
close(parseInch("1.1/2"), 38.1);
close(parseInch("3/16"), 4.7625);
close(parseInch("1,75"), 44.45);
close(parseInch('2"'), 50.8);
assert.equal(parseInch("1 3/"), null);
assert.equal(parseInch("abc"), null);
assert.equal(parseMm("44,45"), 44.45);
assert.equal(parseMm("4a"), null);

assert.equal(textoParaUnidade(25.4, "pol"), "1");
assert.equal(textoParaUnidade(44.45, "mm"), "44,45");

console.log("units.js: todos os cenários OK");
