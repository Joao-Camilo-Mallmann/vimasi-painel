import { PackageCheck, Search } from "lucide-react";
import { useState } from "react";
import { CAMPOS_MEDIDA } from "../config/taxonomia";
import { formatMm, parseEntrada, textoParaUnidade } from "../utils/units";

const TOLERANCIAS = ["0", "0.5", "1", "1.5", "2", "2.5", "3", "4", "5", "10"];

const CAMPOS_VAZIOS = Object.fromEntries(CAMPOS_MEDIDA.map(({ key }) => [key, ""]));

export default function SearchForm({ onSearch, apenasEstoque, onToggleApenasEstoque }) {
  const [codigo, setCodigo] = useState("");
  const [tolerancia, setTolerancia] = useState("0.5");
  const [unidade, setUnidade] = useState("mm");
  const [campos, setCampos] = useState(CAMPOS_VAZIOS);

  const invalido = (key) => campos[key].trim() !== "" && parseEntrada(campos[key], unidade) === null;

  const trocarUnidade = (nova) => {
    if (nova === unidade) return;
    setCampos((prev) => {
      const prox = {};
      for (const [key, texto] of Object.entries(prev)) {
        const mm = parseEntrada(texto, unidade);
        prox[key] = mm === null ? texto : textoParaUnidade(mm, nova);
      }
      return prox;
    });
    setUnidade(nova);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const medidas = {};
    for (const { key } of CAMPOS_MEDIDA) {
      const mm = parseEntrada(campos[key], unidade);
      if (mm !== null) medidas[key] = mm;
    }
    onSearch({ codigo, tolerancia, medidas });
  };

  return (
    <div className="glass rounded-2xl p-4 md:p-6 w-full max-w-7xl mx-auto relative z-20 animate-fade-in-up">
      <form onSubmit={handleSubmit} className="w-full">
        <div className="flex flex-col lg:flex-row items-start gap-3 w-full">
          {/* CÓDIGO / REFERÊNCIA */}
          <div className="flex flex-col gap-2 w-full lg:w-40 xl:w-48 flex-1 min-w-30">
            <label className="text-xs uppercase tracking-widest text-gray-400 font-bold ml-1 truncate">
              Código / Ref.
            </label>
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ex: 5702 ou 12500250"
              className="bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-0 focus:border-accent-gold transition-colors shadow-inner w-full uppercase h-13"
            />
          </div>

          {/* UNIDADE */}
          <div className="flex flex-col gap-2 w-full lg:w-auto flex-none">
            <label className="text-xs uppercase tracking-widest text-gray-400 font-bold ml-1 truncate">
              Unidade
            </label>
            <div className="flex h-13 rounded-xl border border-white/20 bg-black/40 p-1">
              {["mm", "pol"].map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => trocarUnidade(u)}
                  className={`flex-1 px-4 rounded-lg text-sm font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer active:scale-95 ${
                    unidade === u
                      ? "bg-accent-red text-white shadow-md shadow-accent-red/20"
                      : "text-gray-400 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* MEDIDAS */}
          {CAMPOS_MEDIDA.map(({ key, label }) => {
            const mm = parseEntrada(campos[key], unidade);
            const erro = invalido(key);
            return (
              <div key={key} className="flex flex-col gap-2 w-full lg:w-28 xl:w-32 flex-1 min-w-20">
                <label className="text-xs uppercase tracking-widest text-gray-300 font-bold ml-1 flex items-center truncate">
                  {label}
                  <span className="text-gray-500 lowercase font-normal ml-1">{unidade}</span>
                </label>
                <input
                  type="text"
                  inputMode={unidade === "pol" ? "text" : "decimal"}
                  value={campos[key]}
                  onChange={(e) => setCampos((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={unidade === "pol" ? '1 3/4' : "0,00"}
                  aria-invalid={erro}
                  className={`bg-black/40 border rounded-xl px-3 py-3 text-white text-lg font-mono focus:outline-none focus:ring-0 transition-colors shadow-inner w-full h-13 text-center ${
                    erro ? "border-accent-red focus:border-accent-red" : "border-white/20 focus:border-accent-gold"
                  }`}
                />
                <span className={`text-[11px] font-mono ml-1 h-3 ${erro ? "text-accent-red" : "text-white/40"}`}>
                  {erro ? "valor inválido" : unidade === "pol" && mm !== null ? `= ${formatMm(mm)} mm` : ""}
                </span>
              </div>
            );
          })}

          {/* TOLERÂNCIA */}
          <div className="flex flex-col gap-2 w-full lg:w-24 xl:w-28 flex-none">
            <label className="text-xs uppercase tracking-widest text-gray-400 font-bold ml-1 truncate">
              Tol. <span className="lowercase font-normal text-gray-500">mm</span>
            </label>
            <select
              value={tolerancia}
              onChange={(e) => setTolerancia(e.target.value)}
              className="bg-black/40 border border-white/20 rounded-xl px-2 py-3 text-gray-300 text-sm focus:outline-none focus:ring-0 focus:border-accent-gold transition-colors cursor-pointer text-center h-13 w-full"
            >
              {TOLERANCIAS.map((t) => (
                <option key={t} value={t} className="bg-zinc-900 text-white">
                  ± {formatMm(t)}
                </option>
              ))}
            </select>
          </div>

          {/* FILTRO ESTOQUE */}
          <div className="flex flex-col gap-2 w-full lg:w-auto flex-none">
            <label className="text-xs uppercase tracking-widest text-gray-400 font-bold ml-1 truncate hidden lg:block">
              Estoque
            </label>
            <button
              type="button"
              onClick={onToggleApenasEstoque}
              className={`w-full lg:w-auto h-13 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer active:scale-95 ${
                apenasEstoque
                  ? "border-accent-gold bg-accent-gold/20 text-accent-gold shadow-lg shadow-accent-gold/10"
                  : "border-white/10 bg-black/40 hover:bg-white/5 text-gray-400 hover:text-white"
              }`}
              title={apenasEstoque ? "Filtro ativo: apenas peças em estoque" : "Filtrar apenas peças que temos em estoque"}
            >
              <PackageCheck size={18} className={apenasEstoque ? "text-accent-gold" : "text-gray-400"} />
              <span className="whitespace-nowrap">Em Estoque</span>
            </button>
          </div>

          {/* BUSCAR */}
          <div className="flex flex-col gap-2 w-full lg:w-auto flex-none">
            <span className="text-xs hidden lg:block">&nbsp;</span>
            <button
              type="submit"
              className="w-full bg-accent-red hover:bg-red-700 text-white font-anton tracking-widest text-lg px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg shadow-accent-red/20 cursor-pointer h-13"
            >
              <Search size={18} />
              BUSCAR
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
