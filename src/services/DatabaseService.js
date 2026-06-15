import Papa from 'papaparse';
import CATEGORIES, { FIELD_TO_CSV } from '../config/categories';

// ── Importar TODOS os CSVs via Vite raw ─────────────────────────
// Cada CSV é importado como string raw para parsing com PapaParse.
const csvModules = import.meta.glob('../data/data_*.csv', { query: '?raw', import: 'default', eager: true });

class DatabaseService {
  constructor() {
    /** @type {Map<string, Array<object>>} tipo → parsed rows */
    this.dataByTipo = new Map();
    this.loaded = false;
  }

  /**
   * Carrega e parseia todos os CSVs de uma vez.
   */
  async loadData() {
    if (this.loaded) return;

    for (const cat of CATEGORIES) {
      // Encontrar o módulo raw correspondente
      const key = Object.keys(csvModules).find((k) => k.endsWith(cat.csvFile));
      if (!key) {
        console.warn(`CSV não encontrado para ${cat.tipo}: ${cat.csvFile}`);
        continue;
      }
      const rawCsv = csvModules[key];

      const result = Papa.parse(rawCsv, {
        header: true,
        dynamicTyping: true,
        delimiter: ';',
        comments: '#',
        skipEmptyLines: true,
      });

      // Filtrar linhas vazias (sem código)
      const validRows = result.data.filter((row) => row.Codigo);
      this.dataByTipo.set(cat.tipo, validRows);
    }

    // Também carregar o CSV legado (data.csv) para manter compatibilidade
    // caso exista dados lá que não estejam nos novos CSVs
    this.loaded = true;
  }

  /**
   * Retorna todos os tipos disponíveis (ordenados).
   */
  async getTipos() {
    await this.loadData();
    return CATEGORIES
      .filter((cat) => {
        const data = this.dataByTipo.get(cat.tipo);
        return data && data.length > 0;
      })
      .map((cat) => cat.tipo)
      .sort();
  }

  /**
   * Retorna a contagem de peças por tipo.
   */
  async getContagemPorTipo() {
    await this.loadData();
    const contagem = {};
    for (const cat of CATEGORIES) {
      const data = this.dataByTipo.get(cat.tipo);
      if (data && data.length > 0) {
        contagem[cat.tipo] = data.length;
      }
    }
    return contagem;
  }

  /**
   * Busca peças com filtros dinâmicos.
   *
   * @param {object} params
   * @param {string} params.tipo - Tipo de peça (vazio = todos)
   * @param {string} params.tolerancia - Tolerância numérica
   * @param {object} params.[fieldName] - Valores de busca dinâmicos (interno, externo, etc.)
   */
  async buscarPecas(params) {
    await this.loadData();
    const { tipo, tolerancia, ...searchFields } = params;
    const tol = Number(tolerancia) || 0;

    const results = [];

    // Determinar quais categorias buscar
    const categoriesToSearch = tipo
      ? CATEGORIES.filter((c) => c.tipo === tipo)
      : CATEGORIES;

    for (const cat of categoriesToSearch) {
      const data = this.dataByTipo.get(cat.tipo);
      if (!data) continue;

      for (const peca of data) {
        if (!peca.Codigo) continue;

        let matches = true;

        // Para cada campo de busca preenchido, verificar se a peça atende
        for (const [fieldKey, searchValue] of Object.entries(searchFields)) {
          const numVal = Number(searchValue);
          if (!numVal) continue; // Campo vazio, ignorar

          // Converter field key para coluna CSV
          const csvCol = FIELD_TO_CSV[fieldKey];
          if (!csvCol) continue;

          let pecaVal = Number(peca[csvCol]);
          
          // Fallback: se não tiver AlturaBase, usar Altura
          if (isNaN(pecaVal) && csvCol === "AlturaBase") {
            pecaVal = Number(peca["Altura"]);
          }

          if (isNaN(pecaVal)) {
            matches = false;
            break;
          }

          if (Math.abs(pecaVal - numVal) > tol) {
            matches = false;
            break;
          }
        }

        if (matches) {
          // Adicionar info do tipo ao resultado
          results.push({
            ...peca,
            Tipo: cat.tipo,
            _categoria: cat.label,
          });
        }
      }
    }

    return results;
  }
}

export default new DatabaseService();
