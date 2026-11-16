import { useId } from "react";

// Motor de desenho 3D cortado ao meio (como foto de catálogo, nas cores da Vimasi):
// perfil (raio, altura) girado só na metade de trás, com as faces do corte mostrando a seção.
const CX = 130;
const BASE_Y = 100;
const INCLINACAO = 0.42;
const FUNDO = [Math.PI, 2 * Math.PI];

const xy = (r, z, t) => [CX + r * Math.cos(t), BASE_Y - z + r * INCLINACAO * Math.sin(t)];
const ponto = (r, z, t) => xy(r, z, t).map((v) => v.toFixed(1)).join(" ");

function curva(r, z, [t0, t1], passos = 48) {
  return Array.from(
    { length: passos + 1 },
    (_, i) => `${i ? "L" : "M"}${ponto(r, z, t0 + ((t1 - t0) * i) / passos)}`,
  ).join("");
}

/** Faixa de superfície entre dois pontos do perfil, num trecho do giro. */
function faixa(r1, z1, r2, z2, [t0, t1] = FUNDO, passos = 48) {
  const volta = Array.from(
    { length: passos + 1 },
    (_, i) => `L${ponto(r2, z2, t1 - ((t1 - t0) * i) / passos)}`,
  ).join("");
  return `${curva(r1, z1, [t0, t1], passos)}${volta}Z`;
}

/** Faixa que segue vários pontos do perfil (uma por segmento). */
const faixas = (pontos) =>
  pontos.slice(1).map(([r, z], i) => faixa(pontos[i][0], pontos[i][1], r, z)).join("");

/** Face do corte: o perfil plano numa das pontas (t = 0 à direita, t = π à esquerda). */
const faceCorte = (perfil, t) => `M${perfil.map(([r, z]) => ponto(r, z, t)).join("L")}Z`;

/** Gera o arco contínuo da metade de trás de um toro (para o O-ring). */
function arcoToro(rMed, zCentro, raioCorda, a0, a1, passos = 6) {
  const pts = Array.from({ length: passos + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / passos;
    return [rMed + raioCorda * Math.cos(a), zCentro + raioCorda * Math.sin(a)];
  });
  return faixas(pts);
}

/** Gera faixas de superfície para o anel guia partido por um corte em bisel na parte de trás. */
function geometriaAnelBisel(ri, re, h) {
  const passos = 24;
  const tL = (z) => 1.43 * Math.PI + (z / h) * 0.1 * Math.PI;
  const tR = (z) => tL(z) + 0.05 * Math.PI;

  const seq = (r, z, t0, t1) =>
    Array.from({ length: passos + 1 }, (_, i) => ponto(r, z, t0 + ((t1 - t0) * i) / passos));

  const topoEsq = `M${seq(re, h, Math.PI, tL(h)).join("L")}L${seq(ri, h, tL(h), Math.PI).join("L")}Z`;
  const furoEsq = `M${seq(ri, h, Math.PI, tL(h)).join("L")}L${ponto(ri, 0, tL(0))}L${seq(ri, 0, tL(0), Math.PI).join("L")}Z`;

  const faceBiselDir = `M${[
    ponto(ri, 0, tR(0)),
    ponto(re, 0, tR(0)),
    ponto(re, h, tR(h)),
    ponto(ri, h, tR(h)),
  ].join("L")}Z`;

  const topoDir = `M${seq(re, h, tR(h), 2 * Math.PI).join("L")}L${seq(ri, h, 2 * Math.PI, tR(h)).join("L")}Z`;
  const furoDir = `M${seq(ri, h, tR(h), 2 * Math.PI).join("L")}L${seq(ri, 0, 2 * Math.PI, tR(0)).join("L")}L${ponto(ri, h, tR(h))}Z`;

  return {
    topoEsq,
    furoEsq,
    faceBiselDir,
    topoDir,
    furoDir,
    bordaExt: curva(re, h, [Math.PI, tL(h)], passos) + curva(re, h, [tR(h), 2 * Math.PI], passos),
    bordaInt:
      curva(ri, h, [Math.PI, tL(h)], passos) +
      curva(ri, 0, [Math.PI, tL(0)], passos) +
      curva(ri, h, [tR(h), 2 * Math.PI], passos) +
      curva(ri, 0, [tR(0), 2 * Math.PI], passos),
    linhasBisel: `M${ponto(re, h, tL(h))}L${ponto(ri, h, tL(h))}L${ponto(ri, 0, tL(0))}M${ponto(re, h, tR(h))}L${ponto(ri, h, tR(h))}L${ponto(ri, 0, tR(0))}`,
  };
}

