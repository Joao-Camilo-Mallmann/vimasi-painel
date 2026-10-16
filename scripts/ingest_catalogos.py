"""Ingestão do catálogo APC (gaxetas e raspadores) + cruzamento com a lista AGEL 2026.

Uso (rodar da raiz do projeto):
    python -I scripts/ingest_catalogos.py [--precos docs/catalogos/precos/agel-lista-precos-2026-01.pdf]

Saídas:
    src/data/catalogo_apc.csv       dataset facetado (mm, 4 casas)
    docs/catalogos/divergencias.md  relatório de divergências / cruzamentos

Regras:
- Fonte da verdade para peças em polegada = código da REFERÊNCIA (pol × 25,4, exato,
  milésimos arredondados para 1/64").
- Preços da lista 2026 NUNCA são gravados: só código e descrição são cruzados.
"""

import argparse
import csv
import io
import re
import sys
from fractions import Fraction
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
CATALOGO_PDF = ROOT / "docs/catalogos/apc-completo/apc-gaxetas-raspadores-ref-02-2019.pdf"
PRECOS_PDF = ROOT / "docs/catalogos/precos/agel-lista-precos-2026-01.pdf"
OUT_CSV = ROOT / "src/data/catalogo_apc.csv"
OUT_REPORT = ROOT / "docs/catalogos/divergencias.md"
LEGACY_DIR = ROOT / "src/data"

TOL_DIVERGENCIA = 0.05  # mm

# ---------------------------------------------------------------------------
# Manifesto (transcrito do índice do catálogo, páginas PDF 9-13)
# ficha = (pressao_psi | None, temp_min, temp_max, velocidade_m_s)
# ---------------------------------------------------------------------------
PU_HID = (-30, 100)
PM_TEMP = (-45, 135)

HASTE, EMBOLO = "haste", "embolo"

# (linha, modelo) -> aplicações
APLICACOES = {
    # gaxetas hidráulicas — haste
    **{("gaxeta", m): [HASTE] for m in [
        "B", "AG 1", "AG 2", "AG 4 (BS)", "AG 5", "AG 7", "AG 11", "AG 12", "AG 13",
        "AG 14", "AG 16", "AG 17", "AG 19", "AG 20", "AG 21", "AG 22", "AG 23"]},
    # gaxetas hidráulicas — êmbolo
    **{("gaxeta", m): [EMBOLO] for m in [
        "AG 3", "AG 6", "AG 8", "AG 10", "AG 15", "AG 18", "AG 24", "STD"]},
    # raspadores trabalham sempre na haste
    **{("raspador", m): [HASTE] for m in [
        "D", "6D/66D", "900D", "K", "RP-25", "DG", "E", "GA", "GAE", "GAG",
        "AGK1", "GA1", "AGK2", "RP-28"]},
    # linha pneumática ("Aplicação Pneumática de Haste / Êmbolo")
    ("pneumatica", "AG 3"): [HASTE, EMBOLO],
    ("pneumatica", "AG 6"): [HASTE, EMBOLO],
    ("pneumatica", "AG 7"): [HASTE, EMBOLO],
    ("pneumatica", "AG 24"): [HASTE, EMBOLO],
    ("pneumatica", "AG 25"): [EMBOLO],      # guarnição composta de êmbolo
    ("pneumatica", "KDG"): [HASTE, EMBOLO],
    ("pneumatica", "RP-08"): [],            # guarnição de amortecimento
    ("pneumatica", "RP-25"): [HASTE],       # raspador série compacta
    ("pneumatica", "Z"): [EMBOLO],          # guarnição de êmbolo
}

