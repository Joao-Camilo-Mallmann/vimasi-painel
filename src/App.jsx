import { Check, Copy, Loader2 } from "lucide-react";
import { useState } from "react";
import SearchForm from "./components/SearchForm";
import DatabaseService from "./services/DatabaseService";

function App() {
  const [resultados, setResultados] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  const handleCopy = (codigo) => {
    navigator.clipboard.writeText(codigo);
    setCopiedCode(codigo);
  };

  const handleSearch = async (params) => {
    setLoading(true);
    setSearched(false);
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
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <SearchForm onSearch={handleSearch} />

          {/* Results Area */}
          <div className="mt-16 max-w-6xl mx-auto relative z-10">
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
                <div className="hidden md:block overflow-x-auto bg-black/20 rounded-xl border border-white/10 shadow-xl backdrop-blur-md">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-black/40 border-b border-white/10 text-gray-400 text-xs font-bold tracking-widest uppercase">
                        <th className="p-4 pl-6">Código</th>
                        <th className="p-4 text-center">Tipo</th>
                        <th className="p-4 text-right">
                          Ø Interno{" "}
                          <span className="text-gray-500 lowercase font-normal ml-1">
                            mm
                          </span>
                        </th>
                        <th className="p-4 text-right">
                          Ø Externo{" "}
                          <span className="text-gray-500 lowercase font-normal ml-1">
                            mm
                          </span>
                        </th>
                        <th className="p-4 text-right">
                          Alt. Base{" "}
                          <span className="text-gray-500 lowercase font-normal ml-1">
                            mm
                          </span>
                        </th>
                        <th className="p-4 text-right pr-6">
                          Alt. Total{" "}
                          <span className="text-gray-500 lowercase font-normal ml-1">
                            mm
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-gray-200">
                      {resultados.map((peca, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-white/5 transition-colors group animate-fade-in-up"
                          style={{ animationDelay: `${idx * 0.05}s` }}
                        >
                          <td className="p-4 pl-6">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleCopy(peca.Codigo)}
                                className="flex items-center gap-1.5 bg-accent-gold/10 hover:bg-accent-gold/20 text-accent-gold px-2 py-1 rounded border border-accent-gold/20 transition-all active:scale-95"
                                title="Copiar código"
                              >
                                {copiedCode === peca.Codigo ? (
                                  <Check size={14} className="text-green-400" />
                                ) : (
                                  <Copy size={14} />
                                )}
                              </button>
                              <span className="font-anton text-accent-gold text-xl tracking-wide">
                                {peca.Codigo}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <span className="bg-black/30 px-3 py-1 rounded-md text-xs font-mono border border-white/5">
                              {peca.Tipo}
                            </span>
                          </td>
                          <td className="p-4 text-right font-mono text-lg">
                            {Number(peca.Interno).toFixed(2)}
                          </td>
                          <td className="p-4 text-right font-mono text-lg">
                            {Number(peca.Externo).toFixed(2)}
                          </td>
                          <td className="p-4 text-right font-mono text-lg text-gray-400 group-hover:text-gray-200 transition-colors">
                            {Number(peca.AlturaBase).toFixed(2)}
                          </td>
                          <td className="p-4 text-right font-mono text-lg pr-6 font-bold">
                            {Number(peca.AlturaTotal).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="grid grid-cols-1 gap-4 md:hidden">
                  {resultados.map((peca, idx) => (
                    <div
                      key={idx}
                      className="glass rounded-xl p-5 flex flex-col gap-4 animate-fade-in-up border border-white/5"
                      style={{ animationDelay: `${idx * 0.05}s` }}
                    >
                      <div className="flex justify-between items-center border-b border-white/10 pb-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleCopy(peca.Codigo)}
                            className="flex items-center justify-center bg-accent-gold/10 hover:bg-accent-gold/20 text-accent-gold w-8 h-8 rounded border border-accent-gold/20 transition-all active:scale-95"
                            title="Copiar código"
                          >
                            {copiedCode === peca.Codigo ? (
                              <Check size={16} className="text-green-400" />
                            ) : (
                              <Copy size={16} />
                            )}
                          </button>
                          <span className="font-anton text-accent-gold text-2xl tracking-wide">
                            {peca.Codigo}
                          </span>
                        </div>
                        <span className="bg-black/30 px-3 py-1 rounded-md text-xs font-mono border border-white/5 text-gray-300">
                          {peca.Tipo}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                        <div className="flex flex-col">
                          <span className="text-gray-500 text-xs tracking-widest uppercase mb-1">Ø Interno</span>
                          <span className="font-mono text-white/90 text-lg">{Number(peca.Interno).toFixed(2)} <span className="text-sm text-gray-500">mm</span></span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-gray-500 text-xs tracking-widest uppercase mb-1">Ø Externo</span>
                          <span className="font-mono text-white/90 text-lg">{Number(peca.Externo).toFixed(2)} <span className="text-sm text-gray-500">mm</span></span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-gray-500 text-xs tracking-widest uppercase mb-1">Alt. Base</span>
                          <span className="font-mono text-gray-400 text-lg">{Number(peca.AlturaBase).toFixed(2)} <span className="text-sm text-gray-600">mm</span></span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-gray-500 text-xs tracking-widest uppercase mb-1">Alt. Total</span>
                          <span className="font-mono text-white text-lg font-bold">{Number(peca.AlturaTotal).toFixed(2)} <span className="text-sm text-gray-500">mm</span></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
