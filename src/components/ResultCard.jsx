import { getTipoBadgeStyle } from "../utils/tipoStyles";

export default function ResultCard({ peca }) {
  const badgeStyle = getTipoBadgeStyle(peca.Tipo);

  return (
    <div
      className="glass rounded-xl p-5 hover:bg-white/10 transition-colors cursor-default group border-l-4"
      style={{
        borderLeftColor: badgeStyle.backgroundColor,
      }}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-xs text-gray-400 font-bold tracking-wider uppercase mb-1">
            Código do Produto
          </p>
          <h3 className="text-2xl font-anton text-accent-gold tracking-wide">
            {peca.Codigo}
          </h3>
        </div>
        <span
          className="text-xs px-3 py-1 rounded-full font-mono border font-bold shadow-sm"
          style={badgeStyle}
        >
          {peca.Tipo}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="bg-black/20 rounded-lg p-3 border border-white/5 group-hover:border-white/10 transition-colors">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Ø Interno
          </p>
          <p className="text-lg font-mono text-gray-200">
            {Number(peca.Interno).toFixed(2)}{" "}
            <span className="text-xs text-gray-500">mm</span>
          </p>
        </div>
        <div className="bg-black/20 rounded-lg p-3 border border-white/5 group-hover:border-white/10 transition-colors">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Ø Externo
          </p>
          <p className="text-lg font-mono text-gray-200">
            {Number(peca.Externo).toFixed(2)}{" "}
            <span className="text-xs text-gray-500">mm</span>
          </p>
        </div>
        <div className="bg-black/20 rounded-lg p-3 border border-white/5 group-hover:border-white/10 transition-colors">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Alt. Base
          </p>
          <p className="text-lg font-mono text-gray-200">
            {Number(peca.AlturaBase).toFixed(2)}{" "}
            <span className="text-xs text-gray-500">mm</span>
          </p>
        </div>
        <div className="bg-black/20 rounded-lg p-3 border border-white/5 group-hover:border-white/10 transition-colors">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Alt. Total
          </p>
          <p className="text-lg font-mono text-gray-200">
            {Number(peca.AlturaTotal).toFixed(2)}{" "}
            <span className="text-xs text-gray-500">mm</span>
          </p>
        </div>
      </div>
    </div>
  );
}