# (linha, modelo, polymax) -> ficha
FICHA = {
    # gaxetas haste PU
    ("gaxeta", "B", False): (4000, *PU_HID, 0.5),
    ("gaxeta", "AG 1", False): (6000, *PU_HID, 1),
    ("gaxeta", "AG 2", False): (6000, *PU_HID, 0.5),
    ("gaxeta", "AG 4 (BS)", False): (6000, *PU_HID, 0.5),
    ("gaxeta", "AG 5", False): (6000, *PU_HID, 0.5),
    ("gaxeta", "AG 7", False): (4000, *PU_HID, 0.5),
    ("gaxeta", "AG 11", False): (7000, *PU_HID, 0.5),
    ("gaxeta", "AG 12", False): (7000, *PU_HID, 0.5),
    ("gaxeta", "AG 13", False): (7000, *PU_HID, 0.5),
    ("gaxeta", "AG 14", False): (7000, *PU_HID, 0.5),
    ("gaxeta", "AG 16", False): (6000, *PU_HID, 1),
    ("gaxeta", "AG 17", False): (7000, *PU_HID, 1),
    ("gaxeta", "AG 19", False): (6000, *PU_HID, 0.5),
    ("gaxeta", "AG 20", False): (7000, *PU_HID, 1),
    ("gaxeta", "AG 21", False): (3000, *PU_HID, 1),
    ("gaxeta", "AG 22", False): (7000, *PU_HID, 1),
    # gaxetas êmbolo PU
    ("gaxeta", "AG 3", False): (5000, *PU_HID, 0.5),
    ("gaxeta", "AG 6", False): (5000, *PU_HID, 0.5),
    ("gaxeta", "AG 8", False): (7000, *PU_HID, 1),
    ("gaxeta", "AG 10", False): (7000, *PU_HID, 1),
    ("gaxeta", "AG 15", False): (7000, *PU_HID, 1),
    ("gaxeta", "AG 18", False): (7000, *PU_HID, 1),
    ("gaxeta", "AG 24", False): (5000, *PU_HID, 0.5),
    ("gaxeta", "STD", False): (5000, *PU_HID, 0.5),
    # gaxetas Polymax
    ("gaxeta", "B", True): (8000, *PM_TEMP, 0.5),
    ("gaxeta", "AG 1", True): (6000, *PM_TEMP, 1),
    ("gaxeta", "AG 2", True): (6000, *PM_TEMP, 0.5),
    ("gaxeta", "AG 4 (BS)", True): (7000, *PM_TEMP, 0.5),
    ("gaxeta", "AG 5", True): (6000, *PM_TEMP, 0.5),
    ("gaxeta", "AG 7", True): (4000, *PM_TEMP, 0.5),
    ("gaxeta", "AG 13", True): (7000, *PM_TEMP, 0.5),
    ("gaxeta", "AG 14", True): (7000, *PM_TEMP, 0.5),
    ("gaxeta", "AG 16", True): (6000, *PM_TEMP, 1),
    ("gaxeta", "AG 23", True): (7000, *PM_TEMP, 1),
    ("gaxeta", "STD", True): (7000, *PM_TEMP, 0.5),
    # raspadores
    **{("raspador", m, False): (None, *PU_HID, 4) for m in ["D", "6D/66D", "900D", "K", "RP-25", "DG", "E"]},
    **{("raspador", m, False): (None, *PU_HID, 1) for m in ["GA", "GAE", "GAG", "AGK1", "GA1", "AGK2"]},
    ("raspador", "D", True): (None, *PM_TEMP, 4),
    ("raspador", "RP-25", True): (None, *PU_HID, 4),
    ("raspador", "RP-28", True): (None, *PU_HID, 4),
    # pneumática
    ("pneumatica", "AG 3", False): (8000, *PM_TEMP, 0.5),
    ("pneumatica", "AG 6", False): (6000, *PM_TEMP, 1),
    ("pneumatica", "AG 7", False): (6000, *PM_TEMP, 0.5),
    ("pneumatica", "AG 24", False): (7000, *PM_TEMP, 0.5),
    ("pneumatica", "AG 25", False): (6000, *PM_TEMP, 0.5),
    ("pneumatica", "KDG", False): (4000, *PM_TEMP, 0.5),
    ("pneumatica", "RP-08", False): (7000, *PM_TEMP, 0.5),
    ("pneumatica", "RP-25", False): (7000, *PM_TEMP, 0.5),
    ("pneumatica", "Z", False): (7000, *PM_TEMP, 0.5),
}

TIPO_POR_LINHA = {"gaxeta": "Gaxeta", "raspador": "Raspador", "pneumatica": "Gaxeta"}
LINHA_LABEL = {"gaxeta": "Hidráulica", "raspador": "Hidráulica", "pneumatica": "Pneumática"}


def linha_da_pagina(pagina):
    if pagina <= 46:
        return "gaxeta"
    if pagina <= 62:
        return "raspador"
    return "pneumatica"


def tipo_do_modelo(linha, modelo):
    # Na linha pneumática há raspador (RP-25) e guarnições
    if linha == "pneumatica" and modelo == "RP-25":
        return "Raspador"
    return TIPO_POR_LINHA[linha]


# Padrão de código esperado por modelo
CODE_PATTERN = {"STD": "std8", "B": "b11", "AG 4 (BS)": "b11", "D": "d4"}

DATA_PAGES = [p for p in range(15, 67) if p != 47]  # 47 = tolerâncias de usinagem
REPARO_PAGES = [67, 68]

# ---------------------------------------------------------------------------
# Conversões
# ---------------------------------------------------------------------------
MM_POR_POL = Fraction(254, 10)


def snap64(pol):
    """Arredonda polegadas para o 1/64 mais próximo (Fraction)."""
    return Fraction(round(Fraction(pol) * 64), 64)


