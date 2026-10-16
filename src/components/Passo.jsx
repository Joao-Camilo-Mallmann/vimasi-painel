/** Cabeçalho de um passo da busca (1 · medir, 2 · refinar). */
export default function Passo({ n, titulo, dica, apagado = false }) {
  return (
    <div className={`flex items-center gap-3 transition-opacity duration-300 ${apagado ? "opacity-50" : ""}`}>
      <span className="w-7 h-7 rounded-full border border-accent-gold/60 text-accent-gold font-anton flex items-center justify-center text-sm shrink-0">
        {n}
      </span>
      <h2 className="font-anton text-xl tracking-wide text-white">{titulo}</h2>
      {dica && <span className="text-sm text-gray-500 hidden sm:inline">{dica}</span>}
    </div>
  );
}
