import { Check, ChevronDown, PackageCheck, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Passo from "./Passo";
import { FACETAS } from "../config/taxonomia";
import { getTipoBadgeStyle } from "../utils/tipoStyles";

const rotulo = (op) => (op.valor === "—" ? "Não informado" : op.label);

const NOTAS = {
  aplicacao: "Peças sem aplicação definida aparecem em Haste e Êmbolo.",
};

/** Acima disso a lista ganha um campo de busca. */
const LIMITE_BUSCA = 10;

/**
 * Seletor suspenso de múltipla escolha. Em telas pequenas abre como folha no rodapé.
 */
function Seletor({ label, opcoes, selecionados, onToggle, onLimpar, nota }) {
  const [aberto, setAberto] = useState(false);
  const [consulta, setConsulta] = useState("");
  const raiz = useRef(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e) => {
      if (raiz.current && !raiz.current.contains(e.target)) setAberto(false);
    };
    const esc = (e) => e.key === "Escape" && setAberto(false);
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const alternar = () => {
    setConsulta("");
    setAberto((v) => !v);
  };

  const ativo = selecionados.length > 0;
  const nomes = selecionados.map((v) => {
    const op = opcoes.find((o) => o.valor === v);
    return op ? rotulo(op) : v;
  });
  const resumo = !ativo ? "" : nomes.length > 1 ? `${nomes[0]} +${nomes.length - 1}` : nomes[0];

  const maximo = Math.max(1, ...opcoes.map((o) => o.count));
  const termo = consulta.trim().toLowerCase();
  const visiveis = termo ? opcoes.filter((o) => rotulo(o).toLowerCase().includes(termo)) : opcoes;

  return (
    <div ref={raiz} className="relative">
      <div
        className={`flex items-center h-10 rounded-xl border text-sm transition-colors duration-200 ${
          ativo ? "border-accent-gold/60 bg-accent-gold/10 text-white" : "border-white/15 bg-white/5 text-gray-300 hover:border-white/30"
        }`}
      >
        <button
          type="button"
          onClick={alternar}
          aria-expanded={aberto}
          aria-haspopup="listbox"
          className="flex items-center gap-2 pl-3.5 pr-3 h-full cursor-pointer"
        >
          <span className={ativo ? "text-accent-gold font-bold" : ""}>{label}</span>
          {ativo && <span className="truncate max-w-32">{resumo}</span>}
          {!ativo && <span className="text-xs text-white/40">{opcoes.length}</span>}
          <ChevronDown size={14} className={`text-white/50 transition-transform duration-200 ${aberto ? "rotate-180" : ""}`} />
        </button>
        {ativo && (
          <button
            type="button"
            onClick={onLimpar}
            aria-label={`Remover filtro de ${label}`}
            className="h-full pr-3 text-white/50 hover:text-accent-red transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {aberto && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 sm:hidden" aria-hidden="true" />
          <div className="fixed inset-x-3 bottom-3 z-50 sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-2 sm:w-80 rounded-2xl border border-white/15 bg-zinc-900 shadow-2xl shadow-black/60 flex flex-col max-h-[70vh] sm:max-h-96">
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <span className="font-anton tracking-wide text-white">{label}</span>
              <div className="flex items-center gap-3 text-xs">
                {ativo && (
                  <button type="button" onClick={onLimpar} className="text-gray-400 hover:text-accent-red transition-colors cursor-pointer">
                    Limpar
                  </button>
                )}
                <button type="button" onClick={() => setAberto(false)} className="sm:hidden text-white/60 cursor-pointer" aria-label="Fechar">
                  <X size={18} />
                </button>
              </div>
            </div>

            {opcoes.length > LIMITE_BUSCA && (
              <div className="px-3 pb-2">
                <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-black/40 border border-white/10 focus-within:border-accent-gold transition-colors">
                  <Search size={14} className="text-white/40 shrink-0" />
                  <input
                    type="text"
                    value={consulta}
                    onChange={(e) => setConsulta(e.target.value)}
                    placeholder={`Buscar ${label.toLowerCase()}`}
                    className="bg-transparent outline-none text-sm text-white w-full placeholder:text-gray-600"
                    autoFocus
                  />
                </div>
              </div>
            )}

            <ul role="listbox" aria-multiselectable="true" className="overflow-y-auto px-2 pb-2 flex-1">
              {visiveis.length === 0 && <li className="px-3 py-4 text-sm text-gray-500">Nada encontrado.</li>}
              {visiveis.map((op) => {
                const marcado = selecionados.includes(op.valor);
                return (
                  <li key={op.valor} role="option" aria-selected={marcado}>
                    <button
                      type="button"
                      onClick={() => onToggle(op.valor)}
                      className="relative w-full flex items-center gap-3 px-3 h-10 rounded-lg text-sm text-left cursor-pointer hover:bg-white/5 transition-colors overflow-hidden"
                    >
                      <span
                        aria-hidden="true"
                        className={`absolute bottom-0.5 left-3 h-0.5 rounded-full ${marcado ? "bg-accent-gold" : "bg-white/20"}`}
                        style={{ width: `calc((100% - 1.5rem) * ${Math.max(0.03, Math.sqrt(op.count / maximo))})` }}
                      />
                      <span
                        className={`relative w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          marcado ? "bg-accent-gold border-accent-gold text-black" : "border-white/30"
                        }`}
                      >
                        {marcado && <Check size={12} strokeWidth={3} />}
                      </span>
                      <span className={`relative flex-1 truncate ${marcado ? "text-white font-bold" : "text-gray-200"}`}>{rotulo(op)}</span>
                      <span className="relative font-mono text-xs text-white/50 tabular-nums">{op.count.toLocaleString("pt-BR")}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {nota && <p className="px-4 py-2.5 text-xs text-gray-500 border-t border-white/10">{nota}</p>}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Filtros dos resultados. Tipo é a primeira decisão e fica sempre à vista;
 * Perfil, Material e Aplicação ficam em seletores. Dentro de um grupo vale OU,
 * entre grupos vale E, e cada opção mostra quantas peças restam.
 */
export default function FacetFilter({ desabilitado, opcoes, selecao, onToggle, onLimpar, apenasEstoque, totalEstoque, onToggleEstoque }) {
  const temSelecao = FACETAS.some(({ key }) => selecao[key].length > 0);
  const secundarias = FACETAS.filter(({ key }) => key !== "tipo");
  const tipoLabel = FACETAS.find(({ key }) => key === "tipo")?.label ?? "Tipo";

  if (desabilitado) {
    return (
      <div className="flex flex-col gap-2">
        <Passo n={2} titulo="Refine o resultado" apagado />
        <p className="text-sm text-gray-500 pl-10">Depois da busca, filtre por tipo, perfil, material e aplicação.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Passo n={2} titulo="Refine o resultado" />

      {/* Tipo */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
        <span className="text-sm text-gray-400 sm:w-16 sm:pt-2 shrink-0">{tipoLabel}</span>
        <div className="flex flex-wrap gap-2">
          {opcoes.tipo.map((op) => {
            const ativo = selecao.tipo.includes(op.valor);
            return (
              <button
                key={op.valor}
                type="button"
                aria-pressed={ativo}
                onClick={() => onToggle("tipo", op.valor)}
                className={`flex items-center gap-2 h-9 px-3 rounded-lg border text-sm transition-colors duration-200 cursor-pointer active:scale-95 ${
                  ativo
                    ? "border-accent-gold bg-accent-gold/15 text-white"
                    : "border-white/10 bg-white/5 text-gray-300 hover:border-white/30 hover:text-white"
                }`}
              >
                <span className="w-2 h-2 rounded-full border shrink-0" style={getTipoBadgeStyle(op.valor)} />
                <span className={ativo ? "font-bold" : ""}>{op.label}</span>
                <span className="font-mono text-xs text-white/50 tabular-nums">{op.count.toLocaleString("pt-BR")}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Refinar */}
      <div className="flex flex-wrap items-center gap-2 pt-5 border-t border-white/10">
        <span className="text-sm text-gray-400 sm:w-16 shrink-0 hidden sm:block">Detalhe</span>
        {secundarias.map(({ key, label }) => (
          <Seletor
            key={key}
            label={label}
            opcoes={opcoes[key]}
            selecionados={selecao[key]}
            onToggle={(valor) => onToggle(key, valor)}
            onLimpar={() => onLimpar(key)}
            nota={NOTAS[key]}
          />
        ))}

        <div className="flex items-center gap-4 sm:ml-auto">
          {temSelecao && (
            <button type="button" onClick={() => onLimpar()} className="text-sm text-gray-400 hover:text-accent-red underline-offset-4 hover:underline transition-colors cursor-pointer">
              Limpar filtros
            </button>
          )}
          <button
            type="button"
            role="switch"
            aria-checked={apenasEstoque}
            onClick={onToggleEstoque}
            title={apenasEstoque ? "Mostrar todas as peças encontradas" : "Mostrar só as peças que temos em estoque"}
            className={`flex items-center gap-2 h-10 px-3.5 rounded-xl border text-sm transition-colors duration-200 cursor-pointer ${
              apenasEstoque
                ? "border-accent-gold bg-accent-gold/20 text-accent-gold font-bold"
                : "border-white/15 bg-white/5 text-gray-300 hover:border-white/30 hover:text-white"
            }`}
          >
            <PackageCheck size={16} />
            Só em estoque
            <span className={`font-mono text-xs tabular-nums ${apenasEstoque ? "text-accent-gold" : "text-white/50"}`}>{totalEstoque.toLocaleString("pt-BR")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