def milesimos_para_mm(txt):
    """Milésimos de polegada -> mm. Códigos truncados (187 = 3/16) são arredondados para 1/64";
    valores que não estão perto de uma fração (ex.: 788 = 20 mm) são convertidos direto."""
    pol = Fraction(int(txt), 1000)
    alvo = snap64(pol)
    if abs(pol - alvo) * 64 <= Fraction(2, 10):
        pol = alvo
    return float(pol * MM_POR_POL)


FRAC_RE = re.compile(r"^(?:(\d+)[\s.](\d+)/(\d+)|(\d+)/(\d+)|(\d+))$")


def parse_pol(txt):
    """'1 13/16', '1.1/2', '3/16', '2' -> mm (float) ou None."""
    t = txt.strip().replace('"', "")
    m = FRAC_RE.match(t)
    if not m:
        return None
    if m.group(1):
        v = Fraction(int(m.group(1))) + Fraction(int(m.group(2)), int(m.group(3)))
    elif m.group(4):
        v = Fraction(int(m.group(4)), int(m.group(5)))
    else:
        v = Fraction(int(m.group(6)))
    return float(v * MM_POR_POL)


def parse_mm(txt):
    t = txt.strip().replace(" ", "")
    if not re.match(r"^\d+([.,]\d+)?$", t):
        return None
    return float(t.replace(",", "."))


def parse_valor(txt, unidade):
    """Valor impresso: vírgula/ponto decimal = mm; fração/inteiro em tabela pol = pol."""
    t = txt.strip()
    if not t or t in {"---", "—", "-"}:
        return None
    if "," in t:
        return parse_mm(t)
    if "/" in t:
        return parse_pol(t)
    if unidade == "pol":
        return parse_pol(t)
    return parse_mm(t)


def decode_ref(ref, pattern):
    """Retorna dict com Interno/Externo/Altura (mm) decodificados do código, ou None."""
    if not ref or not pattern:
        return None
    r = re.sub(r"(BS)?(PM)?$", "", ref.replace(" ", ""))
    if pattern == "std8":
        m = re.fullmatch(r"(\d{3})(\d{5})", r)
        if m:
            s, i = milesimos_para_mm(m.group(1)), milesimos_para_mm(m.group(2))
            return {"Interno": i, "Externo": i + 2 * s, "Altura": s}
    elif pattern == "b11":
        m = re.fullmatch(r"(\d{3})(\d{5})(\d{3})", r)
        if m:
            s, i, h = (milesimos_para_mm(g) for g in m.groups())
            return {"Interno": i, "Externo": i + 2 * s, "Altura": h}
    elif pattern == "d4":
        m = re.fullmatch(r"D-(\d{4})", r)
        if m:
            return {"Interno": milesimos_para_mm(m.group(1))}
    return None


# ---------------------------------------------------------------------------
# Extração por coordenadas
# ---------------------------------------------------------------------------
def agrupar_linhas(words, tol=2.5):
    linhas = []
    for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
        for ln in linhas:
            if abs(ln["top"] - w["top"]) <= tol:
                ln["words"].append(w)
                break
        else:
            linhas.append({"top": w["top"], "words": [w]})
    for ln in linhas:
        ln["words"].sort(key=lambda w: w["x0"])
        ln["text"] = " ".join(w["text"] for w in ln["words"])
    return sorted(linhas, key=lambda l: l["top"])


def normalizar_modelo(titulo):
    t = titulo.upper().strip()
    t = re.sub(r"^TIPO\s+", "", t)
    if re.match(r"^AG\s*-?\s*\d", t):
        resto = re.sub(r"^AG\s*-?\s*", "", t)
        return "AG " + resto.strip()
    return t.replace(" ", "")


HEADER_COLS = [
    ("agel", lambda s: s == "AGEL"),
    ("ref", lambda s: s.startswith("REFER")),
    ("material", lambda s: s == "MATERIAL"),
    ("int", lambda s: s == "INT."),
    ("ext", lambda s: s.endswith("EXT.")),
    ("h", lambda s: s in {"H", "h"}),
    ("d1", lambda s: s.endswith("D1")),
    ("l1", lambda s: s == "L1"),
    ("l2", lambda s: s == "L2"),
    ("r", lambda s: s == "R"),
    ("f", lambda s: s == "f"),
    ("g", lambda s: s == "G"),
]


def colunas_do_header(ln, x_min, x_max):
    cols = []
    for w in ln["words"]:
        if not (x_min <= w["x0"] < x_max):
            continue
        for nome, test in HEADER_COLS:
            if test(w["text"]):
                cols.append((nome, (w["x0"] + w["x1"]) / 2))
                break
    cols.sort(key=lambda c: c[1])
    return cols


def atribuir(words, cols):
    """Atribui palavras à coluna cujo centro está mais próximo."""
    out = {}
    for w in words:
        cx = (w["x0"] + w["x1"]) / 2
        nome = min(cols, key=lambda c: abs(c[1] - cx))[0]
        out.setdefault(nome, []).append(w["text"])
    return out


