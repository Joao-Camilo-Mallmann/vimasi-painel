import { Check, Copy, Loader2, LogOut, Ruler, X } from "lucide-react";
import { useEffect, useState } from "react";
import Login from "./components/Login";
import SearchForm from "./components/SearchForm";
import { FIELD_DEFS, getCategoryByTipo } from "./config/categories";
import DatabaseService from "./services/DatabaseService";
import { supabase } from "./utils/supabase";
import { getTipoBadgeStyle } from "./utils/tipoStyles";

/**
 * Retorna as colunas de dimensão a renderizar na tabela,
 * baseado no tipo selecionado (ou união para "Todos").
 */
function getDisplayColumns(tipos) {
  if (tipos && tipos.length > 0) {
    const allCols = [];
    for (const t of tipos) {
      const cat = getCategoryByTipo(t);
      if (cat) {
        for (const col of cat.columns) {
          if (!allCols.includes(col)) {
            allCols.push(col);
          }
        }
      }
    }
    // Retornar todas as colunas exceto Codigo e Tipo
    return allCols
      .filter((c) => c !== "Codigo" && c !== "Tipo")
      .map((csvCol) => {
        const fieldKey = Object.entries({
          interno: "Interno",
          externo: "Externo",
          alturaBase: "AlturaBase",
          altura: "Altura",
        }).find(([, csv]) => csv === csvCol);
        const def = fieldKey ? FIELD_DEFS[fieldKey[0]] : null;
        return {
          csvCol,
          label: def?.label || csvCol,
          unit: def?.unit || "mm",
        };
      });
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
  const [session, setSession] = useState(undefined);
  const [resultados, setResultados] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [searchTipos, setSearchTipos] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [estoque, setEstoque] = useState({});

  // Listen for Supabase auth session changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch estoque from Supabase when session becomes active
  useEffect(() => {
    if (!session) return;

    const fetchEstoque = async () => {
      const { data, error } = await supabase.from("estoque").select("codigo");
      if (error) {
        console.error("Erro ao carregar estoque:", error);
        return;
      }
      const map = {};
      for (const row of data) {
        map[row.codigo] = true;
      }
      setEstoque(map);
    };

    fetchEstoque();
  }, [session]);

  const handleToggleEstoque = async (codigo) => {
    const isChecked = !!estoque[codigo];

    // Optimistic update
    setEstoque((prev) => {
      const updated = { ...prev };
      if (isChecked) {
        delete updated[codigo];
      } else {
        updated[codigo] = true;
      }
      return updated;
    });

    if (isChecked) {
      // Remove from Supabase
      const { error } = await supabase
        .from("estoque")
        .delete()
        .eq("codigo", codigo);
      if (error) {
        console.error("Erro ao remover do estoque:", error);
        // Revert optimistic update
        setEstoque((prev) => ({ ...prev, [codigo]: true }));
      }
    } else {
      // Insert into Supabase
      const { error } = await supabase
        .from("estoque")
        .insert({ codigo });
      if (error) {
        console.error("Erro ao adicionar ao estoque:", error);
        // Revert optimistic update
        setEstoque((prev) => {
          const reverted = { ...prev };
          delete reverted[codigo];
          return reverted;
        });
      }
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleCopy = (codigo) => {
    navigator.clipboard.writeText(codigo);
    setCopiedCode(codigo);
  };

  const handleSearch = async (params) => {
    setLoading(true);
    setSearched(false);
    setSearchTipos(params.tipos || []);
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
  const allColumns = getDisplayColumns(searchTipos);
  // Filtrar colunas sem dados (se for busca global ou multiplas categorias)
  const visibleColumns = (searchTipos && searchTipos.length === 1)
    ? allColumns
    : allColumns.filter((col) => columnHasData(resultados, col.csvCol));

  // Show loading state while checking session
  if (session === undefined) {
    return (
      <div className="min-h-screen bg-primary-dark flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-accent-gold" />
      </div>
    );
  }

  // Show login when no active session
  if (!session) {
    return <Login />;
  }

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
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 hover:border-accent-gold/40 hover:bg-white/5 transition-all text-xs tracking-widest text-gray-300 hover:text-white uppercase font-bold cursor-pointer"
            >
              <Ruler size={14} className="text-accent-gold" />
              Como Medir
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 hover:border-accent-red/40 hover:bg-white/5 transition-all text-xs tracking-widest text-gray-300 hover:text-accent-red uppercase font-bold cursor-pointer"
              title="Sair"
            >
              <LogOut size={14} />
              Sair
            </button>
          </div>
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
                          className={`hover:bg-white/5 transition-all group animate-fade-in-up ${estoque[peca.Codigo] ? "bg-accent-gold/10" : ""}`}
                          style={{
                            animationDelay: `${Math.min(idx * 0.03, 1.5)}s`,
                          }}
                        >
                          <td className="p-4 pl-6 max-w-40 sm:max-w-50 lg:max-w-75 xl:max-w-100">
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={!!estoque[peca.Codigo]}
                                onChange={() =>
                                  handleToggleEstoque(peca.Codigo)
                                }
                                className="w-4 h-4 rounded border border-white/20 bg-black/40 text-accent-gold accent-accent-gold cursor-pointer focus:ring-0 focus:ring-offset-0 transition-all shrink-0"
                                title={
                                  estoque[peca.Codigo]
                                    ? "Remover do estoque"
                                    : "Adicionar ao estoque"
                                }
                              />
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
                      className={`glass rounded-xl p-5 flex flex-col gap-4 animate-fade-in-up border transition-all ${estoque[peca.Codigo] ? "border-accent-gold/40 bg-accent-gold/5" : "border-white/5"}`}
                      style={{
                        animationDelay: `${Math.min(idx * 0.03, 1.5)}s`,
                      }}
                    >
                      <div className="flex justify-between items-center border-b border-white/10 pb-3">
                        <div className="flex items-center gap-3 max-w-[70%]">
                          <input
                            type="checkbox"
                            checked={!!estoque[peca.Codigo]}
                            onChange={() => handleToggleEstoque(peca.Codigo)}
                            className="w-5 h-5 rounded border border-white/20 bg-black/40 text-accent-gold accent-accent-gold cursor-pointer focus:ring-0 focus:ring-offset-0 transition-all shrink-0"
                            title={
                              estoque[peca.Codigo]
                                ? "Remover do estoque"
                                : "Adicionar ao estoque"
                            }
                          />
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
                          if (!hasVal && (!searchTipos || searchTipos.length !== 1)) return null; // Ocultar colunas vazias se busca global ou multiplas categorias
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