const ANEL_BISEL = geometriaAnelBisel(60, 80, 22);

// ── Definições por Tipo ─────────────────────────────────────────
const GAXETA = {
  chave: "Gaxeta",
  ariaLabel: "Gaxeta em 3D cortada ao meio, com as cotas das medidas",
  ri: 60,
  re: 80,
  h: 36,
  cotas: ["interno", "externo", "secao", "altura"],
  perfil: [
    [60, 0], [80, 0], [80, 28], [81.5, 33], [79, 36.5], [76, 35], [74, 27],
    [72, 23], [70, 22], [68, 23], [66, 27], [64, 35], [61, 36.5], [58.5, 33], [60, 28],
  ],
  extras: {
    oring: { r: 70, z: 27.5, raio: 4 },
  },
  renderFundo: ({ ids, borda, realce }) => (
    <>
      <path d={faixas([[81.5, 33], [79, 36.5], [76, 35]])} fill="#f1dfcb" />
      <path d={faixas([[76, 35], [74, 27], [72, 23]])} fill="#9c8165" />
      <path d={faixas([[66, 29], [70, 31.5], [74, 29]])} fill="#232327" />
      <path d={faixa(67, 30.5, 71, 31.4)} fill="#4a4a52" />
      <path d={faixas([[64, 35], [61, 36.5], [58.5, 33]])} fill="#f7e9da" />
      <path d={faixa(58.5, 33, 60, 28)} fill="#c4a688" />
      <path d={faixa(60, 28, 60, 0)} fill={`url(#${ids.furo})`} />

      <path d={curva(81.5, 33, FUNDO)} {...borda} {...realce("externo")} />
      <path d={curva(76, 35, FUNDO) + curva(64, 35, FUNDO)} {...borda} strokeWidth="0.6" />
      <path d={curva(58.5, 33, FUNDO)} {...borda} strokeWidth="0.6" />
      <path d={curva(60, 28, FUNDO) + curva(60, 0, FUNDO)} {...borda} {...realce("interno")} />
    </>
  ),
};

const RASPADOR = {
  chave: "Raspador",
  ariaLabel: "Raspador em 3D cortado ao meio, com as cotas das medidas",
  ri: 60,
  re: 80,
  h: 34,
  cotas: ["interno", "externo", "secao", "altura"],
  perfil: [
    [60, 0], [80, 0], [80, 20], [77, 23], [70, 23],
    [63.5, 34], [60, 34], [61.5, 22], [60, 17],
  ],
  extras: {},
  renderFundo: ({ ids, borda, realce }) => (
    <>
      <path d={faixas([[80, 20], [77, 23], [70, 23]])} fill="#f1dfcb" />
      <path d={faixa(70, 23, 63.5, 34)} fill="#e2c6a8" />
      <path d={faixa(63.5, 34, 60, 34)} fill="#f7e9da" />
      <path d={faixa(60, 34, 61.5, 22)} fill="#9c8165" />
      <path d={faixas([[61.5, 22], [60, 17], [60, 0]])} fill={`url(#${ids.furo})`} />

      <path d={curva(80, 20, FUNDO)} {...borda} {...realce("externo")} />
      <path d={curva(77, 23, FUNDO) + curva(70, 23, FUNDO)} {...borda} strokeWidth="0.6" />
      <path d={curva(63.5, 34, FUNDO)} {...borda} strokeWidth="0.6" />
      <path d={curva(60, 34, FUNDO) + curva(60, 0, FUNDO)} {...borda} {...realce("interno")} />
    </>
  ),
};

