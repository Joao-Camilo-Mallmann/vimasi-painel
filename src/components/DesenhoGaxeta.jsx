import { useId } from "react";

// Gaxeta em 3D cortada ao meio (como foto de catálogo, nas cores da Vimasi): perfil (raio, altura)
// girado só na metade de trás, para o corte mostrar o "U" com o o-ring.
const CX = 130;
const BASE_Y = 100;
const INCLINACAO = 0.42;
const FUNDO = [Math.PI, 2 * Math.PI];
const RI = 60;
const RE = 80;
const H = 36;

// perfil em U (gaxeta modelo B): base, lábio externo, canal, lábio interno
const PERFIL = [
  [60, 0], [80, 0], [80, 28], [81.5, 33], [79, 36.5], [76, 35], [74, 27],
  [72, 23], [70, 22], [68, 23], [66, 27], [64, 35], [61, 36.5], [58.5, 33], [60, 28],
];
const ORING = { r: 70, z: 27.5, raio: 4 };

const xy = (r, z, t) => [CX + r * Math.cos(t), BASE_Y - z + r * INCLINACAO * Math.sin(t)];
const ponto = (r, z, t) => xy(r, z, t).map((v) => v.toFixed(1)).join(" ");

function curva(r, z, [t0, t1], passos = 48) {
  return Array.from({ length: passos + 1 }, (_, i) => `${i ? "L" : "M"}${ponto(r, z, t0 + ((t1 - t0) * i) / passos)}`).join("");
}

/** Faixa de superfície entre dois pontos do perfil, num trecho do giro. */
function faixa(r1, z1, r2, z2, [t0, t1] = FUNDO, passos = 48) {
  const volta = Array.from({ length: passos + 1 }, (_, i) => `L${ponto(r2, z2, t1 - ((t1 - t0) * i) / passos)}`).join("");
  return `${curva(r1, z1, [t0, t1], passos)}${volta}Z`;
}

/** Faixa que segue vários pontos do perfil (uma por segmento). */
const faixas = (pontos) => pontos.slice(1).map(([r, z], i) => faixa(pontos[i][0], pontos[i][1], r, z)).join("");

/** Face do corte: o perfil plano numa das pontas (t = 0 à direita, t = π à esquerda). */
const faceCorte = (t) => `M${PERFIL.map(([r, z]) => ponto(r, z, t)).join("L")}Z`;

/**
 * Gaxeta em 3D com as cotas: a cota do campo em foco (e a parte da peça que ela mede)
 * acende em vermelho, para ficar claro o que cada medida significa.
 */
