import { Check, ChevronLeft, ChevronRight, Copy, Loader2, LogOut, PackageCheck, Ruler, X } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Login from "./components/Login";
import FacetFilter from "./components/FacetFilter";
import SearchForm from "./components/SearchForm";
import { APLICACOES } from "./config/taxonomia";
import DatabaseService from "./services/DatabaseService";
import { aplicarFacetas, contarFacetas, SELECAO_VAZIA } from "./utils/facets";
import { supabase } from "./utils/supabase";
import { getTipoBadgeStyle } from "./utils/tipoStyles";
import { formatInch, formatMm } from "./utils/units";

/**
 * Hook para sincronizar se a viewport é desktop (evita renderizar markup duplicado no DOM).
 */
function useIsDesktop(breakpoint = 768) {
  return useSyncExternalStore(
    (callback) => {
      const mediaQuery = window.matchMedia(`(min-width: ${breakpoint}px)`);
      mediaQuery.addEventListener("change", callback);
      return () => mediaQuery.removeEventListener("change", callback);
    },
    () => window.innerWidth >= breakpoint,
    () => true
  );
}

// Colunas de medida (sempre em mm + polegada)
const COLUNAS_MEDIDA = [
  { campo: "interno", label: "Ø Interno" },
  { campo: "externo", label: "Ø Externo" },
  { campo: "altura", label: "Altura" },
  { campo: "secao", label: "Seção" },
  { campo: "alturaBase", label: "Alt. Base" },
];

const temValor = (v) => v !== null && v !== undefined && Number.isFinite(v);

const fmtNum = (v) => (v === null || v === undefined ? "" : v.toLocaleString("pt-BR"));

/** ["8.000 psi", "-45 a +135 °C", "0,5 m/s"] */
function partesFicha(f) {
  if (!f) return [];
  const partes = [];
  if (f.pressao !== null) partes.push(`${fmtNum(f.pressao)} psi`);
  if (f.tempMin !== null && f.tempMax !== null) partes.push(`${f.tempMin} a +${f.tempMax} °C`);
  if (f.velocidade !== null) partes.push(`${fmtNum(f.velocidade)} m/s`);
  return partes;
}

/** Extras do catálogo: "V 3 · L1 12,5" */
const textoExtras = (peca) => peca.extras.map((e) => `${e.label} ${e.value}`).join(" · ");

const temFicha = (peca) => partesFicha(peca.ficha).length > 0 || peca.extras.length > 0;

/** "Polymax · Hidráulica" */
const materialELinha = (peca) => [peca.material, peca.linha].filter((v) => v && v !== "—").join(" · ");

function Aplicacoes({ lista }) {
  if (lista.length === 0) {
    return (
      <span className="text-gray-600" title="Sem aplicação definida: atende Haste e Êmbolo">
        —
      </span>
    );
  }
  return (
    <span className="flex flex-wrap gap-1.5">
      {lista.map((a) => (
        <span key={a} className="px-2 py-0.5 rounded-md border border-white/15 bg-white/5 text-xs text-white/80">
          {APLICACOES[a] || a}
        </span>
      ))}
    </span>
  );
}

/** Pressão · temperatura · velocidade, e os extras numa segunda linha */
function FichaTecnica({ peca }) {
  const partes = partesFicha(peca.ficha);
  const extras = textoExtras(peca);
  if (!partes.length && !extras) return <span className="text-gray-600">—</span>;
  return (
    <span className="flex flex-col gap-0.5 leading-relaxed">
      {partes.length > 0 && <span className="text-white/80">{partes.join(" · ")}</span>}
      {extras && <span className="text-white/50">{extras}</span>}
    </span>
  );
}

function CelulaMedida({ valor, grande = true }) {
  if (!temValor(valor)) {
    return <span className="text-gray-600">—</span>;
  }
  return (
    <span className="flex flex-col items-end leading-tight">
      <span className={`font-mono ${grande ? "text-lg" : "text-base"} text-gray-200`}>{formatMm(valor)}</span>
      <span className="font-mono text-xs text-white/40">{formatInch(valor)}</span>
    </span>
  );
}

