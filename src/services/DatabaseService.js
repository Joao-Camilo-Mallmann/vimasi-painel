import Papa from 'papaparse';
import { LEGACY_MAP, getColunasLegado } from '../config/taxonomia';
import { secao as calcSecao } from '../utils/units';

// ── Importar TODOS os CSVs via Vite raw ─────────────────────────
const apcModules = import.meta.glob('../data/catalogo_apc.csv', { query: '?raw', import: 'default', eager: true });
const legacyModules = import.meta.glob('../data/data_*.csv', { query: '?raw', import: 'default', eager: true });

const CAMPOS_DIM = ['interno', 'externo', 'altura', 'alturaBase', 'secao'];

const parseCsv = (raw) =>
  Papa.parse(raw, {
    header: true,
    dynamicTyping: false,
    delimiter: ';',
    comments: '#',
    skipEmptyLines: true,
  }).data;

const num = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const chaveCodigo = (c) => String(c ?? '').trim().toUpperCase();

// Ordem natural: "GT 25" antes de "GT 124"
const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

/** Rótulo do modelo no funil: modelos da linha pneumática são distintos dos hidráulicos. */
const rotuloModelo = (modelo, linha) =>
  modelo && linha === 'Pneumática' ? `${modelo} · Pneumática` : modelo || '—';

/** Perfil que existe em mais de um Tipo (ex.: "B" gaxeta × "B" retentor) ganha o Tipo no rótulo do funil. */
function desambiguarPerfis(produtos) {
  const tipos = new Map();
  for (const p of produtos) {
    if (!tipos.has(p.modelo)) tipos.set(p.modelo, new Set());
    tipos.get(p.modelo).add(p.tipo);
  }
  for (const p of produtos) {
    if (p.tipo === 'Retentor' && tipos.get(p.modelo).size > 1) p.modelo = `${p.modelo} · Retentor`;
  }
}

function finalizar(p) {
  if (p.secao === null || p.secao === undefined) p.secao = calcSecao(p.interno, p.externo);
  // O-ring: Ø externo e altura derivados da seção
  if (p.externo === null && p.interno !== null && p.secao !== null && p.tipo === 'O-ring') {
    p.externo = p.interno + 2 * p.secao;
    p.altura = p.secao;
  }
  p.busca = chaveCodigo(p.codigo);
  return p;
}

function produtoApc(row) {
  const ficha = row.TempMin !== '' || row.PressaoPsi !== ''
    ? {
        pressao: num(row.PressaoPsi),
        tempMin: num(row.TempMin),
        tempMax: num(row.TempMax),
        velocidade: num(row.VelocidadeMs),
      }
    : null;
  const extras = (row.Extras || '')
    .split('|')
    .filter(Boolean)
    .map((kv) => {
      const [label, value] = kv.split('=');
      return { label, value };
    });
  return finalizar({
    origem: 'apc',
    codigo: String(row.Codigo),
    referencia: row.Referencia || '',
    tipo: row.Tipo || 'Outros',
    modelo: rotuloModelo(row.Modelo, row.Linha),
    perfil: row.Modelo || '', // exibição: sem o sufixo de linha do funil
    material: row.Material || '—',
    aplicacoes: row.Aplicacao ? row.Aplicacao.split(',') : [],
    linha: row.Linha || '',
    interno: num(row.Interno),
    externo: num(row.Externo),
    altura: num(row.Altura),
    alturaBase: null,
    secao: null,
    extras,
    ficha,
    descricao: row.Descricao || '',
    unidadeNominal: row.UnidadeNominal || 'mm',
    fonte: row.Fonte,
    catalogo: row.Catalogo || '',
    pagina: row.Pagina || '',
  });
}

function produtoLegado(row, arquivo, cfg) {
  const colunas = getColunasLegado(cfg);
  const p = {
    origem: arquivo,
    codigo: String(row.Codigo).trim(),
    referencia: '',
    tipo: cfg.tipo,
    modelo: cfg.modelo,
    perfil: cfg.modelo,
    material: /PM$/i.test(String(row.Codigo).trim()) ? 'Polymax' : cfg.material || '—',
    aplicacoes: cfg.aplicacoes,
    linha: '',
    interno: null,
    externo: null,
    altura: null,
    alturaBase: null,
    secao: null,
    extras: [],
    ficha: null,
    descricao: '',
    unidadeNominal: 'mm',
    fonte: 'legado',
    catalogo: '',
    pagina: '',
  };
  for (const [col, destino] of Object.entries(colunas)) {
    const v = row[col];
    if (v === undefined || v === null || v === '') continue;
    if (CAMPOS_DIM.includes(destino)) p[destino] = num(v);
    else p.extras.push({ label: destino, value: String(v).replace('.', ',') });
  }
  return finalizar(p);
}

class DatabaseService {
  constructor() {
    /** @type {Array<object>} */
    this.produtos = [];
    this.sobrepostos = 0;
    this.loaded = false;
  }

  /** Carrega catálogo APC + CSVs antigas num único array normalizado. */
  loadData() {
    if (this.loaded) return;

    const apcRaw = Object.values(apcModules)[0];
    const apc = apcRaw ? parseCsv(apcRaw).filter((r) => r.Codigo).map(produtoApc) : [];
    const codigosApc = new Set(apc.map((p) => chaveCodigo(p.codigo)));

    const legado = [];
    for (const [path, raw] of Object.entries(legacyModules)) {
      const arquivo = path.split('/').pop();
      const cfg = LEGACY_MAP[arquivo];
      if (!cfg) {
        console.warn(`CSV sem mapeamento em taxonomia.js: ${arquivo}`);
        continue;
      }
      for (const row of parseCsv(raw)) {
        if (!row.Codigo) continue;
        // O APC prevalece quando o mesmo código existe nas duas fontes
        if (codigosApc.has(chaveCodigo(row.Codigo))) {
          this.sobrepostos += 1;
          continue;
        }
        legado.push(produtoLegado(row, arquivo, cfg));
      }
    }

    desambiguarPerfis([...apc, ...legado]);
    this.produtos = [...apc, ...legado]
      .sort((a, b) => collator.compare(a.codigo, b.codigo))
      .map((p, i) => ({ ...p, id: i }));
    this.loaded = true;
  }

  /**
   * Busca pela medida (e/ou código). Valores de medida já chegam em mm.
   *
   * @param {object} params
   * @param {string} params.codigo - trecho do Código
   * @param {number|string} params.tolerancia - ± em mm
   * @param {{interno?: number, externo?: number, altura?: number, secao?: number}} params.medidas
   */
  buscar({ codigo = '', tolerancia = 0, medidas = {} } = {}) {
    this.loadData();
    const tol = Number(tolerancia) || 0;
    const termo = chaveCodigo(codigo);
    const filtros = Object.entries(medidas).filter(([, v]) => v !== null && v !== undefined && Number.isFinite(v));

    return this.produtos.filter((p) => {
      if (termo && !p.busca.includes(termo)) return false;
      for (const [campo, alvo] of filtros) {
        const v = p[campo];
        if (v === null || v === undefined) return false;
        if (Math.abs(v - alvo) > tol + 1e-9) return false;
      }
      return true;
    });
  }
}

export default new DatabaseService();
