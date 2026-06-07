import { useState } from "react";
import ResultCard from "./components/ResultCard";
import SearchForm from "./components/SearchForm";
import DatabaseService from "./services/DatabaseService";

function App() {
  const [resultados, setResultados] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (params) => {
    setLoading(true);
    try {
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
              src="/src/assets/shared/logo.png"
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
              <div className="text-center text-accent-gold font-mono animate-pulse">
                CARREGANDO BASE DE DADOS...
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
                <div className="overflow-x-auto bg-black/20 rounded-xl border border-white/10 shadow-xl backdrop-blur-md">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-black/40 border-b border-white/10 text-gray-400 text-xs font-bold tracking-widest uppercase">
                        <th className="p-4 pl-6">Código</th>
                        <th className="p-4 text-center">Tipo</th>
                        <th className="p-4 text-right">Ø Interno <span className="text-gray-500 lowercase font-normal ml-1">mm</span></th>
                        <th className="p-4 text-right">Ø Externo <span className="text-gray-500 lowercase font-normal ml-1">mm</span></th>
                        <th className="p-4 text-right">Alt. Base <span className="text-gray-500 lowercase font-normal ml-1">mm</span></th>
                        <th className="p-4 text-right pr-6">Alt. Total <span className="text-gray-500 lowercase font-normal ml-1">mm</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-gray-200">
                      {resultados.map((peca, idx) => (
                        <tr key={idx} className="hover:bg-white/5 transition-colors group">
                          <td className="p-4 pl-6 font-anton text-accent-gold text-xl tracking-wide">{peca.Codigo}</td>
                          <td className="p-4 text-center"><span className="bg-black/30 px-3 py-1 rounded-md text-xs font-mono border border-white/5">{peca.Tipo}</span></td>
                          <td className="p-4 text-right font-mono text-lg">{Number(peca.Interno).toFixed(2)}</td>
                          <td className="p-4 text-right font-mono text-lg">{Number(peca.Externo).toFixed(2)}</td>
                          <td className="p-4 text-right font-mono text-lg text-gray-400 group-hover:text-gray-200 transition-colors">{Number(peca.AlturaBase).toFixed(2)}</td>
                          <td className="p-4 text-right font-mono text-lg pr-6 font-bold">{Number(peca.AlturaTotal).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
