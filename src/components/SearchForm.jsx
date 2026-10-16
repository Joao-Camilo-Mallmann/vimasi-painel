import { Search } from "lucide-react";
import { useId, useState } from "react";
import Passo from "./Passo";
import { CAMPOS_MEDIDA } from "../config/taxonomia";
import { formatMm, parseEntrada, textoParaUnidade } from "../utils/units";

const TOLERANCIAS = ["0", "0.5", "1", "1.5", "2", "2.5", "3", "4", "5", "10"];

const CAMPOS_VAZIOS = Object.fromEntries(CAMPOS_MEDIDA.map(({ key }) => [key, ""]));

const DICAS = {
  interno: "Vão por dentro do anel",
  externo: "Diâmetro de fora a fora",
  altura: "Comprimento no sentido do eixo",
  secao: "Espessura da parede",
};

/**
 * Corte do retentor: a cota do campo em foco acende,
 * para ficar claro o que cada medida significa.
 */
function CorteRetentor({ foco }) {
  const hatch = useId();
  const cota = (campo) => (foco === campo ? "text-accent-gold" : "text-white/45");
  const peso = (campo) => (foco === campo ? 1.75 : 1);

  return (
    <svg viewBox="0 0 176 150" className="w-full h-auto" role="img" aria-label="Corte do retentor com as cotas das medidas">
      <defs>
        <pattern id={hatch} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" strokeWidth="1" />
        </pattern>
      </defs>

      {/* eixo: horizontal, como no catálogo */}
      <line x1="22" y1="82" x2="112" y2="82" stroke="currentColor" strokeWidth="1" strokeDasharray="6 3 1 3" className="text-white/30" />

      {/* perfil cortado: as duas metades do anel */}
      {[30, 106].map((y) => (
        <g key={y}>
          <rect x="50" y={y} width="50" height="28" className="fill-white/4 text-white/40" stroke="currentColor" strokeWidth="1.25" />
          <rect x="50" y={y} width="50" height="28" fill={`url(#${hatch})`} className="text-white/15" />
        </g>
      ))}

      {/* altura (H): no sentido do eixo */}
      <g className={`${cota("altura")} transition-colors duration-200`} stroke="currentColor" strokeWidth={peso("altura")} fill="currentColor">
        <line x1="50" y1="30" x2="50" y2="12" strokeWidth="1" />
        <line x1="100" y1="30" x2="100" y2="12" strokeWidth="1" />
        <line x1="50" y1="16" x2="100" y2="16" />
        <text x="75" y="10" textAnchor="middle" stroke="none" className="font-mono" fontSize="11">alt.</text>
      </g>

      {/* seção: espessura da parede, (Ø ext − Ø int) / 2 */}
      <g className={`${cota("secao")} transition-colors duration-200`} stroke="currentColor" strokeWidth={peso("secao")} fill="currentColor">
        <line x1="50" y1="30" x2="32" y2="30" strokeWidth="1" />
        <line x1="50" y1="58" x2="32" y2="58" strokeWidth="1" />
        <line x1="36" y1="30" x2="36" y2="58" />
        <text x="30" y="44" transform="rotate(-90 30 44)" textAnchor="middle" stroke="none" className="font-mono" fontSize="11">seção</text>
      </g>

      {/* Ø interno: face interna a face interna, atravessando o eixo */}
      <g className={`${cota("interno")} transition-colors duration-200`} stroke="currentColor" strokeWidth={peso("interno")} fill="currentColor">
        <line x1="100" y1="58" x2="124" y2="58" strokeWidth="1" />
        <line x1="100" y1="106" x2="124" y2="106" strokeWidth="1" />
        <line x1="120" y1="58" x2="120" y2="106" />
        <text x="133" y="82" transform="rotate(-90 133 82)" textAnchor="middle" stroke="none" className="font-mono" fontSize="11">Ø int</text>
      </g>

      {/* Ø externo: face externa a face externa */}
      <g className={`${cota("externo")} transition-colors duration-200`} stroke="currentColor" strokeWidth={peso("externo")} fill="currentColor">
        <line x1="100" y1="30" x2="156" y2="30" strokeWidth="1" />
        <line x1="100" y1="134" x2="156" y2="134" strokeWidth="1" />
        <line x1="152" y1="30" x2="152" y2="134" />
        <text x="165" y="82" transform="rotate(-90 165 82)" textAnchor="middle" stroke="none" className="font-mono" fontSize="11">Ø ext</text>
      </g>
    </svg>
  );
}