def juntar_agel(partes):
    return "".join(partes) if partes else ""


def juntar_ref(partes):
    s = " ".join(partes)
    s = re.sub(r"\s+(PM|BS)$", r"\1", s)
    return s.strip()


def extrair_catalogo(pdf_path, problemas):
    rows = []
    with pdfplumber.open(pdf_path) as pdf:
        for pagina in DATA_PAGES:
            page = pdf.pages[pagina - 1]
            words = page.extract_words(extra_attrs=["size"])
            linhas = agrupar_linhas(words)
            meio = page.width / 2
            titulos = [l for l in linhas if any(w["size"] >= 18 for w in l["words"]) and l["top"] < 780]
            subtitulos = [l for l in linhas if any(11.5 <= w["size"] < 18 for w in l["words"])]
            medidas = [l for l in linhas if l["words"][0]["text"] == "Medidas"]
            headers = [l for l in linhas if any(w["text"] == "AGEL" for w in l["words"])]
            fronteiras = sorted({l["top"] for l in titulos + medidas + headers} | {790.0})

            linha_cat = linha_da_pagina(pagina)
            for hdr in headers:
                # Pode haver títulos lado a lado (ex.: pág. 65: AG 25 à esquerda, KDG embaixo)
                tit = max((t for t in titulos if t["top"] < hdr["top"]), key=lambda t: t["top"], default=None)
                if tit is None:
                    problemas["nao_extraidas"].append((pagina, "cabeçalho sem título", hdr["text"]))
                    continue
                modelo = normalizar_modelo(" ".join(w["text"] for w in tit["words"] if w["size"] >= 18))
                subs = " ".join(l["text"] for l in subtitulos if tit["top"] < l["top"] < hdr["top"]).upper()
                polymax_regiao = "POLYMAX" in subs or pagina in range(37, 47) or pagina in (61, 62)
                med = max((m for m in medidas if m["top"] < hdr["top"]), key=lambda m: m["top"], default=None)
                unidade_tab = "pol" if med and "Polegadas" in med["text"] and "Milim" not in med["text"] else "mm"
                if med and "Polegadas/Milim" in med["text"]:
                    unidade_tab = "misto"
                fim = min(f for f in fronteiras if f > hdr["top"] + 1)
                # o cabeçalho pode quebrar em duas linhas (ex.: "H" um pouco abaixo)
                hdr_words = [w for w in words if hdr["top"] - 3 <= w["top"] <= hdr["top"] + 12 and w["size"] < 9]
                hdr_full = {"words": sorted(hdr_words, key=lambda w: w["x0"])}
                corpo_ini = max(w["bottom"] for w in hdr_words)

                n_agel = sum(1 for w in hdr_full["words"] if w["text"] == "AGEL")
                halves = [(0, meio), (meio, page.width)] if n_agel > 1 else [(0, page.width)]
                for x_min, x_max in halves:
                    cols = colunas_do_header(hdr_full, x_min, x_max)
                    if not any(c[0] == "agel" for c in cols):
                        continue
                    corpo = [w for w in words if corpo_ini < w["top"] < fim - 1 and x_min <= w["x0"] < x_max]
                    for ln in agrupar_linhas(corpo):
                        cel = atribuir(ln["words"], cols)
                        agel = juntar_agel(cel.get("agel", []))
                        ref = juntar_ref(cel.get("ref", []))
                        if ref in {"---", "—"}:
                            ref = ""
                        if (not agel and not ref) or not re.search(r"\d", ln["text"]):
                            continue  # linha vazia ou rótulo de desenho ("H")
                        if not re.match(r"^[A-Z]{0,3}\d", agel or ref):
                            problemas["nao_extraidas"].append((pagina, modelo, ln["text"]))
                            continue
                        unidade = "pol" if unidade_tab == "misto" else unidade_tab  # misto: vírgula = mm, resto = pol
                        impresso = {
                            "Interno": parse_valor(" ".join(cel.get("int", [])), unidade),
                            "Externo": parse_valor(" ".join(cel.get("ext", [])), unidade),
                            "Altura": parse_valor(" ".join(cel.get("h", [])), unidade),
                        }
                        extras = {k: " ".join(cel[k]) for k in ("d1", "l1", "l2", "r", "f", "g") if k in cel}
                        material_linha = " ".join(cel.get("material", [])).upper()
                        polymax = polymax_regiao or agel.endswith("PM") or ref.endswith("PM")
                        rows.append({
                            "pagina": pagina, "linha": linha_cat, "modelo": modelo, "polymax": polymax,
                            "agel": agel, "ref": ref, "impresso": impresso, "extras": extras,
                            "material_linha": material_linha, "raw": ln["text"],
                            "unidade": "pol" if unidade_tab == "pol" or (unidade_tab == "misto" and "," not in ln["text"]) else "mm",
                        })
        rows += extrair_reparos(pdf, problemas)
    return rows