const RASPADOR_METALICO = {
  chave: "Raspador metálico",
  ariaLabel: "Raspador metálico em 3D cortado ao meio, com carcaça metálica e cotas das medidas",
  ri: 60,
  re: 80,
  h: 34,
  cotas: ["interno", "externo", "secao", "altura"],
  // Contorno externo completo para realce da seção/altura na face do corte
  perfil: [
    [60, 0], [80, 0], [80, 24], [70, 24], [63.5, 34], [60, 34], [61.5, 22], [60, 17],
  ],
  extras: {
    carcacaMetalica: [
      [63, 0], [80, 0], [80, 24], [74.5, 24], [74.5, 21], [77.5, 21], [77.5, 2.5], [63, 2.5],
    ],
    corpoElastomero: [
      [60, 0], [63, 0], [63, 2.5], [77.5, 2.5], [77.5, 21], [74.5, 21], [74.5, 24],
      [70, 24], [63.5, 34], [60, 34], [61.5, 22], [60, 17],
    ],
  },
  renderFundo: ({ ids, borda, realce }) => (
    <>
      <path d={faixa(80, 24, 74.5, 24)} fill={`url(#${ids.metalTopo})`} />
      <path d={faixa(74.5, 24, 70, 24)} fill="#c4a688" />
      <path d={faixa(70, 24, 63.5, 34)} fill="#e2c6a8" />
      <path d={faixa(63.5, 34, 60, 34)} fill="#f7e9da" />
      <path d={faixa(60, 34, 61.5, 22)} fill="#9c8165" />
      <path d={faixas([[61.5, 22], [60, 17], [60, 0]])} fill={`url(#${ids.furo})`} />

      <path d={curva(80, 24, FUNDO)} {...borda} stroke="#334155" {...realce("externo")} />
      <path d={curva(74.5, 24, FUNDO) + curva(70, 24, FUNDO)} {...borda} strokeWidth="0.6" />
      <path d={curva(63.5, 34, FUNDO)} {...borda} strokeWidth="0.6" />
      <path d={curva(60, 34, FUNDO) + curva(60, 0, FUNDO)} {...borda} {...realce("interno")} />
    </>
  ),
  renderCorte: ({ t, desenho, ids, borda, realce }) => {
    const campo = t === 0 ? "altura" : "secao";
    return (
      <>
        <path d={faceCorte(desenho.extras.corpoElastomero, t)} {...borda} fill="#d4b593" />
        <path
          d={faceCorte(desenho.extras.carcacaMetalica, t)}
          fill={`url(#${ids.metalFace})`}
          stroke="#334155"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
        <path d={faceCorte(desenho.perfil, t)} fill="none" stroke="transparent" {...realce(campo)} />
      </>
    );
  },
};

const RETENTOR = {
  chave: "Retentor",
  ariaLabel: "Retentor em 3D cortado ao meio, com carcaça em L, lábio e mola",
  ri: 60,
  re: 80,
  h: 30,
  cotas: ["interno", "externo", "secao", "altura"],
  perfil: [
    [61, 0], [80, 0], [80, 30], [77, 30], [77, 3], [76.5, 3], [76.5, 29],
    [74.5, 29], [74.5, 16], [71, 13], [67, 15], [65.5, 26], [62.5, 27],
    [60, 18], [62.5, 9], [61, 4],
  ],
  extras: {
    carcacaMetalica: [[65, 0], [80, 0], [80, 30], [77, 30], [77, 3], [65, 3]],
    corpoElastomero: [
      [61, 0], [65, 0], [65, 3], [77, 3], [77, 29], [74.5, 29], [74.5, 16],
      [71, 13], [67, 15], [65.5, 26], [62.5, 27], [60, 18], [62.5, 9], [61, 4],
    ],
    mola: { r: 70.5, z: 21.5, raio: 3.2 },
  },
  renderFundo: ({ ids, borda, realce }) => (
    <>
      <path d={faixa(80, 30, 77, 30)} fill={`url(#${ids.metalTopo})`} />
      <path d={faixas([[77, 29], [74.5, 29], [74.5, 16], [71, 13]])} fill="#9c8165" />
      <path d={faixas([[67.3, 21.5], [70.5, 24.7], [73.7, 21.5]])} fill="#1d1d21" />
      <path d={faixa(68.2, 23.2, 71.8, 24.4)} fill="#71717a" />
      <path d={faixa(65.5, 26, 62.5, 27)} fill="#f7e9da" />
      <path d={faixa(62.5, 27, 60, 18)} fill="#c4a688" />
      <path d={faixas([[60, 18], [62.5, 9], [61, 4], [61, 0]])} fill={`url(#${ids.furo})`} />

      <path d={curva(80, 30, FUNDO)} {...borda} stroke="#334155" {...realce("externo")} />
      <path d={curva(77, 30, FUNDO) + curva(74.5, 29, FUNDO)} {...borda} strokeWidth="0.6" />
      <path d={curva(62.5, 27, FUNDO)} {...borda} strokeWidth="0.6" />
      <path d={curva(60, 18, FUNDO) + curva(61, 0, FUNDO)} {...borda} {...realce("interno")} />
    </>
  ),
  renderCorte: ({ t, desenho, ids, borda, realce }) => {
    const campo = t === 0 ? "altura" : "secao";
    const { mola } = desenho.extras;
    const [mx, my] = xy(mola.r, mola.z, t);
    return (
      <>
        <path d={faceCorte(desenho.extras.corpoElastomero, t)} {...borda} fill="#d4b593" />
        <path
          d={faceCorte(desenho.extras.carcacaMetalica, t)}
          fill={`url(#${ids.metalFace})`}
          stroke="#334155"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
        <circle cx={mx} cy={my} r={mola.raio} fill="#1d1d21" stroke="#0b0b0d" strokeWidth="0.6" />
        <circle cx={mx - 1} cy={my - 1} r="1" fill="#ffffff55" />
        <path d={faceCorte(desenho.perfil, t)} fill="none" stroke="transparent" {...realce(campo)} />
      </>
    );
  },
};

