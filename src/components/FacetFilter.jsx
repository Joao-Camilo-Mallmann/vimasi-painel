import { ChevronRight, Filter, X } from "lucide-react";
import { FACETAS } from "../config/taxonomia";
import { getTipoBadgeStyle } from "../utils/tipoStyles";

/**
 * Funil de facetas: Tipo → Modelo → Material → Aplicação.
 * Cada opção mostra quantas peças restariam; clique em qualquer ordem.
 */
export default function FacetFilter({ opcoes, selecao, etapas, onToggle, onLimpar }) {
  const temSelecao = FACETAS.some(({ key }) => selecao[key].length > 0);

  return (
    <div className="glass rounded-2xl p-4 md:p-6 mb-8 animate-fade-in-up">
      {/* Trilha do funil */}
      <div className="flex flex-wrap items-center gap-2 mb-5 font-mono text-xs">
        <Filter size={14} className="text-accent-gold shrink-0" />
        {etapas.map((etapa, i) => (
          <span key={etapa.key} className="flex items-center gap-2">
            {i > 0 && <ChevronRight size={14} className="text-white/30" />}
            <span
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all duration-300 ${
                i === etapas.length - 1
                  ? "border-accent-red/60 bg-accent-red/15 text-white"
                  : "border-white/10 bg-white/5 text-white/60"
              }`}
            >
              <span className="uppercase tracking-wider">
                {etapa.valores ? etapa.valores.join(" / ") : etapa.label}
              </span>
              <strong className="text-accent-gold">{etapa.count}</strong>
              {etapa.valores && (
                <button
                  type="button"
                  onClick={() => onLimpar(etapa.key)}
                  className="text-white/40 hover:text-accent-red transition-colors duration-300 cursor-pointer"
                  title={`Remover filtro de ${etapa.label}`}
                >
                  <X size={12} />
                </button>
              )}
            </span>
          </span>
        ))}
        {temSelecao && (
          <button
            type="button"
            onClick={() => onLimpar()}
            className="ml-auto text-white/50 hover:text-accent-red uppercase tracking-widest transition-colors duration-300 cursor-pointer"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Grupos de facetas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {FACETAS.map(({ key, label }) => (
          <div key={key} className="flex flex-col gap-2 min-w-0">
            <h3 className="font-anton uppercase italic tracking-wide text-white/90 text-sm flex items-center justify-between">
              {label}
              {selecao[key].length > 0 && (
                <button
                  type="button"
                  onClick={() => onLimpar(key)}
                  className="font-arimo not-italic normal-case text-[11px] text-white/40 hover:text-accent-red transition-colors duration-300 cursor-pointer"
                >
                  limpar
                </button>
              )}
            </h3>
            <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto pr-1">
              {opcoes[key].length === 0 && (
                <span className="text-white/40 text-xs">—</span>
              )}
              {opcoes[key].map((op) => {
                const ativo = selecao[key].includes(op.valor);
                return (
                  <button
                    key={op.valor}
                    type="button"
                    onClick={() => onToggle(key, op.valor)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all duration-300 cursor-pointer active:scale-95 hover:scale-105 ${
                      ativo
                        ? "border-accent-red bg-accent-red/20 text-white shadow-md shadow-accent-red/10"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {key === "tipo" && (
                      <span
                        className="w-2 h-2 rounded-full border shrink-0"
                        style={getTipoBadgeStyle(op.valor)}
                      />
                    )}
                    <span className="truncate max-w-40">{op.label}</span>
                    <span
                      className={`font-mono text-[10px] px-1 rounded ${
                        ativo ? "bg-accent-red/40 text-white" : "bg-white/10 text-accent-gold"
                      }`}
                    >
                      {op.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