def extrair_reparos(pdf, problemas):
    rows = []
    for pagina in REPARO_PAGES:
        page = pdf.pages[pagina - 1]
        linhas = agrupar_linhas(page.extract_words())
        for ln in linhas:
            ws = ln["words"]
            if not ws or ws[0]["x0"] > 60 or not re.match(r"^[A-Z0-9]+-[A-Z0-9]+", ws[0]["text"]):
                continue
            codigo = ws[0]["text"]
            desc = " ".join(w["text"] for w in ws[1:] if w["x0"] < 450)
            nums = [w["text"] for w in ws if w["x0"] >= 450]
            dims = [parse_mm(n) for n in nums]
            impresso = {"Interno": None, "Externo": None, "Altura": None}
            if len(dims) == 3:
                impresso = dict(zip(["Interno", "Externo", "Altura"], dims))
            rows.append({
                "pagina": pagina, "linha": "reparo", "modelo": "Kit de reparo" if "REPARO" in desc else "Componente",
                "polymax": False, "agel": codigo, "ref": "", "impresso": impresso, "extras": {},
                "material_linha": "", "raw": ln["text"], "unidade": "mm", "descricao": desc,
            })
    return rows


# ---------------------------------------------------------------------------
# Lista de preços (somente código + descrição; preço é descartado)
# ---------------------------------------------------------------------------
def extrair_lista_precos(pdf_path):
    itens = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            linha_lista = ""
            ws_pag = page.extract_words()
            un_x = min((w["x0"] for w in ws_pag if w["text"] == "UN"), default=470) - 5
            for ln in agrupar_linhas(ws_pag, tol=3):
                if ln["text"].startswith("Linha:"):
                    linha_lista = ln["text"].replace("Linha:", "").strip()
                    continue
                ws = ln["words"]
                if not ws or ws[0]["x0"] > 60:
                    continue
                codigo = ws[0]["text"]
                if not re.match(r"^[A-Z0-9][A-Z0-9./-]*$", codigo) or codigo in {"Código", "Código"}:
                    continue
                # descrição = palavras entre o código e a coluna UN (x < ~ 480 na página)
                desc_ws = [w for w in ws[1:] if w["x1"] < un_x]
                desc = " ".join(w["text"] for w in desc_ws).strip()
                if not desc:
                    continue
                itens.append({"codigo": codigo, "descricao": desc, "linha": linha_lista})
    return itens


_NUM = r"(\d+[ .]\d+/\d+|\d+/\d+|\d+(?:[.,]\d+)?)"
DESC_DIM_RE = re.compile(_NUM + r"\s*X\s*" + _NUM + r"\s*X\s*" + _NUM)


def dims_da_descricao(desc):
    d = re.sub(r"\b(AG|RP)\s*-?\s*\d+\b", " ", desc.upper())   # nome do modelo não é medida
    d = re.sub(r"(\d)\s+\.(\d)", r"\1.\2", d)                   # "2 .1/4" -> "2.1/4"
    m = DESC_DIM_RE.search(d)
    if not m:
        return None
    vals = []
    for g in m.groups():
        g = g.strip()
        if "/" in g:
            v = parse_pol(g)
        elif "," in g:
            v = parse_mm(g)
        elif "." in g and re.fullmatch(r"\d+\.\d+", g):
            v = parse_mm(g)
        else:
            # inteiro: decide pelo contexto (frações na mesma descrição => pol)
            v = parse_pol(g) if any("/" in x for x in m.groups()) else parse_mm(g)
        vals.append(v)
    if None in vals:
        return None
    return dict(zip(["Interno", "Externo", "Altura"], vals))


def chave(c):
    return re.sub(r"[\s\-./]", "", (c or "").upper())


# ---------------------------------------------------------------------------
# Montagem
# ---------------------------------------------------------------------------
def r4(v):
    return "" if v is None else f"{v:.4f}".rstrip("0").rstrip(".")