const CONJUNTO = {
  chave: "Conjunto",
  ariaLabel: "Conjunto de vedação em 3D cortado ao meio, com anel central, anéis guia azuis e o-ring",
  ri: 60,
  re: 80,
  h: 34,
  cotas: ["interno", "externo", "secao", "altura"],
  perfil: [[60, 0], [76, 0], [76, 7.5], [80, 7.5], [80, 26.5], [76, 26.5], [76, 34], [60, 34]],
  extras: {
    guiaInferior: [[60, 0], [76, 0], [76, 7.5], [60, 7.5]],
    guiaSuperior: [[60, 26.5], [76, 26.5], [76, 34], [60, 34]],
    anelCentral: [
      [68.5, 7.5], [80, 7.5], [80, 14], [78.5, 15], [78.5, 19],
      [80, 20], [80, 26.5], [68.5, 26.5], [68.5, 21], [67, 17], [68.5, 13],
    ],
    oring: { r: 64.2, z: 17, raio: 4.2 },
  },
  renderFundo: ({ ids, borda, realce }) => (
    <>
      <path d={faixa(80, 26.5, 76, 26.5)} fill="#3f3f46" />
      <path d={faixa(76, 34, 60, 34)} fill="#60a5fa" />
      <path d={faixa(60, 34, 60, 26.5)} fill={`url(#${ids.azulFuro})`} />
      <path d={faixa(60, 26.5, 64, 21.5)} fill="#18181b" />
      <path d={faixas([[61, 21.2], [60, 17], [61, 12.8]])} fill="#232327" />
      <path d={faixa(60, 18.5, 60, 15.8)} fill="#52525b" />
      <path d={faixa(60, 7.5, 60, 0)} fill={`url(#${ids.azulFuro})`} />

      <path d={curva(80, 26.5, FUNDO)} {...borda} stroke="#09090b" {...realce("externo")} />
      <path d={curva(76, 34, FUNDO)} {...borda} stroke="#1e3a8a" strokeWidth="0.7" />
      <path
        d={curva(60, 34, FUNDO) + curva(60, 0, FUNDO)}
        {...borda}
        stroke="#1e3a8a"
        {...realce("interno")}
      />
    </>
  ),
  renderCorte: ({ t, desenho, borda, realce }) => {
    const campo = t === 0 ? "altura" : "secao";
    const { guiaInferior, guiaSuperior, anelCentral, oring } = desenho.extras;
    const [ox, oy] = xy(oring.r, oring.z, t);
    return (
      <>
        <path d={faceCorte(anelCentral, t)} {...borda} stroke="#09090b" fill="#27272a" />
        <path d={faceCorte(guiaInferior, t)} {...borda} stroke="#1e3a8a" fill="#2563eb" />
        <path d={faceCorte(guiaSuperior, t)} {...borda} stroke="#1e3a8a" fill="#2563eb" />
        <circle cx={ox} cy={oy} r={oring.raio} fill="#141418" stroke="#09090b" strokeWidth="0.6" />
        <circle cx={ox - 1.2} cy={oy - 1.2} r="1.1" fill="#ffffff40" />
        <path d={faceCorte(desenho.perfil, t)} fill="none" stroke="transparent" {...realce(campo)} />
      </>
    );
  },
};

