import Papa from 'papaparse';
import csvData from '../data/data.csv?raw';

class DatabaseService {
  constructor() {
    this.data = [];
    this.loaded = false;
  }

  async loadData() {
    if (this.loaded) return;
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvData, {
        header: true,
        dynamicTyping: true,
        delimiter: ';',
        comments: '#',
        complete: (results) => {
          this.data = results.data;
          this.loaded = true;
          resolve();
        },
        error: (error) => reject(error)
      });
    });
  }

  async getTipos() {
    await this.loadData();
    const tipos = new Set();
    this.data.forEach(peca => {
      if (peca.Tipo) tipos.add(peca.Tipo);
    });
    return Array.from(tipos).sort();
  }

  async buscarPecas(params) {
    await this.loadData();
    const { tipo, interno, externo, altura, alturaBase, tolerancia } = params;
    
    const tol = Number(tolerancia) || 0;
    
    return this.data.filter(peca => {
      // Ignora linhas vazias
      if (!peca.Codigo) return false;

      // Filtro de tipo (opcional)
      if (tipo && peca.Tipo && !peca.Tipo.toLowerCase().includes(tipo.toLowerCase())) {
        return false;
      }

      // Filtros numéricos
      const intNum = Number(interno);
      const extNum = Number(externo);
      const altNum = Number(altura);
      const altBaseNum = Number(alturaBase);

      if (intNum && Math.abs(Number(peca.Interno) - intNum) > tol) return false;
      if (extNum && Math.abs(Number(peca.Externo) - extNum) > tol) return false;
      if (altNum && Math.abs(Number(peca.AlturaTotal) - altNum) > tol) return false;
      if (altBaseNum && Math.abs(Number(peca.AlturaBase) - altBaseNum) > tol) return false;

      return true;
    });
  }
}

export default new DatabaseService();