def montar(rows, precos, problemas):
    saida = []
    for r in rows:
        linha, modelo = r["linha"], r["modelo"]
        if linha == "reparo":
            tipo, aplic, ficha, material = "Reparo pneumático", [], (None, None, None, None), ""
            linha_label = "Pneumática"
        else:
            tipo = tipo_do_modelo(linha, modelo)
            aplic = APLICACOES.get((linha, modelo))
            ficha = FICHA.get((linha, modelo, r["polymax"])) or FICHA.get((linha, modelo, False))
            if aplic is None or ficha is None:
                problemas["sem_manifesto"].add((r["pagina"], linha, modelo, r["polymax"]))
                aplic = aplic or []
                ficha = ficha or (None, None, None, None)
            if r["material_linha"]:
                material = "Polymax" if r["material_linha"] == "POLYMAX" else r["material_linha"]
            elif r["polymax"]:
                material = "Polymax"
            elif linha == "gaxeta":
                material = "PU"
            else:
                material = ""
            linha_label = LINHA_LABEL[linha]

        decod = decode_ref(r["ref"], CODE_PATTERN.get(modelo)) if linha in ("gaxeta", "raspador") else None
        final = dict(r["impresso"])
        fonte = "pdf"
        if decod:
            fonte = "codigo"
            for campo, v in decod.items():
                p = r["impresso"].get(campo)
                if p is not None and abs(p - v) > TOL_DIVERGENCIA:
                    problemas["codigo_vs_impresso"].append((r["pagina"], modelo, r["agel"], r["ref"], campo, p, v))
                final[campo] = v
        if not r["agel"]:
            problemas["sem_agel"].append((r["pagina"], modelo, r["ref"]))
        codigo = r["agel"] or r["ref"]
        if all(final.get(k) is None for k in ("Interno", "Externo", "Altura")) and linha != "reparo":
            problemas["nao_extraidas"].append((r["pagina"], modelo, r["raw"]))
            continue

        saida.append({
            "Codigo": codigo,
            "Referencia": r["ref"],
            "Tipo": tipo,
            "Modelo": modelo,
            "Material": material,
            "Aplicacao": ",".join(aplic),
            "Linha": linha_label,
            "Interno": r4(final.get("Interno")),
            "Externo": r4(final.get("Externo")),
            "Altura": r4(final.get("Altura")),
            "UnidadeNominal": r["unidade"],
            "PressaoPsi": ficha[0] if ficha[0] is not None else "",
            "TempMin": ficha[1] if ficha[1] is not None else "",
            "TempMax": ficha[2] if ficha[2] is not None else "",
            "VelocidadeMs": ficha[3] if ficha[3] is not None else "",
            "Extras": ";".join(f"{k.upper()}={v}" for k, v in r["extras"].items()).replace(";", "|"),
            "Descricao": r.get("descricao", ""),
            "Tabela2026": "",
            "Fonte": fonte,
            "Pagina": r["pagina"],
        })

    # duplicados dentro do próprio catálogo (mesmo código em duas tabelas)
    vistos = {}
    for s in saida:
        vistos.setdefault(s["Codigo"], []).append(s)
    for cod, lst in vistos.items():
        if len(lst) > 1:
            problemas["duplicados_catalogo"].append((cod, [f"{x['Modelo']}/{x['Material']} p{x['Pagina']}" for x in lst]))

    # cruzamento com a lista de preços 2026
    if precos is not None:
        idx = {}
        for s in saida:
            idx.setdefault(chave(s["Codigo"]), s)
            if s["Referencia"]:
                idx.setdefault(chave(s["Referencia"]), s)
        casados = set()
        for it in precos:
            s = idx.get(chave(it["codigo"]))
            if not s:
                problemas["precos_sem_catalogo"].append(it)
                continue
            casados.add(id(s))
            s["Tabela2026"] = "S"
            if not s["Descricao"]:
                s["Descricao"] = it["descricao"]
            d = dims_da_descricao(it["descricao"])
            if d:
                for campo, v in d.items():
                    cat = s[campo]
                    if cat != "" and abs(float(cat) - v) > TOL_DIVERGENCIA:
                        problemas["preco_vs_catalogo"].append((it["codigo"], s["Codigo"], it["descricao"], campo, float(cat), v))
        problemas["catalogo_sem_preco"] = [s for s in saida if id(s) not in casados]
        for it in problemas["precos_sem_catalogo"]:
            novo = item_da_lista(it)
            if novo:
                saida.append(novo)
    return saida


MODELOS_GAXETA = {m for (li, m) in APLICACOES if li == "gaxeta"}