const BUFFER_SEAL = {
  chave: "Buffer seal",
  ariaLabel: "Buffer seal em 3D cortado ao meio, com anel retangular claro e o-ring escuro atrás",
  ri: 58,
  re: 82,
  h: 16,
  cotas: ["interno", "externo", "secao", "altura"],
  perfil: [[58, 0], [66, 0], [66, 16], [58, 16]],
  extras: {
    anelBege: [[58, 0], [66, 0], [66, 16], [58, 16]],
    oring: { r: 74, z: 8, raio: 8 },
  },
  renderFundo: ({ ids, borda, realce }) => (
    <>
      {/* O-ring escuro visível como volume atrás do anel bege */}
      <path d={arcoToro(74, 8, 8, 1.17, 2.35, 7)} fill="#1d1d22" />
      <path d={arcoToro(74, 8, 8, 1.38, 1.98, 5)} fill="#52525b" />
      {/* Anel retangular claro na frente */}
      <path d={faixa(66, 16, 58, 16)} fill="#f6ebdd" />
      <path d={faixa(58, 16, 58, 0)} fill={`url(#${ids.furo})`} />

      <path d={curva(77.1, 15.37, FUNDO)} {...borda} stroke="#52525b" {...realce("externo")} />
      <path d={curva(66, 16, FUNDO)} {...borda} strokeWidth="0.6" />
      <path d={curva(58, 16, FUNDO) + curva(58, 0, FUNDO)} {...borda} {...realce("interno")} />
    </>
  ),
  renderCorte: ({ t, desenho, borda, realce }) => {
    const campo = t === 0 ? "altura" : "secao";
    const { anelBege, oring } = desenho.extras;
    const [ox, oy] = xy(oring.r, oring.z, t);
    return (
      <>
        <path d={faceCorte(anelBege, t)} {...borda} fill="#e9d5bd" {...realce(campo)} />
        <circle
          cx={ox}
          cy={oy}
          r={oring.raio}
          fill="#1d1d22"
          stroke="#52525b"
          strokeWidth="0.9"
          {...realce(campo)}
        />
        <circle cx={ox - 2} cy={oy - 2} r="2" fill="#ffffff40" />
      </>
    );
  },
};

const ANEL = {
  chave: "Anel",
  ariaLabel: "Anel guia em 3D cortado ao meio, com corte em bisel e cotas das medidas",
  ri: 60,
  re: 80,
  h: 22,
  cotas: ["interno", "externo", "secao", "altura"],
  perfil: [[60, 0], [80, 0], [80, 22], [60, 22]],
  extras: { bisel: true },
  renderFundo: ({ ids, borda, realce }) => (
    <>
      <path d={ANEL_BISEL.topoEsq} fill="#f1dfcb" />
      <path d={ANEL_BISEL.furoEsq} fill={`url(#${ids.furo})`} />
      <path d={ANEL_BISEL.faceBiselDir} fill="#b89876" {...borda} />
      <path d={ANEL_BISEL.topoDir} fill="#f1dfcb" />
      <path d={ANEL_BISEL.furoDir} fill={`url(#${ids.furo})`} />

      <path d={ANEL_BISEL.linhasBisel} {...borda} strokeWidth="0.85" />
      <path d={ANEL_BISEL.bordaExt} {...borda} {...realce("externo")} />
      <path d={ANEL_BISEL.bordaInt} {...borda} {...realce("interno")} />
    </>
  ),
};