export default function SearchForm({ onSearch, children }) {
  const [codigo, setCodigo] = useState("");
  const [tolerancia, setTolerancia] = useState("0.5");
  const [unidade, setUnidade] = useState("mm");
  const [campos, setCampos] = useState(CAMPOS_VAZIOS);
  const [foco, setFoco] = useState(null);

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
    <div className="w-full max-w-7xl mx-auto relative z-20 rounded-2xl border border-white/10 bg-white/5 shadow-xl">
      <form onSubmit={handleSubmit} className="p-4 md:p-6">
        <Passo n={1} titulo="Meça a peça" />

        <div className="flex flex-col md:flex-row gap-6 md:gap-8 mt-5">
          <div className="hidden md:flex md:w-72 lg:w-96 shrink-0 items-center justify-center border-r border-white/10 pr-6 lg:pr-8">
            <CorteRetentor foco={foco} />
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-5">
          {/* Código */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-gray-300 font-bold">Código ou referência</span>
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ex.: 5702 ou 12500250"
              className="bg-black/40 border border-white/20 rounded-xl px-4 h-13 text-white text-lg focus:outline-none focus:border-accent-gold transition-colors shadow-inner w-full uppercase placeholder:normal-case placeholder:text-gray-600"
            />
          </label>

          {/* Medidas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {CAMPOS_MEDIDA.map(({ key, label }) => {
              const mm = parseEntrada(campos[key], unidade);
              const erro = invalido(key);
              return (
                <label key={key} className="flex flex-col gap-1.5 min-w-0">
                  <span className="text-sm text-gray-300 font-bold">
                    {label} <span className="text-gray-500 font-normal">({unidade})</span>
                  </span>
                  <input
                    type="text"
                    inputMode={unidade === "pol" ? "text" : "decimal"}
                    value={campos[key]}
                    onChange={(e) => setCampos((prev) => ({ ...prev, [key]: e.target.value }))}
                    onFocus={() => setFoco(key)}
                    onBlur={() => setFoco((atual) => (atual === key ? null : atual))}
                    placeholder={unidade === "pol" ? "1 3/4" : "0,00"}
                    aria-invalid={erro}
                    className={`bg-black/40 border rounded-xl px-3 h-13 text-white text-lg font-mono focus:outline-none transition-colors shadow-inner w-full placeholder:text-gray-600 ${
                      erro ? "border-accent-red focus:border-accent-red" : "border-white/20 focus:border-accent-gold"
                    }`}
                  />
                  <span className={`text-xs h-4 ${erro ? "text-accent-red" : "text-white/40"}`}>
                    {erro
                      ? "Valor inválido"
                      : unidade === "pol" && mm !== null
                        ? `= ${formatMm(mm)} mm`
                        : DICAS[key]}
                  </span>
                </label>
              );
            })}
          </div>

          {/* Opções + ação */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-4 border-t border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Unidade</span>
              <div role="radiogroup" aria-label="Unidade das medidas" className="flex h-10 rounded-lg border border-white/20 bg-black/40 p-0.5">
                {["mm", "pol"].map((u) => (
                  <button
                    key={u}
                    type="button"
                    role="radio"
                    aria-checked={unidade === u}
                    onClick={() => trocarUnidade(u)}
                    className={`px-4 rounded-md text-sm font-bold transition-colors duration-200 cursor-pointer ${
                      unidade === u ? "bg-white/15 text-white" : "text-gray-500 hover:text-white"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Tolerância</span>
              <select
                value={tolerancia}
                onChange={(e) => setTolerancia(e.target.value)}
                className="bg-black/40 border border-white/20 rounded-lg px-3 h-10 text-gray-200 text-sm focus:outline-none focus:border-accent-gold transition-colors cursor-pointer"
              >
                {TOLERANCIAS.map((t) => (
                  <option key={t} value={t} className="bg-zinc-900 text-white">
                    ± {formatMm(t)} mm
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="w-full sm:w-auto sm:ml-auto bg-accent-red hover:bg-red-700 text-white font-anton tracking-widest text-lg px-10 h-12 rounded-xl flex items-center justify-center gap-2 transition-colors duration-200 active:scale-95 shadow-lg shadow-accent-red/20 cursor-pointer"
            >
              <Search size={18} />
              BUSCAR
            </button>
          </div>
          </div>
        </div>
      </form>

      {children && <div className="border-t border-white/10 p-4 md:p-6">{children}</div>}
    </div>
  );
}