function App() {
  const [session, setSession] = useState(undefined);
  const [resultados, setResultados] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [selecao, setSelecao] = useState(SELECAO_VAZIA);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [estoque, setEstoque] = useState({});
  const [apenasEstoque, setApenasEstoque] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const isDesktop = useIsDesktop(768);

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
    setCurrentPage(1);
    setSelecao(SELECAO_VAZIA);
    try {
      await new Promise((resolve) => setTimeout(resolve, 400));
      const results = DatabaseService.buscar(params);
      setResultados(results);
      setSearched(true);
    } catch (err) {
      console.error("Erro na busca:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleApenasEstoque = () => {
    setCurrentPage(1);
    setApenasEstoque((prev) => !prev);
  };

  // Atalhos do estado inicial: lista o catálogo sem medidas, com ou sem o filtro de estoque
  const handleListarTudo = (somenteEstoque) => {
    setApenasEstoque(somenteEstoque);
    handleSearch({ tolerancia: "0.5", codigo: "", medidas: {} });
  };

  const handleToggleFaceta = (key, valor) => {
    setCurrentPage(1);
    setSelecao((prev) => ({
      ...prev,
      [key]: prev[key].includes(valor) ? prev[key].filter((v) => v !== valor) : [...prev[key], valor],
    }));
  };

  const handleLimparFaceta = (key) => {
    setCurrentPage(1);
    setSelecao((prev) => (key ? { ...prev, [key]: [] } : SELECAO_VAZIA));
  };

  // Estoque é aplicado antes do funil, para as contagens refletirem o filtro
  const baseFunil = useMemo(() => {
    return apenasEstoque
      ? resultados.filter((peca) => !!estoque[peca.codigo])
      : resultados;
  }, [apenasEstoque, resultados, estoque]);

  const opcoesFacetas = useMemo(() => contarFacetas(baseFunil, selecao), [baseFunil, selecao]);

  const displayedResultados = useMemo(() => aplicarFacetas(baseFunil, selecao), [baseFunil, selecao]);

  const resultadosSemEstoque = useMemo(() => aplicarFacetas(resultados, selecao), [resultados, selecao]);

  const totalEstoqueNaBusca = useMemo(() => {
    return resultadosSemEstoque.filter((peca) => !!estoque[peca.codigo]).length;
  }, [resultadosSemEstoque, estoque]);

  const totalPages = Math.max(1, Math.ceil(displayedResultados.length / pageSize));
  const safeCurrentPage = Math.max(1, Math.min(currentPage, totalPages));

  const paginatedResultados = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return displayedResultados.slice(startIndex, startIndex + pageSize);
  }, [displayedResultados, safeCurrentPage, pageSize]);

  // Só exibe colunas de medida que têm dado em alguma peça filtrada
  const visibleColumns = useMemo(
    () => COLUNAS_MEDIDA.filter((col) => displayedResultados.some((p) => temValor(p[col.campo]))),
    [displayedResultados]
  );
  const mostrarReferencia = useMemo(() => displayedResultados.some((p) => p.referencia), [displayedResultados]);

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
      {/* Background Effects (Fixado com GPU para scroll suave sem recálculo de blur) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-accent-gold/10 blur-[90px] rounded-full transform-gpu" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-accent-red/10 blur-[90px] rounded-full transform-gpu" />
      </div>

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
          <SearchForm onSearch={handleSearch}>
            <FacetFilter
              desabilitado={!searched || resultados.length === 0}
              opcoes={opcoesFacetas}
              selecao={selecao}
              onToggle={handleToggleFaceta}
              onLimpar={handleLimparFaceta}
              apenasEstoque={apenasEstoque}
              totalEstoque={totalEstoqueNaBusca}
              onToggleEstoque={handleToggleApenasEstoque}
            />
          </SearchForm>

          {/* Results Area */}
          <div className="mt-12 max-w-7xl mx-auto relative z-10">
            {loading ? (
              <div className="glass rounded-xl p-10 flex flex-col items-center justify-center gap-4 text-accent-gold animate-fade-in-up">
                <Loader2 size={32} className="animate-spin" />
                <p className="text-sm">Buscando no catálogo…</p>
              </div>
            ) : !searched ? (
              <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center flex flex-col items-center gap-5">
                <p className="text-gray-400 max-w-md">
                  Preencha as medidas ou o código e toque em Buscar. Para ver tudo sem filtrar por medida:
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleListarTudo(false)}
                    className="h-10 px-4 rounded-xl border border-white/15 bg-white/5 hover:border-white/30 text-sm text-gray-200 transition-colors cursor-pointer"
                  >
                    Listar o catálogo completo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleListarTudo(true)}
                    className="flex items-center gap-2 h-10 px-4 rounded-xl border border-accent-gold/40 bg-accent-gold/10 hover:bg-accent-gold/20 text-sm text-accent-gold transition-colors cursor-pointer"
                  >
                    <PackageCheck size={16} />
                    Só o que tenho em estoque
                  </button>
                </div>
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
                  <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <h2 className="text-2xl font-anton text-white tracking-widest">RESULTADOS</h2>
                    <span className="text-gray-400 text-sm" aria-live="polite">
                      <strong className="text-accent-gold font-mono text-base">
                        {displayedResultados.length.toLocaleString("pt-BR")}
                      </strong>
                      {displayedResultados.length === resultados.length
                        ? displayedResultados.length === 1 ? " peça" : " peças"
                        : ` de ${resultados.length.toLocaleString("pt-BR")} peças`}
                    </span>
                  </div>
                )}

                {displayedResultados.length === 0 && resultados.length > 0 ? (
                  <div className="glass rounded-xl p-10 text-center flex flex-col items-center gap-3">
                    <p className="text-gray-300 text-lg">
                      {apenasEstoque
                        ? `Nenhuma das ${resultadosSemEstoque.length} peças filtradas está marcada no estoque.`
                        : "Nenhuma peça com esses filtros."}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentPage(1);
                        setApenasEstoque(false);
                        setSelecao(SELECAO_VAZIA);
                      }}
                      className="text-accent-gold hover:underline text-sm font-mono tracking-wider cursor-pointer"
                    >
                      Exibir todas as {resultados.length} peças encontradas
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Renderização condicional por Viewport (evita duplicar markup desktop + mobile no DOM) */}
                    {isDesktop ? (
                      /* Desktop Table */
                      <div className="overflow-x-auto bg-black/20 rounded-xl border border-white/10 shadow-xl backdrop-blur-md">
                        <table className="w-full text-left border-collapse whitespace-nowrap">
                          <thead>
                            <tr className="bg-black/40 border-b border-white/10 text-gray-400 text-xs font-bold tracking-widest uppercase">
                              <th className="p-4 pl-6">Código</th>
                              <th className="p-4">
                                Peça
                                <span className="block text-gray-500 lowercase font-normal">
                                  perfil · material · linha
                                </span>
                              </th>
                              <th className="p-4">Aplicação</th>
                              {visibleColumns.map((col) => (
                                <th key={col.campo} className="p-4 text-right">
                                  {col.label}
                                  <span className="block text-gray-500 lowercase font-normal">
                                    mm · pol
                                  </span>
                                </th>
                              ))}
                              <th className="p-4">Ficha técnica</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-gray-200">
                            {paginatedResultados.map((peca) => (
                              <tr
                                key={peca.id}
                                className={`hover:bg-white/5 transition-colors duration-150 group ${estoque[peca.codigo] ? "bg-accent-gold/10" : ""}`}
                              >
                                <td className="p-4 pl-6 max-w-40 sm:max-w-50 lg:max-w-75 xl:max-w-100">
                                  <div className="flex items-center gap-3">
                                    <input
                                      type="checkbox"
                                      checked={!!estoque[peca.codigo]}
                                      onChange={() => handleToggleEstoque(peca.codigo)}
                                      className="w-4 h-4 rounded border border-white/20 bg-black/40 text-accent-gold accent-accent-gold cursor-pointer focus:ring-0 focus:ring-offset-0 transition-all shrink-0"
                                      title={estoque[peca.codigo] ? "Remover do estoque" : "Adicionar ao estoque"}
                                    />
                                    <button
                                      onClick={() => handleCopy(peca.codigo)}
                                      className="flex items-center gap-1.5 bg-accent-gold/10 hover:bg-accent-gold/20 text-accent-gold px-2 py-1 rounded border border-accent-gold/20 transition-all active:scale-95 shrink-0"
                                      title="Copiar código"
                                    >
                                      {copiedCode === peca.codigo ? (
                                        <Check size={14} className="text-green-400" />
                                      ) : (
                                        <Copy size={14} />
                                      )}
                                    </button>
                                    <div className="flex flex-col min-w-0 flex-1">
                                      <span
                                        className="font-anton text-accent-gold text-xl tracking-wide truncate"
                                        title={peca.codigo}
                                      >
                                        {peca.codigo}
                                      </span>
                                      {mostrarReferencia && peca.referencia && peca.referencia !== peca.codigo && (
                                        <span className="font-mono text-xs text-white/50 truncate" title="Referência do fornecedor">
                                          Ref. {peca.referencia}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className="px-2.5 py-1 rounded-md text-xs font-mono border font-bold shadow-sm"
                                        style={getTipoBadgeStyle(peca.tipo)}
                                      >
                                        {peca.tipo}
                                      </span>
                                      <span className="text-white/90 font-bold">{peca.perfil || "—"}</span>
                                    </div>
                                    {materialELinha(peca) && (
                                      <span className="text-xs text-white/60">{materialELinha(peca)}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-4">
                                  <Aplicacoes lista={peca.aplicacoes} />
                                </td>
                                {visibleColumns.map((col) => (
                                  <td key={col.campo} className="p-4 text-right">
                                    <CelulaMedida valor={peca[col.campo]} />
                                  </td>
                                ))}
                                <td className="p-4 text-xs max-w-72 whitespace-normal">
                                  <FichaTecnica peca={peca} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      /* Mobile Cards View */
                      <div className="grid grid-cols-1 gap-4">
                        {paginatedResultados.map((peca) => (
                          <div
                            key={peca.id}
                            className={`glass rounded-xl p-5 flex flex-col gap-4 border transition-colors duration-150 ${estoque[peca.codigo] ? "border-accent-gold/40 bg-accent-gold/5" : "border-white/5"}`}
                          >
                            <div className="flex justify-between items-start gap-3 border-b border-white/10 pb-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={!!estoque[peca.codigo]}
                                  onChange={() => handleToggleEstoque(peca.codigo)}
                                  className="w-5 h-5 rounded border border-white/20 bg-black/40 text-accent-gold accent-accent-gold cursor-pointer focus:ring-0 focus:ring-offset-0 transition-all shrink-0"
                                  title={estoque[peca.codigo] ? "Remover do estoque" : "Adicionar ao estoque"}
                                />
                                <button
                                  onClick={() => handleCopy(peca.codigo)}
                                  className="flex items-center justify-center bg-accent-gold/10 hover:bg-accent-gold/20 text-accent-gold w-8 h-8 rounded border border-accent-gold/20 transition-all active:scale-95 shrink-0"
                                  title="Copiar código"
                                >
                                  {copiedCode === peca.codigo ? (
                                    <Check size={16} className="text-green-400" />
                                  ) : (
                                    <Copy size={16} />
                                  )}
                                </button>
                                <div className="flex flex-col min-w-0">
                                  <span
                                    className="font-anton text-accent-gold text-2xl tracking-wide truncate"
                                    title={peca.codigo}
                                  >
                                    {peca.codigo}
                                  </span>
                                  {peca.referencia && peca.referencia !== peca.codigo && (
                                    <span className="font-mono text-xs text-white/50 truncate">Ref. {peca.referencia}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span
                                  className="px-2.5 py-1 rounded-md text-xs font-mono border font-bold shadow-sm"
                                  style={getTipoBadgeStyle(peca.tipo)}
                                >
                                  {peca.tipo}
                                </span>
                                <span className="text-sm text-white/90 font-bold">{peca.perfil || "—"}</span>
                                {materialELinha(peca) && (
                                  <span className="text-xs text-white/60 text-right">{materialELinha(peca)}</span>
                                )}
                              </div>
                            </div>
                            {peca.aplicacoes.length > 0 && (
                              <div className="flex items-center gap-3">
                                <span className="text-gray-500 text-xs tracking-widest uppercase">Aplicação</span>
                                <Aplicacoes lista={peca.aplicacoes} />
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                              {visibleColumns.map((col) =>
                                temValor(peca[col.campo]) ? (
                                  <div key={col.campo} className="flex flex-col">
                                    <span className="text-gray-500 text-xs tracking-widest uppercase mb-1">
                                      {col.label}
                                    </span>
                                    <span className="font-mono text-lg text-white/90">
                                      {formatMm(peca[col.campo])} <span className="text-sm text-gray-500">mm</span>
                                    </span>
                                    <span className="font-mono text-xs text-white/40">{formatInch(peca[col.campo])}</span>
                                  </div>
                                ) : null
                              )}
                            </div>
                            {temFicha(peca) && (
                              <div className="text-xs border-t border-white/10 pt-3">
                                <FichaTecnica peca={peca} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Paginação */}
                    {displayedResultados.length > pageSize && (
                      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-black/30 border border-white/10 rounded-xl px-5 py-3">
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 font-mono">
                          <span>
                            Mostrando <strong className="text-white font-bold">{(currentPage - 1) * pageSize + 1}</strong> a{" "}
                            <strong className="text-white font-bold">{Math.min(currentPage * pageSize, displayedResultados.length)}</strong> de{" "}
                            <strong className="text-accent-gold font-bold">{displayedResultados.length}</strong> peças
                          </span>
                          <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
                            <span className="text-gray-500">Por pág:</span>
                            <select
                              value={pageSize}
                              onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                              }}
                              className="bg-black/50 border border-white/20 rounded-md px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-accent-gold cursor-pointer"
                            >
                              <option value={25} className="bg-zinc-900 text-white">25</option>
                              <option value={50} className="bg-zinc-900 text-white">50</option>
                              <option value={100} className="bg-zinc-900 text-white">100</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={safeCurrentPage === 1}
                            onClick={() => {
                              setCurrentPage((p) => Math.max(1, p - 1));
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-bold uppercase tracking-wider text-gray-300 hover:text-white hover:border-accent-gold/40 hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <ChevronLeft size={16} />
                            <span className="hidden sm:inline">Anterior</span>
                          </button>

                          <span className="px-3 py-1 text-xs font-mono font-bold text-accent-gold bg-accent-gold/10 border border-accent-gold/30 rounded-lg">
                            {safeCurrentPage} / {totalPages}
                          </span>

                          <button
                            type="button"
                            disabled={safeCurrentPage === totalPages}
                            onClick={() => {
                              setCurrentPage((p) => Math.min(totalPages, p + 1));
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-bold uppercase tracking-wider text-gray-300 hover:text-white hover:border-accent-gold/40 hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <span className="hidden sm:inline">Próxima</span>
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
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