def item_da_lista(it):
    """Produto que existe só na lista 2026: facetas pela descrição, medidas pelo código ou descrição."""
    desc, cod = it["descricao"].upper(), it["codigo"].upper()
    if desc.startswith(("GAX", "CONJUNTO GAX")):
        tipo, linha = "Gaxeta", "gaxeta"
    elif desc.startswith(("RASP", "RAPADOR")):
        tipo, linha = "Raspador", "raspador"
    elif desc.startswith("ALICATE"):
        tipo, linha = "Ferramenta", None
    else:
        tipo, linha = "Outros", None

    modelo = ""
    if m := re.search(r"\bAG\s*-?\s*(\d+)", desc):
        modelo = f"AG {m.group(1)}"
    elif m := re.search(r"\bTIPO\s+([A-Z0-9/-]+)", desc):
        modelo = m.group(1)
    elif m := re.search(r"\b(RP-\d+)", desc):
        modelo = m.group(1)
    codigo_limpo = re.sub(r"(BS)?(PM)?$", "", cod.replace("-", ""))
    pattern = None
    if re.fullmatch(r"\d{8}", codigo_limpo):
        pattern, modelo = "std8", modelo or "STD"
    elif re.fullmatch(r"\d{11}", codigo_limpo):
        pattern, modelo = "b11", modelo or "B"
    if modelo == "AG 4":
        modelo = "AG 4 (BS)"

    polymax = "POLYMAX" in desc or cod.endswith("PM")
    if polymax:
        material = "Polymax"
    elif "GSK" in desc:
        material = "GSK"
    elif m := re.search(r"\b(PU|NBR|MVQ|VITON|FKM)\b", desc):
        material = m.group(1)
    elif linha == "gaxeta" and modelo in MODELOS_GAXETA:
        material = "PU"
    else:
        material = ""

    dims = (decode_ref(codigo_limpo, pattern) if pattern else None) or dims_da_descricao(desc) or {}
    aplic = APLICACOES.get((linha, modelo), []) if linha else []
    ficha = (FICHA.get((linha, modelo, polymax)) or FICHA.get((linha, modelo, False))) if linha else None
    ficha = ficha or (None, None, None, None)
    return {
        "Codigo": it["codigo"], "Referencia": "", "Tipo": tipo, "Modelo": modelo, "Material": material,
        "Aplicacao": ",".join(aplic), "Linha": "Hidráulica" if linha else "",
        "Interno": r4(dims.get("Interno")), "Externo": r4(dims.get("Externo")), "Altura": r4(dims.get("Altura")),
        "UnidadeNominal": "pol" if "/" in desc else "mm",
        "PressaoPsi": ficha[0] if ficha[0] is not None else "", "TempMin": ficha[1] if ficha[1] is not None else "",
        "TempMax": ficha[2] if ficha[2] is not None else "", "VelocidadeMs": ficha[3] if ficha[3] is not None else "",
        "Extras": "", "Descricao": it["descricao"], "Tabela2026": "S",
        "Fonte": "codigo" if pattern and dims else "tabela2026", "Pagina": "",
    }


def ler_legado():
    """Mapeia códigos das CSVs antigas para detectar sobreposição com o APC."""
    leg = {}
    for f in sorted(LEGACY_DIR.glob("data_*.csv")):
        with open(f, encoding="utf-8") as fh:
            linhas = [l for l in fh if not l.startswith("#")]
        for row in csv.DictReader(linhas, delimiter=";"):
            c = (row.get("Codigo") or "").strip()
            if c:
                leg.setdefault(chave(c), []).append((f.name, c, row))
    return leg


CAMPOS = ["Codigo", "Referencia", "Tipo", "Modelo", "Material", "Aplicacao", "Linha", "Interno", "Externo",
          "Altura", "UnidadeNominal", "PressaoPsi", "TempMin", "TempMax", "VelocidadeMs", "Extras",
          "Descricao", "Tabela2026", "Fonte", "Pagina"]


def escrever_csv(saida):
    saida.sort(key=lambda s: (s["Tipo"], s["Linha"], s["Modelo"], s["Material"], s["Fonte"],
                              float(s["Interno"] or 0), float(s["Externo"] or 0), float(s["Altura"] or 0), s["Codigo"]))
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=CAMPOS, delimiter=";", lineterminator="\n")
    w.writeheader()
    w.writerows(saida)
    OUT_CSV.write_text(buf.getvalue(), encoding="utf-8")


def fmt(v):
    return f"{v:.2f}".replace(".", ",")