const ARRUELA = {
  chave: "Arruela",
  ariaLabel: "Arruela em 3D cortada ao meio, com as cotas das medidas",
  ri: 56,
  re: 84,
  h: 8,
  cotas: ["interno", "externo", "secao", "altura"],
  perfil: [[56, 0], [84, 0], [84, 8], [56, 8]],
  extras: {},
  renderFundo: ({ ids, borda, realce }) => (
    <>
      <path d={faixa(84, 8, 56, 8)} fill="#f1dfcb" />
      <path d={faixa(56, 8, 56, 0)} fill={`url(#${ids.furo})`} />

      <path d={curva(84, 8, FUNDO)} {...borda} {...realce("externo")} />
      <path d={curva(56, 8, FUNDO) + curva(56, 0, FUNDO)} {...borda} {...realce("interno")} />
    </>
  ),
};

const ORING = {
  chave: "O-ring",
  ariaLabel: "O-ring em 3D cortado ao meio, com as cotas de diâmetros e espessura do cordão",
  ri: 58,
  re: 82,
  h: 24,
  cotas: ["interno", "externo", "secao"],
  perfil: [],
  extras: { rMed: 70, zCentro: 12, raioCorda: 12 },
  renderFundo: ({ ids, borda, realce }) => (
    <>
      <path d={arcoToro(70, 12, 12, 0.38, 1.05, 5)} fill="#f7e9da" />
      <path d={arcoToro(70, 12, 12, 1.05, 1.85, 5)} fill="#f1dfcb" />
      <path d={arcoToro(70, 12, 12, 1.85, 2.65, 5)} fill="#dcbda0" />
      <path d={arcoToro(70, 12, 12, 2.65, 3.65, 6)} fill={`url(#${ids.furo})`} />
      <path d={arcoToro(70, 12, 12, 3.65, 4.3, 5)} fill="#7c634b" />

      <path
        d={curva(70 + 12 * Math.cos(0.38), 12 + 12 * Math.sin(0.38), FUNDO)}
        {...borda}
        {...realce("externo")}
      />
      <path d={curva(58, 12, FUNDO)} fill="none" stroke="transparent" {...realce("interno")} />
      <path
        d={curva(70 + 12 * Math.cos(4.3), 12 + 12 * Math.sin(4.3), FUNDO)}
        {...borda}
        strokeWidth="0.7"
      />
    </>
  ),
  renderCorte: ({ t, desenho, borda, realce }) => {
    const { rMed, zCentro, raioCorda } = desenho.extras;
    const [cx, cy] = xy(rMed, zCentro, t);
    const campo = t === Math.PI ? "secao" : null;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={raioCorda}
        {...borda}
        fill="#d4b593"
        {...(campo ? realce(campo) : {})}
      />
    );
  },
};

const VRING = {
  chave: "V-Ring",
  ariaLabel: "V-Ring em 3D cortado ao meio, com perfil em V e lábio em ângulo",
  ri: 60,
  re: 80,
  h: 34,
  cotaExtTopo: BASE_Y - 29,
  cotas: ["interno", "externo", "secao", "altura"],
  perfil: [
    [60, 0], [72, 0], [71, 11], [80, 31], [77.5, 34],
    [69, 20], [66, 20], [65, 25], [60, 25],
  ],
  extras: {},
  renderFundo: ({ ids, borda, realce }) => (
    <>
      <path d={faixa(80, 31, 77.5, 34)} fill="#f1dfcb" />
      <path d={faixas([[77.5, 34], [69, 20], [66, 20]])} fill="#9c8165" />
      <path d={faixas([[66, 20], [65, 25], [60, 25]])} fill="#f7e9da" />
      <path d={faixa(60, 25, 60, 0)} fill={`url(#${ids.furo})`} />

      <path d={curva(80, 31, FUNDO)} {...borda} {...realce("externo")} />
      <path d={curva(77.5, 34, FUNDO) + curva(65, 25, FUNDO)} {...borda} strokeWidth="0.6" />
      <path d={curva(60, 25, FUNDO) + curva(60, 0, FUNDO)} {...borda} {...realce("interno")} />
    </>
  ),
};

