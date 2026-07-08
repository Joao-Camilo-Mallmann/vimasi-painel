import { Check, Copy, Loader2, Ruler, X } from "lucide-react";
import { useState } from "react";
import SearchForm from "./components/SearchForm";
import { FIELD_DEFS, getCategoryByTipo } from "./config/categories";
import DatabaseService from "./services/DatabaseService";
import { getTipoBadgeStyle } from "./utils/tipoStyles";

/**
 * Retorna as colunas de dimensão a renderizar na tabela,
 * baseado no tipo selecionado (ou união para "Todos").
 */
function getDisplayColumns(tipo) {
  if (tipo) {
    const cat = getCategoryByTipo(tipo);
    if (cat) {
      // Retornar todas as colunas exceto Codigo e Tipo
      return cat.columns
        .filter((c) => c !== "Codigo" && c !== "Tipo")
        .map((csvCol) => {
          // Encontrar o FIELD_DEF correspondente
          const fieldKey = Object.entries(
            Object.fromEntries(
              Object.entries({
                interno: "Interno",
                externo: "Externo",
                alturaBase: "AlturaBase",
                altura: "Altura",
              }),
            ),
          ).find(([, csv]) => csv === csvCol);
          const def = fieldKey ? FIELD_DEFS[fieldKey[0]] : null;
          return {
            csvCol,
            label: def?.label || csvCol,
            unit: def?.unit || "mm",
          };
        });
    }
  }
  // Busca global: mostrar as colunas mais universais
  return [
    { csvCol: "Interno", label: "Ø Interno", unit: "mm" },
    { csvCol: "Externo", label: "Ø Externo", unit: "mm" },
    { csvCol: "Altura", label: "Altura", unit: "mm" },
    { csvCol: "AlturaBase", label: "Alt. Base", unit: "mm" },
  ];
}

/**
 * Verifica se uma coluna tem dados relevantes nos resultados.
 */
function columnHasData(results, csvCol) {
  return results.some((r) => {
    const val = r[csvCol];
    return (
      val !== undefined && val !== null && val !== "" && !isNaN(Number(val))
    );
  });
}