export default function DesenhoGaxeta({ foco }) {
  const uid = useId();
  const furo = `${uid}-furo`;
  const seta = `${uid}-seta`;
  const setaRed = `${uid}-seta-red`;
  const VERMELHO = "var(--color-accent-red, #d32f2f)";
  const ativo = (campo) => foco === campo;
  const cotaProps = (campo) => ({
    className: `${ativo(campo) ? "text-accent-red" : "text-white/70"} transition-colors duration-200`,
    stroke: "currentColor",
    strokeWidth: ativo(campo) ? 2.25 : 1.25,
    fill: "currentColor",
  });
  const marca = (campo) => {
    const id = ativo(campo) ? setaRed : seta;
    return { markerStart: `url(#${id})`, markerEnd: `url(#${id})` };
  };
  const texto = {
    style: { stroke: "#0b0b0d", strokeWidth: 2.5, paintOrder: "stroke" },
    className: "font-mono",
    fontSize: 12,
    textAnchor: "middle",
  };
  const borda = { fill: "none", stroke: "#3d2f22", strokeWidth: 0.9, strokeLinejoin: "round" };
  // aresta que acende junto com a cota
  const realce = (campo) => (ativo(campo) ? { stroke: VERMELHO, strokeWidth: 2.25 } : {});

  const [xIntE] = xy(RI, 0, Math.PI);
  const [xIntD] = xy(RI, 0, 0);
  const [xExtE] = xy(RE, 0, Math.PI);
  const [xExtD] = xy(RE, 0, 0);
  const yBase = BASE_Y;
  const yTopo = BASE_Y - H;

  return (
    <svg viewBox="0 0 260 138" className="w-full h-auto" role="img" aria-label="Gaxeta em 3D cortada ao meio, com as cotas das medidas">
      <defs>
        <linearGradient id={furo} x1="0" x2="1">
          <stop offset="0" stopColor="#6e5843" />
          <stop offset="0.5" stopColor="var(--color-accent-gold, #e4c7aa)" />
          <stop offset="1" stopColor="#6e5843" />
        </linearGradient>
        {[
          [seta, "#ffffffb3"],
          [setaRed, VERMELHO],
        ].map(([id, cor]) => (
          <marker key={id} id={id} viewBox="0 0 6 6" refX="3" refY="3" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
            <path d="M0 3 L6 0 L6 6 Z" fill={cor} stroke="none" />
          </marker>
        ))}
      </defs>

      {/* metade de trás, do mais distante (externo) ao mais próximo (furo) */}
      <path d={faixas([[81.5, 33], [79, 36.5], [76, 35]])} fill="#f1dfcb" />
      <path d={faixas([[76, 35], [74, 27], [72, 23]])} fill="#9c8165" />
      <path d={faixas([[66, 29], [70, 31.5], [74, 29]])} fill="#232327" />
      <path d={faixa(67, 30.5, 71, 31.4)} fill="#4a4a52" />
      <path d={faixas([[64, 35], [61, 36.5], [58.5, 33]])} fill="#f7e9da" />
      <path d={faixa(58.5, 33, 60, 28)} fill="#c4a688" />
      <path d={faixa(60, 28, 60, 0)} fill={`url(#${furo})`} />

      {/* arestas da metade de trás */}
      <path d={curva(81.5, 33, FUNDO)} {...borda} {...realce("externo")} />
      <path d={curva(76, 35, FUNDO) + curva(64, 35, FUNDO)} {...borda} strokeWidth="0.6" />
      <path d={curva(58.5, 33, FUNDO)} {...borda} strokeWidth="0.6" />
      <path d={curva(60, 28, FUNDO) + curva(60, 0, FUNDO)} {...borda} {...realce("interno")} />

      {/* faces do corte, com o o-ring no canal */}
      {[Math.PI, 0].map((t) => {
        const [ox, oy] = xy(ORING.r, ORING.z, t);
        const campo = t === 0 ? "altura" : "secao";
        return (
          <g key={t}>
            <path d={faceCorte(t)} {...borda} fill="#d4b593" {...realce(campo)} />
            <circle cx={ox} cy={oy} r={ORING.raio} fill="#1d1d21" stroke="#0b0b0d" strokeWidth="0.6" />
            <circle cx={ox - 1.2} cy={oy - 1.2} r="1.1" fill="#ffffff40" />
          </g>
        );
      })}

      {/* Ø interno: entre as faces internas, no vão do corte */}
      <g {...cotaProps("interno")}>
        <line x1={xIntE} y1={yBase - 12} x2={xIntD} y2={yBase - 12} {...marca("interno")} />
        <text x={CX} y={yBase - 17} {...texto}>Ø int</text>
      </g>

      {/* Ø externo: de ponta a ponta, embaixo */}
      <g {...cotaProps("externo")}>
        <line x1={xExtE} y1={yBase + 2} x2={xExtE} y2={yBase + 18} strokeWidth="0.75" strokeDasharray="2 2" />
        <line x1={xExtD} y1={yBase + 2} x2={xExtD} y2={yBase + 18} strokeWidth="0.75" strokeDasharray="2 2" />
        <line x1={xExtE} y1={yBase + 14} x2={xExtD} y2={yBase + 14} {...marca("externo")} />
        <text x={CX} y={yBase + 29} {...texto}>Ø ext</text>
      </g>

      {/* seção: espessura da parede, (Ø ext − Ø int) / 2, na face da esquerda */}
      <g {...cotaProps("secao")}>
        <line x1={xExtE} y1={yTopo - 3} x2={xExtE} y2={yTopo - 16} strokeWidth="0.75" strokeDasharray="2 2" />
        <line x1={xIntE} y1={yTopo - 3} x2={xIntE} y2={yTopo - 16} strokeWidth="0.75" strokeDasharray="2 2" />
        <line x1={xExtE} y1={yTopo - 12} x2={xIntE} y2={yTopo - 12} {...marca("secao")} />
        <text x={(xExtE + xIntE) / 2} y={yTopo - 18} {...texto}>seção</text>
      </g>

      {/* altura: no sentido do eixo, na face da direita */}
      <g {...cotaProps("altura")}>
        <line x1={xExtD + 3} y1={yTopo} x2={xExtD + 20} y2={yTopo} strokeWidth="0.75" strokeDasharray="2 2" />
        <line x1={xExtD + 3} y1={yBase} x2={xExtD + 20} y2={yBase} strokeWidth="0.75" strokeDasharray="2 2" />
        <line x1={xExtD + 16} y1={yTopo} x2={xExtD + 16} y2={yBase} {...marca("altura")} />
        <text x={xExtD + 30} y={(yTopo + yBase) / 2} transform={`rotate(-90 ${xExtD + 30} ${(yTopo + yBase) / 2})`} {...texto}>alt.</text>
      </g>
    </svg>
  );
}