/** Tabela indexada pelos nomes de Tipo de src/config/taxonomia.js. */
const DESENHOS = {
  Gaxeta: GAXETA,
  Raspador: RASPADOR,
  "Raspador metálico": RASPADOR_METALICO,
  Retentor: RETENTOR,
  Conjunto: CONJUNTO,
  "Buffer seal": BUFFER_SEAL,
  Anel: ANEL,
  Arruela: ARRUELA,
  "O-ring": ORING,
  "V-Ring": VRING,
  "Fita guia": GAXETA,
  "Reparo pneumático": GAXETA,
  Ferramenta: GAXETA,
  Outros: GAXETA,
};

/**
 * Desenho técnico 3D em corte conforme o Tipo de peça selecionado no funil.
 * A cota do campo em foco (e a parte correspondente da peça) acende em vermelho.
 */
export default function DesenhoPeca({ tipo = null, foco }) {
  const uid = useId();
  const ids = {
    furo: `${uid}-furo`,
    metalTopo: `${uid}-metal-topo`,
    metalFace: `${uid}-metal-face`,
    azulFuro: `${uid}-azul-furo`,
    seta: `${uid}-seta`,
    setaRed: `${uid}-seta-red`,
  };

  const desenho = (tipo && DESENHOS[tipo]) || DESENHOS.Gaxeta;
  const VERMELHO = "var(--color-accent-red, #d32f2f)";
  const ativo = (campo) => foco === campo;
  const temCota = (campo) => desenho.cotas.includes(campo);

  const cotaProps = (campo) => ({
    className: `${ativo(campo) ? "text-accent-red" : "text-white/70"} transition-colors duration-200`,
    stroke: "currentColor",
    strokeWidth: ativo(campo) ? 2.25 : 1.25,
    fill: "currentColor",
  });
  const marca = (campo) => {
    const id = ativo(campo) ? ids.setaRed : ids.seta;
    return { markerStart: `url(#${id})`, markerEnd: `url(#${id})` };
  };
  const texto = {
    style: { stroke: "#0b0b0d", strokeWidth: 2.5, paintOrder: "stroke" },
    className: "font-mono",
    fontSize: 12,
    textAnchor: "middle",
  };
  const borda = { fill: "none", stroke: "#3d2f22", strokeWidth: 0.9, strokeLinejoin: "round" };
  const realce = (campo) => (ativo(campo) ? { stroke: VERMELHO, strokeWidth: 2.25 } : {});

  const [xIntE] = xy(desenho.ri, 0, Math.PI);
  const [xIntD] = xy(desenho.ri, 0, 0);
  const [xExtE] = xy(desenho.re, 0, Math.PI);
  const [xExtD] = xy(desenho.re, 0, 0);
  const yBase = BASE_Y;
  const yTopo = BASE_Y - desenho.h;
  const yExtLinha = desenho.cotaExtTopo ?? yBase + 2;

  const renderCortePadrao = (t) => {
    const campo = t === 0 ? "altura" : "secao";
    const oring = desenho.extras.oring;
    const [ox, oy] = oring ? xy(oring.r, oring.z, t) : [0, 0];
    return (
      <>
        <path d={faceCorte(desenho.perfil, t)} {...borda} fill="#d4b593" {...realce(campo)} />
        {oring && (
          <>
            <circle cx={ox} cy={oy} r={oring.raio} fill="#1d1d21" stroke="#0b0b0d" strokeWidth="0.6" />
            <circle cx={ox - 1.2} cy={oy - 1.2} r="1.1" fill="#ffffff40" />
          </>
        )}
      </>
    );
  };

  return (
    <svg
      viewBox="0 0 260 138"
      className="w-full h-auto transition-opacity duration-300"
      role="img"
      aria-label={desenho.ariaLabel}
    >
      <defs>
        <linearGradient id={ids.furo} x1="0" x2="1">
          <stop offset="0" stopColor="#6e5843" />
          <stop offset="0.5" stopColor="var(--color-accent-gold, #e4c7aa)" />
          <stop offset="1" stopColor="#6e5843" />
        </linearGradient>
        <linearGradient id={ids.metalTopo} x1="0" x2="1">
          <stop offset="0" stopColor="#64748b" />
          <stop offset="0.5" stopColor="#e2e8f0" />
          <stop offset="1" stopColor="#64748b" />
        </linearGradient>
        <linearGradient id={ids.metalFace} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#cbd5e1" />
          <stop offset="0.55" stopColor="#94a3b8" />
          <stop offset="1" stopColor="#475569" />
        </linearGradient>
        <linearGradient id={ids.azulFuro} x1="0" x2="1">
          <stop offset="0" stopColor="#1e3a8a" />
          <stop offset="0.5" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#1e3a8a" />
        </linearGradient>
        {[
          [ids.seta, "#ffffffb3"],
          [ids.setaRed, VERMELHO],
        ].map(([id, cor]) => (
          <marker
            key={id}
            id={id}
            viewBox="0 0 6 6"
            refX="3"
            refY="3"
            markerWidth="7"
            markerHeight="7"
            markerUnits="userSpaceOnUse"
            orient="auto-start-reverse"
          >
            <path d="M0 3 L6 0 L6 6 Z" fill={cor} stroke="none" />
          </marker>
        ))}
      </defs>

      <g key={desenho.chave} className="animate-fade-in">
        {/* metade de trás, do mais distante (externo) ao mais próximo (furo) */}
        {desenho.renderFundo({ ids, borda, realce })}

        {/* faces do corte */}
        {[Math.PI, 0].map((t) => (
          <g key={t}>
            {desenho.renderCorte
              ? desenho.renderCorte({ t, desenho, ids, borda, realce })
              : renderCortePadrao(t)}
          </g>
        ))}

        {/* Ø interno: entre as faces internas, no vão do corte */}
        {temCota("interno") && (
          <g {...cotaProps("interno")}>
            <line x1={xIntE} y1={yBase - 12} x2={xIntD} y2={yBase - 12} {...marca("interno")} />
            <text x={CX} y={yBase - 17} {...texto}>
              Ø int
            </text>
          </g>
        )}

        {/* Ø externo: de ponta a ponta, embaixo */}
        {temCota("externo") && (
          <g {...cotaProps("externo")}>
            <line x1={xExtE} y1={yExtLinha} x2={xExtE} y2={yBase + 18} strokeWidth="0.75" strokeDasharray="2 2" />
            <line x1={xExtD} y1={yExtLinha} x2={xExtD} y2={yBase + 18} strokeWidth="0.75" strokeDasharray="2 2" />
            <line x1={xExtE} y1={yBase + 14} x2={xExtD} y2={yBase + 14} {...marca("externo")} />
            <text x={CX} y={yBase + 29} {...texto}>
              Ø ext
            </text>
          </g>
        )}

        {/* seção: espessura da parede, (Ø ext − Ø int) / 2, na face da esquerda */}
        {temCota("secao") && (
          <g {...cotaProps("secao")}>
            <line x1={xExtE} y1={yTopo - 3} x2={xExtE} y2={yTopo - 16} strokeWidth="0.75" strokeDasharray="2 2" />
            <line x1={xIntE} y1={yTopo - 3} x2={xIntE} y2={yTopo - 16} strokeWidth="0.75" strokeDasharray="2 2" />
            <line x1={xExtE} y1={yTopo - 12} x2={xIntE} y2={yTopo - 12} {...marca("secao")} />
            <text x={(xExtE + xIntE) / 2} y={yTopo - 18} {...texto}>
              seção
            </text>
          </g>
        )}

        {/* altura: no sentido do eixo, na face da direita */}
        {temCota("altura") && (
          <g {...cotaProps("altura")}>
            <line x1={xExtD + 3} y1={yTopo} x2={xExtD + 20} y2={yTopo} strokeWidth="0.75" strokeDasharray="2 2" />
            <line x1={xExtD + 3} y1={yBase} x2={xExtD + 20} y2={yBase} strokeWidth="0.75" strokeDasharray="2 2" />
            <line x1={xExtD + 16} y1={yTopo} x2={xExtD + 16} y2={yBase} {...marca("altura")} />
            <text
              x={xExtD + 30}
              y={(yTopo + yBase) / 2}
              transform={`rotate(-90 ${xExtD + 30} ${(yTopo + yBase) / 2})`}
              {...texto}
            >
              alt.
            </text>
          </g>
        )}
      </g>
    </svg>
  );
}