function App() {
  const [resultados, setResultados] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [searchTipo, setSearchTipo] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCopy = (codigo) => {
    navigator.clipboard.writeText(codigo);
    setCopiedCode(codigo);
  };

  const handleSearch = async (params) => {
    setLoading(true);
    setSearched(false);
    setSearchTipo(params.tipo || "");
    try {
      await new Promise((resolve) => setTimeout(resolve, 400));
      const results = await DatabaseService.buscarPecas(params);
      setResultados(results);
      setSearched(true);
    } catch (err) {
      console.error("Erro na busca:", err);
    } finally {
      setLoading(false);
    }
  };

  // Colunas dinâmicas para a tabela
  const allColumns = getDisplayColumns(searchTipo);
  // Filtrar colunas sem dados (só em busca global)
  const visibleColumns = searchTipo
    ? allColumns
    : allColumns.filter((col) => columnHasData(resultados, col.csvCol));

  return (
    <div className="min-h-screen relative overflow-hidden bg-primary-dark">
      {/* Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-accent-gold/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-accent-red/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="glass-strong fixed top-0 w-full z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Vimasi"
              className="h-10 object-contain drop-shadow-md"
            />
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 hover:border-accent-gold/40 hover:bg-white/5 transition-all text-xs tracking-widest text-gray-300 hover:text-white uppercase font-bold cursor-pointer"
          >
            <Ruler size={14} className="text-accent-gold" />
            Como Medir
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-32 pb-20 px-4">
        <div className="max-w-9xl mx-auto">
          <SearchForm onSearch={handleSearch} />

          {/* Results Area */}
          <div className="mt-16 max-w-7xl mx-auto relative z-10">
            {loading ? (
              <div className="glass rounded-xl p-10 flex flex-col items-center justify-center gap-4 text-accent-gold animate-fade-in-up">
                <Loader2 size={32} className="animate-spin" />
                <p className="font-mono text-sm tracking-widest">
                  BUSCANDO NO ESTOQUE...
                </p>
              </div>
            ) : searched && resultados.length === 0 ? (
              <div className="glass rounded-xl p-10 text-center">
                <p className="text-gray-400 text-lg">
                  Nenhuma peça encontrada com estas dimensões e tolerância.
                </p>
              </div>
            ) : (
              <div>
                {resultados.length > 0 && (
                  <div className="mb-6 flex justify-between items-end border-b border-white/10 pb-4">
                    <h2 className="text-2xl font-anton text-white tracking-widest">
                      RESULTADOS
                    </h2>
                    <span className="text-accent-gold font-mono text-sm">
                      {resultados.length} peça(s) encontrada(s)
                    </span>
                  </div>
                )}

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto bg-black/20 rounded-xl border border-white/10 shadow-xl backdrop-blur-md">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-black/40 border-b border-white/10 text-gray-400 text-xs font-bold tracking-widest uppercase">
                        <th className="p-4 pl-6">Código</th>
                        <th className="p-4 text-center">Tipo</th>
                        {visibleColumns.map((col) => (
                          <th key={col.csvCol} className="p-4 text-right">
                            {col.label}{" "}
                            <span className="text-gray-500 lowercase font-normal ml-1">
                              {col.unit}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-gray-200">
                      {resultados.map((peca, idx) => (
                        <tr
                          key={`${peca.Tipo}-${peca.Codigo}-${idx}`}
                          className="hover:bg-white/5 transition-colors group animate-fade-in-up"
                          style={{
                            animationDelay: `${Math.min(idx * 0.03, 1.5)}s`,
                          }}
                        >
                          <td className="p-4 pl-6 max-w-[160px] sm:max-w-[200px] lg:max-w-[300px] xl:max-w-[400px]">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleCopy(peca.Codigo)}
                                className="flex items-center gap-1.5 bg-accent-gold/10 hover:bg-accent-gold/20 text-accent-gold px-2 py-1 rounded border border-accent-gold/20 transition-all active:scale-95 shrink-0"
                                title="Copiar código"
                              >
                                {copiedCode === peca.Codigo ? (
                                  <Check size={14} className="text-green-400" />
                                ) : (
                                  <Copy size={14} />
                                )}
                              </button>
                              <span
                                className="font-anton text-accent-gold text-xl tracking-wide truncate flex-1 min-w-0"
                                title={peca.Codigo}
                              >
                                {peca.Codigo}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <span
                              className="px-3 py-1 rounded-md text-xs font-mono border font-bold shadow-sm"
                              style={getTipoBadgeStyle(peca.Tipo)}
                            >
                              {peca.Tipo}
                            </span>
                          </td>
                          {visibleColumns.map((col) => {
                            const val = peca[col.csvCol];
                            const hasVal =
                              val !== undefined &&
                              val !== null &&
                              val !== "" &&
                              !isNaN(Number(val));
                            return (
                              <td
                                key={col.csvCol}
                                className={`p-4 text-right font-mono text-lg ${
                                  hasVal ? "text-gray-200" : "text-gray-600"
                                }`}
                              >
                                {hasVal ? Number(val).toFixed(2) : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="grid grid-cols-1 gap-4 md:hidden">
                  {resultados.map((peca, idx) => (
                    <div
                      key={`${peca.Tipo}-${peca.Codigo}-${idx}`}
                      className="glass rounded-xl p-5 flex flex-col gap-4 animate-fade-in-up border border-white/5"
                      style={{
                        animationDelay: `${Math.min(idx * 0.03, 1.5)}s`,
                      }}
                    >
                      <div className="flex justify-between items-center border-b border-white/10 pb-3">
                        <div className="flex items-center gap-3 max-w-[70%]">
                          <button
                            onClick={() => handleCopy(peca.Codigo)}
                            className="flex items-center justify-center bg-accent-gold/10 hover:bg-accent-gold/20 text-accent-gold w-8 h-8 rounded border border-accent-gold/20 transition-all active:scale-95 shrink-0"
                            title="Copiar código"
                          >
                            {copiedCode === peca.Codigo ? (
                              <Check size={16} className="text-green-400" />
                            ) : (
                              <Copy size={16} />
                            )}
                          </button>
                          <span
                            className="font-anton text-accent-gold text-2xl tracking-wide truncate flex-1 min-w-0"
                            title={peca.Codigo}
                          >
                            {peca.Codigo}
                          </span>
                        </div>
                        <span
                          className="px-3 py-1 rounded-md text-xs font-mono border font-bold shadow-sm"
                          style={getTipoBadgeStyle(peca.Tipo)}
                        >
                          {peca.Tipo}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                        {visibleColumns.map((col) => {
                          const val = peca[col.csvCol];
                          const hasVal =
                            val !== undefined &&
                            val !== null &&
                            val !== "" &&
                            !isNaN(Number(val));
                          if (!hasVal && !searchTipo) return null; // Em busca global, ocultar colunas vazias
                          return (
                            <div key={col.csvCol} className="flex flex-col">
                              <span className="text-gray-500 text-xs tracking-widest uppercase mb-1">
                                {col.label}
                              </span>
                              <span
                                className={`font-mono text-lg ${hasVal ? "text-white/90" : "text-gray-600"}`}
                              >
                                {hasVal ? Number(val).toFixed(2) : "—"}{" "}
                                <span className="text-sm text-gray-500">
                                  {col.unit}
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal Fullscreen Imagem */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsModalOpen(false)}
        >
          <button
            className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors"
            onClick={() => setIsModalOpen(false)}
          >
            <X size={36} />
          </button>
          <img
            src="/como-pedir.png"
            alt="Como pedir altura (Tela Cheia)"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export default App;