def escrever_relatorio(saida, problemas, legado, precos_ok):
    L = ["# Relatório de ingestão — catálogo APC", "",
         "Gerado por `scripts/ingest_catalogos.py`. Não editar à mão.", ""]
    # contagens
    from collections import Counter
    cont = Counter((s["Tipo"], s["Modelo"], s["Material"] or "—", s["Linha"]) for s in saida)
    L += ["## Itens por modelo", "", f"Total: **{len(saida)}** itens.", "",
          "| Tipo | Modelo | Material | Linha | Itens |", "|---|---|---|---|---|"]
    L += [f"| {t} | {m} | {mat} | {li} | {n} |" for (t, m, mat, li), n in sorted(cont.items())]

    L += ["", f"## Código da referência × valor impresso (> {fmt(TOL_DIVERGENCIA)} mm)", "",
          "O CSV usa o valor do **código** (fonte da verdade).", ""]
    if problemas["codigo_vs_impresso"]:
        L += ["| Pág. | Modelo | Nº AGEL | Referência | Campo | Impresso (mm) | Código (mm) |", "|---|---|---|---|---|---|---|"]
        L += [f"| {p} | {m} | {a} | {r} | {c} | {fmt(i)} | {fmt(v)} |" for p, m, a, r, c, i, v in problemas["codigo_vs_impresso"]]
    else:
        L += ["Nenhuma divergência."]

    L += ["", "## Linhas sem Nº AGEL (Código = Referência)", ""]
    L += [f"- pág. {p} · {m} · `{r}`" for p, m, r in problemas["sem_agel"]] or ["Nenhuma."]

    L += ["", "## Mesmo código em mais de uma tabela do catálogo", ""]
    L += [f"- `{c}`: {', '.join(lst)}" for c, lst in problemas["duplicados_catalogo"]] or ["Nenhum."]

    L += ["", "## Sobreposição com as CSVs antigas (o APC prevalece no painel)", ""]
    sobre = []
    for s in saida:
        for arq, c, row in legado.get(chave(s["Codigo"]), []):
            sobre.append(f"| `{c}` | {arq} | {s['Tipo']} {s['Modelo']} {s['Material']} |")
    if sobre:
        L += [f"{len(sobre)} códigos.", "", "| Código | CSV antiga | APC |", "|---|---|---|"] + sobre
    else:
        L += ["Nenhuma."]

    if precos_ok:
        L += ["", "## Lista de preços 2026 × catálogo", "",
              "Cruzamento por Nº AGEL ou Referência (hífens ignorados). **Preços não são importados.**", ""]
        n_cat = sum(1 for s in saida if s["Pagina"] != "")
        L += [f"- Itens do catálogo encontrados na lista 2026: **{sum(1 for s in saida if s['Tabela2026'] and s['Pagina'] != '')}** de {n_cat}",
              f"- Itens da lista 2026 sem correspondência no catálogo: **{len(problemas['precos_sem_catalogo'])}**", ""]
        L += ["### Medida da descrição (lista 2026) × catálogo", ""]
        if problemas["preco_vs_catalogo"]:
            L += ["| Código lista | Código catálogo | Descrição | Campo | Catálogo (mm) | Descrição (mm) |", "|---|---|---|---|---|---|"]
            L += [f"| `{a}` | `{b}` | {d} | {c} | {fmt(x)} | {fmt(y)} |" for a, b, d, c, x, y in problemas["preco_vs_catalogo"]]
        else:
            L += ["Nenhuma divergência."]
        L += ["", "### Itens da lista 2026 que não estão no catálogo (incluídos com Fonte=tabela2026)", ""]
        if problemas["precos_sem_catalogo"]:
            L += ["| Código | Linha | Descrição |", "|---|---|---|"]
            L += [f"| `{i['codigo']}` | {i['linha']} | {i['descricao']} |" for i in problemas["precos_sem_catalogo"]]
        else:
            L += ["Nenhum."]

    L += ["", "## Modelos sem ficha/aplicação no manifesto", ""]
    L += [f"- pág. {p} · {li} · {m} · polymax={pm}" for p, li, m, pm in sorted(problemas["sem_manifesto"])] or ["Nenhum."]
    L += ["", "## Linhas não extraídas", ""]
    L += [f"- pág. {p} · {m} · `{raw}`" for p, m, raw in problemas["nao_extraidas"]] or ["Nenhuma."]
    L += ["", "## Pendências conhecidas (dados antigos)", "",
          "- `data_conjunto_bp.csv`: colunas Externo/Interno parecem trocadas em parte das linhas.",
          "- Raspadores sem coluna MATERIAL no catálogo ficam com Material em branco.",
          "- Tabela de conversão do Drive: `11 1/2` = 292,10 (não 292,70); `18 1/4` = 463,55; `22` = 558,80; falta `27/32` (21,43)."]
    OUT_REPORT.write_text("\n".join(L) + "\n", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalogo", default=str(CATALOGO_PDF))
    ap.add_argument("--precos", default=str(PRECOS_PDF))
    a = ap.parse_args()

    problemas = {"codigo_vs_impresso": [], "sem_agel": [], "nao_extraidas": [], "sem_manifesto": set(),
                 "duplicados_catalogo": [], "precos_sem_catalogo": [], "preco_vs_catalogo": [],
                 "catalogo_sem_preco": []}
    rows = extrair_catalogo(a.catalogo, problemas)
    precos = extrair_lista_precos(a.precos) if Path(a.precos).exists() else None
    saida = montar(rows, precos, problemas)
    escrever_csv(saida)
    escrever_relatorio(saida, problemas, ler_legado(), precos is not None)

    from collections import Counter
    print(f"itens: {len(saida)}")
    for k, n in sorted(Counter((s['Tipo'], s['Modelo'], s['Material']) for s in saida).items()):
        print(f"  {k[0]:<18} {k[1]:<10} {k[2]:<8} {n}")
    print({k: len(v) for k, v in problemas.items()})
    if precos is not None:
        print(f"lista 2026: {len(precos)} itens; casados com catálogo: {sum(1 for s in saida if s['Tabela2026'] and s['Pagina'] != '')}; "
              f"só na lista: {len(problemas['precos_sem_catalogo'])}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
