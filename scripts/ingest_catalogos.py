"""Ingestão dos catálogos APC (gaxetas/raspadores 2022 + retentores 2021),
cruzamento com as listas AGEL 2025 e anéis O-ring da lista 01/2025.

Uso (rodar da raiz do projeto):
    python -I scripts/ingest_catalogos.py

Saídas:
    src/data/catalogo_apc.csv       dataset facetado (mm, 4 casas)
    docs/catalogos/divergencias.md  relatório de divergências / cruzamentos

Regras:
- Fonte da verdade para peças em polegada = código da REFERÊNCIA (pol × 25,4, exato,
  milésimos arredondados para 1/64").
- Das listas só código e descrição são cruzados (UN e % IPI são descartados).
- Mesmo código nos dois catálogos: o de gaxetas prevalece, exceto quando retentores 2021
  e lista 2025 concordam contra gaxetas 2022 (consenso).
- Códigos reutilizados na lista 2025 para outra peça: prevalece a lista 2025.
- Anéis O-ring: vêm do extrato sem preço gerado por scripts/extrair_lista_oring.py
  (Tipo Anel, Perfil O-ring; D.I. = Ø interno, W = altura e seção, ØEXT = D.I. + 2·W).
"""

import argparse
import csv
import io
import re
import subprocess
import sys
from fractions import Fraction
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
CATALOGO_PDF = ROOT / "docs/catalogos/gaxetas-raspadores/catalogo-gaxetas-raspadores-2022.pdf"
RETENTORES_PDF = ROOT / "docs/catalogos/retentores/catalogo-retentores-2021.pdf"
LISTAS_PDF = [
    ROOT / "docs/catalogos/listas/lista-gaxetas-raspadores-2025.pdf",
    ROOT / "docs/catalogos/listas/lista-retentores-2025.pdf",
]
ORING_CSV = ROOT / "docs/catalogos/listas/lista-oring-2025.csv"  # extrato sem preço (extrair_lista_oring.py)
OUT_CSV = ROOT / "src/data/catalogo_apc.csv"
OUT_REPORT = ROOT / "docs/catalogos/divergencias.md"
LEGACY_DIR = ROOT / "src/data"

TOL_DIVERGENCIA = 0.05  # mm

# ---------------------------------------------------------------------------
# Manifesto (transcrito do índice do catálogo 2022, páginas PDF 12-16;
# página impressa = página PDF - 16)
# ficha = (pressao_psi | None, temp_min, temp_max, velocidade_m_s)
# ---------------------------------------------------------------------------
PU_HID = (-30, 100)
PM_TEMP = (-45, 135)

HASTE, EMBOLO, AMORTECIMENTO = "haste", "embolo", "amortecimento"
EIXO = "eixo"  # retentores (eixo rotativo)

CAT_GAXETAS, CAT_RETENTORES, CAT_LISTA = "gaxetas-2022", "retentores-2021", "lista-2025"

# (linha, modelo) -> aplicações
# O índice agrupa por haste/êmbolo, mas os desenhos de montagem mandam:
# B, AG 2 e AG 7 aparecem instalados na haste E no êmbolo (págs. 17, 24, 27, 37-44).
APLICACOES = {
    # gaxetas hidráulicas — haste e êmbolo (dois desenhos na página)
    **{("gaxeta", m): [HASTE, EMBOLO] for m in ["B", "AG 2", "AG 7"]},
    # gaxetas hidráulicas — haste
    **{("gaxeta", m): [HASTE] for m in [
        "AG 1", "AG 4 (BS)", "AG 5", "AG 11", "AG 12", "AG 13",
        "AG 14", "AG 16", "AG 17", "AG 19", "AG 20", "AG 21", "AG 22", "AG 23"]},
    # gaxetas hidráulicas — êmbolo
    **{("gaxeta", m): [EMBOLO] for m in [
        "AG 3", "AG 6", "AG 8", "AG 10", "AG 15", "AG 18", "AG 24", "STD"]},
    # raspadores trabalham sempre na haste
    **{("raspador", m): [HASTE] for m in [
        "D", "6D/66D", "900D", "K", "RP-25", "DG", "E", "GA", "GAE", "GAG",
        "AGK1", "GA1", "AGK2", "RP-27", "RP-28"]},
    # linha pneumática — aplicação pelo desenho de cada página (62-65)
    ("pneumatica", "AG 3"): [EMBOLO],         # série Mini ISO
    ("pneumatica", "AG 6"): [EMBOLO],         # série CWU
    ("pneumatica", "AG 7"): [HASTE, EMBOLO],
    ("pneumatica", "AG 24"): [EMBOLO],
    ("pneumatica", "AG 25"): [HASTE],         # guarnição composta (vedação + raspador na haste)
    ("pneumatica", "KDG"): [HASTE],           # raspador série Mini ISO (EL-xxxx)
    ("pneumatica", "RP-08"): [AMORTECIMENTO], # guarnição de amortecimento
    ("pneumatica", "RP-25"): [HASTE],         # raspador série compacta
    ("pneumatica", "Z"): [EMBOLO],            # guarnição de borracha de êmbolo
}

# Material quando a tabela não tem coluna MATERIAL nem é Polymax.
# Raspadores de lábio (D…E) têm a mesma faixa -30/+100 °C das gaxetas PU.
MATERIAL_PADRAO = {
    **{("gaxeta", m): "PU" for (li, m) in APLICACOES if li == "gaxeta"},
    **{("raspador", m): "PU" for m in ["D", "6D/66D", "900D", "K", "RP-25", "DG", "E"]},
    ("pneumatica", "Z"): "Borracha",  # pág. 65: "GUARNIÇÃO DE BORRACHA - TIPO Z"
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
    ("raspador", "RP-27", True): (None, *PU_HID, 4),
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

# Raspadores com carcaça metálica: Tipo "Raspador metálico"; Perfil, Material e Aplicação ficam
# como no catálogo. Aplicado só na saída: o resto do script trata esses perfis como "Raspador".
PERFIS_METALICOS = {"GA", "GAE", "GAG", "AGK1", "GA1", "AGK2"}
TIPO_RASPADOR_METALICO = "Raspador metálico"

TIPO_POR_LINHA = {"gaxeta": "Gaxeta", "raspador": "Raspador", "pneumatica": "Gaxeta"}
LINHA_LABEL = {"gaxeta": "Hidráulica", "raspador": "Hidráulica", "pneumatica": "Pneumática"}


def linha_da_pagina(pagina):
    if pagina <= 46:
        return "gaxeta"
    if pagina <= 61:
        return "raspador"
    return "pneumatica"


def tipo_do_modelo(linha, modelo):
    # Na linha pneumática há raspadores (RP-25, KDG) e guarnições
    if linha == "pneumatica" and modelo in ("RP-25", "KDG"):
        return "Raspador"
    return TIPO_POR_LINHA[linha]


# Padrão de código esperado por modelo
CODE_PATTERN = {"STD": "std8", "B": "b11", "AG 4 (BS)": "b11", "D": "d4"}

DATA_PAGES = list(range(17, 66))  # tolerâncias de usinagem ficam nas págs. 9-10
REPARO_PAGES = [66, 67]
POLYMAX_PAGES = set(range(37, 47)) | {60, 61}

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
    ("int", lambda s: s.endswith("INT.")),  # "INT." ou "ØINT."
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
            # fim da última tabela = rodapé (nº da página, 10 pt, em ~816 pt); a última linha fica em ~797 pt
            rodape = min((w["top"] for w in words if w["top"] > 800 and w["size"] >= 9.5), default=page.height)
            fronteiras = sorted({l["top"] for l in titulos + medidas + headers} | {rodape})

            linha_cat = linha_da_pagina(pagina)
            for hdr in headers:
                # Pode haver títulos empilhados (ex.: pág. 64: AG 25 em cima, KDG embaixo)
                tit = max((t for t in titulos if t["top"] < hdr["top"]), key=lambda t: t["top"], default=None)
                if tit is None:
                    problemas["nao_extraidas"].append((pagina, "cabeçalho sem título", hdr["text"]))
                    continue
                modelo = normalizar_modelo(" ".join(w["text"] for w in tit["words"] if w["size"] >= 18))
                subs = " ".join(l["text"] for l in subtitulos if tit["top"] < l["top"] < hdr["top"]).upper()
                polymax_regiao = "POLYMAX" in subs or pagina in POLYMAX_PAGES
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
            if not ws or ws[0]["x0"] > 60 or not re.fullmatch(r"[A-Z0-9][A-Z0-9-]*", ws[0]["text"]) \
                    or not re.search(r"\d", ws[0]["text"]):
                continue
            codigo = ws[0]["text"]
            resto = [w for w in ws[1:] if w["x0"] < 450]
            extras = {}
            if len(resto) > 1 and resto[0]["text"] == "/":  # "EU-3242 / EU-32": o segundo é apelido
                extras["Também"] = resto[1]["text"]
                resto = resto[2:]
            desc = " ".join(w["text"] for w in resto)
            nums = [w["text"] for w in ws if w["x0"] >= 450]
            dims = [parse_mm(n) for n in nums]
            impresso = {"Interno": None, "Externo": None, "Altura": None}
            if len(dims) == 3:
                impresso = dict(zip(["Interno", "Externo", "Altura"], dims))
            rows.append({
                "pagina": pagina, "linha": "reparo", "modelo": "Kit de reparo" if "REPARO" in desc else "Componente",
                "polymax": False, "agel": codigo, "ref": "", "impresso": impresso, "extras": extras,
                "material_linha": "", "raw": ln["text"], "unidade": "mm", "descricao": desc,
            })
    return rows


# ---------------------------------------------------------------------------
# Catálogo de retentores (ref. 2021)
# Págs. 10-76: uma seção por perfil (título 22 pt + descrição 10 pt + tabela).
# Págs. 84-111: índice "REFERÊNCIA AGEL" com todos os códigos (fonte primária).
# ---------------------------------------------------------------------------
RET_PERFIL_PAGES = range(10, 77)
RET_INDICE_PAGES = range(84, 112)

RET_HEADER_COLS = [
    ("codigo", lambda s: s == "CÓDIGO"),
    ("ref", lambda s: s == "REF"),
    ("mod", lambda s: s == "MOD."),
    ("int", lambda s: s.startswith("INT")),
    ("ext", lambda s: s.startswith("EXT")),
    ("h", lambda s: s in {"H", "H1"}),
    ("mat", lambda s: s == "MAT"),
    ("ori", lambda s: s == "ORI"),
]

# Legenda da pág. 6
ORIENTACAO = {"LI": "Liso", "H": "Horário", "AH": "Anti-horário", "BI": "Bidirecional"}

# Cores impressas junto ao material no catálogo 2021: normaliza Material para o elastômero
# base e preserva a cor em Extras (Cor=...), mantendo materiais compostos (FPM/INOX, NBR/PU…).
COR_MATERIAL = {"PT": "Preto", "AZ": "Azul", "AZUL": "Azul", "VR": "Vermelho"}

# Erros tipográficos confirmados no catálogo de retentores 2021
# (conferidos entre páginas de perfil, tabela Ref. Mercado págs. 77-83 e lista AGEL 2025).
RET_ERRATA = {
    "AG7677": ({"ext": 30.0}, "ØEXT impresso 'CS0806' (p.63/98); Ref. Mercado p.79 e lista 2025 = 30,00"),
    "4502": ({"h2": 15.0, "h_txt": "10,0/15,0"}, "H1/H2 impresso '10,0/5,0' (H2 < H1, p.55/89); lista 2025 = 10/15"),
    "TCS0808": ({"ext": 72.0}, "ØEXT impresso 72,10 no índice (p.109); p.21 e Ref. Mercado p.78 = 72,00"),
    "1405": ({"ext": 68.15}, "ØEXT impresso 76,10 (p.27/84); Ref. Mercado p.77 e lista 2025 = 68,15"),
    "AG8255": ({"mod": "GR", "mat": "HNBR", "pagina": 75}, "repetido em p.15/99 como BRG NBR; p.75 = GR e lista 2025 = GR HNBR"),
    "AG8307": ({"mat": "FPM"}, "impresso BRGF (F=FPM) com MAT=NBR (p.19/99); lista 2025 = BRG FPM"),
}

# Códigos reutilizados na lista AGEL 2025 para outra peça (prevalece o ERP atual / lista 2025).
RET_LISTA_PREVALECE = {"3994", "4523", "4620", "4634", "4667", "4672", "6639", "TCS0910"}


def normalizar_ref_retentor(ref):
    """Normaliza REF de mercado (5 dígitos) no catálogo de retentores 2021."""
    r = ref.strip()
    if not r or re.fullmatch(r"[-—,.]*", r):
        return ""
    r = re.sub(r"^(\d{5})\s*(?:F|BR)$", r"\1", r)  # "00501F", "01767 BR" -> 5 dígitos
    if re.fullmatch(r"\d{4}", r):
        r = "0" + r                                  # "0013" -> "00013"
    elif re.fullmatch(r"00\d{4}", r):
        r = r[1:]                                    # "001535" -> "01535"
    return r


def separar_cor_material(mat):
    """'FPM PT' -> ('FPM', 'Preto'); 'NBR AZUL' -> ('NBR', 'Azul'); 'FPM/INOX' -> ('FPM/INOX', '')."""
    partes = mat.split()
    if len(partes) == 2 and partes[1] in COR_MATERIAL:
        return partes[0], COR_MATERIAL[partes[1]]
    return mat, ""


def parse_extras(s):
    return dict(e.split("=", 1) for e in s["Extras"].split("|") if "=" in e)


def set_extras(s, extras):
    s["Extras"] = "|".join(f"{k}={v}" for k, v in extras.items() if v != "")


def colunas_retentor(hdr, x_min, x_max):
    ws = [w for w in hdr if x_min <= w["x0"] < x_max]
    cols = []
    for i, w in enumerate(ws):
        for nome, test in RET_HEADER_COLS:
            if test(w["text"]):
                x1 = w["x1"]
                if w["text"] == "H1":  # "H1 / H2": centro do grupo
                    x1 = next((v["x1"] for v in ws[i:] if v["text"] == "H2"), x1)
                cols.append((nome, (w["x0"] + x1) / 2))
                break
    return sorted(cols, key=lambda c: c[1])


def parse_h(txt):
    """'9,50' -> (None, 9.5); '5,0/7,0' -> (5.0, 7.0)."""
    t = txt.replace(" ", "")
    if "/" in t:
        a, b = t.split("/", 1)
        return parse_mm(a), parse_mm(b)
    return None, parse_mm(t)


def tabela_retentor(words, hdr_top, fim, meio, pagina, perfil, problemas):
    """Linhas da tabela cujo cabeçalho ("CÓDIGO …") está em hdr_top, nas duas metades da página."""
    hdr = sorted((w for w in words if abs(w["top"] - hdr_top) <= 3), key=lambda w: w["x0"])
    corpo_ini = max(w["bottom"] for w in hdr)
    out = []
    for x_min, x_max in ((0, meio), (meio, float("inf"))):
        cols = colunas_retentor(hdr, x_min, x_max)
        if not any(c[0] == "codigo" for c in cols):
            continue
        corpo = [w for w in words if corpo_ini < w["top"] < fim and x_min <= w["x0"] < x_max and w["size"] < 9]
        for ln in agrupar_linhas(corpo):
            cel = {k: " ".join(v).strip() for k, v in atribuir(ln["words"], cols).items()}
            if "BLOQUEADO" in ln["text"]:  # item bloqueado no catálogo: fora do painel
                problemas["ret_bloqueados"].append((pagina, ln["text"]))
                continue
            codigo = cel.get("codigo", "").replace(" ", "")
            if not codigo or not re.search(r"\d", ln["text"]):
                continue
            h1, h2 = parse_h(cel.get("h", ""))
            ext_txt = cel.get("ext", "")
            r = {
                "codigo": codigo, "ref": normalizar_ref_retentor(cel.get("ref", "")),
                "mod": cel.get("mod") or perfil, "int": parse_mm(cel.get("int", "")),
                # ØEXT escalonado ("110,0/154,0"): vale o primeiro (alojamento); o texto vai para Extras
                "ext": parse_mm(ext_txt.split("/")[0]), "ext_txt": ext_txt if "/" in ext_txt else "",
                "h1": h1, "h2": h2, "h_txt": cel.get("h", ""),
                "mat": cel.get("mat", ""), "ori": "" if re.fullmatch(r"[-—]*", cel.get("ori", "")) else cel.get("ori", ""),
                "pagina": pagina, "raw": ln["text"],
            }
            if codigo in RET_ERRATA:
                for k, v in RET_ERRATA[codigo][0].items():
                    if k != "pagina":
                        r[k] = v
                problemas["ret_erratas"].add(codigo)
            if not re.match(r"^[A-Z]{0,3}\d", codigo) or None in (r["int"], r["ext"], r["h2"]) or not r["mod"]:
                problemas["nao_extraidas"].append((f"R{pagina}", perfil or "índice", ln["text"]))
                continue
            out.append(r)
    return out


def extrair_retentores(pdf_path, problemas):
    """Retorna (perfis, linhas das páginas de perfil, linhas do índice)."""
    perfis, pag_rows, indice = {}, [], []
    with pdfplumber.open(pdf_path) as pdf:
        for pagina in [*RET_PERFIL_PAGES, *RET_INDICE_PAGES]:
            page = pdf.pages[pagina - 1]
            words = page.extract_words(extra_attrs=["size"])
            meio = page.width / 2
            rodape = min((w["top"] for w in words if w["text"] in ("LEGENDA", "VIDE")), default=page.height)
            headers = sorted({w["top"] for w in words if w["text"] == "CÓDIGO"})
            if pagina in RET_INDICE_PAGES:
                for t in headers:
                    indice += tabela_retentor(words, t, rodape, meio, pagina, None, problemas)
                continue
            titulos = sorted((w for w in words if w["size"] >= 20), key=lambda w: w["top"])
            for i, tit in enumerate(titulos):
                prox = titulos[i + 1]["top"] if i + 1 < len(titulos) else rodape
                perfil = tit["text"]
                desc = []
                for ln in agrupar_linhas([w for w in words if 9 <= w["size"] < 12 and tit["top"] < w["top"] < prox]):
                    if ln["text"].startswith("MEDIDAS"):
                        break
                    desc.append(ln["text"])
                perfis.setdefault(perfil, {"descricao": " ".join(desc), "pagina": pagina})
                for t in (h for h in headers if tit["top"] < h < prox):
                    pag_rows += tabela_retentor(words, t, prox, meio, pagina, perfil, problemas)
    return perfis, pag_rows, indice


def perfil_base(perfil, perfis):
    """Perfil com página própria a que a variante pertence, ou None.
    Variantes: número (AGGK1, BRXE3, GGGX-1) e material (F = FPM, S = MVQ, P = ACM: BRGF, BAS, GRP)."""
    if perfil in perfis:
        return perfil
    sem_hifen = perfil.replace("-", "")
    if sem_hifen in perfis:
        return sem_hifen
    base = re.sub(r"-?\d+$", "", perfil)
    if base in perfis:
        return base
    base_h = re.sub(r"-[A-Z]$", "", base)
    if base_h != base and base_h in perfis:
        return base_h
    base = base.replace("-", "")
    while base not in perfis and len(base) > 1 and base[-1] in "FSP":
        base = base[:-1]
    return base if base in perfis else None


def tipo_retentor(perfil, perfis):
    """Tipo pela descrição da página do perfil-base. Retorna (tipo, base)."""
    base = perfil_base(perfil, perfis)
    if base:
        return ("Raspador" if perfis[base]["descricao"].startswith("RASPADOR") else "Retentor"), base
    # sem página: GA/GR… são raspadores; o resto, retentor
    return ("Raspador" if re.match(r"^G[AR]", perfil) else "Retentor"), None


def linha_csv_retentor(r, tipo, modelo):
    mat, cor = separar_cor_material(r["mat"])
    extras = {}
    if modelo != r["mod"]:
        extras["Variante"] = r["mod"]
    if cor:
        extras["Cor"] = cor
    if r["ext_txt"]:
        extras["ØEXT"] = r["ext_txt"]
    if r["h1"] is not None:
        extras["H1/H2"] = r["h_txt"]
    if r["ori"]:
        extras["Orientação do lábio"] = ORIENTACAO.get(r["ori"], r["ori"])
    raspador = tipo == "Raspador"
    return {
        "Codigo": r["codigo"], "Referencia": r["ref"], "Tipo": tipo, "Modelo": modelo, "Material": mat,
        "Aplicacao": HASTE if raspador else EIXO, "Linha": "Hidráulica" if raspador else "Retentores",
        "Interno": r4(r["int"]), "Externo": r4(r["ext"]), "Altura": r4(r["h2"]), "UnidadeNominal": "mm",
        "PressaoPsi": "", "TempMin": "", "TempMax": "", "VelocidadeMs": "",
        "Extras": "|".join(f"{k}={v}" for k, v in extras.items()), "Descricao": "", "NaLista": "",
        "Fonte": "pdf", "Catalogo": CAT_RETENTORES, "Pagina": r["pagina"],
    }


def montar_retentores(perfis, pag_rows, indice, problemas):
    """Índice = fonte primária; páginas de perfil conferem o índice e completam o que faltar."""
    por_pag = {}
    for r in pag_rows:
        por_pag.setdefault(r["codigo"], []).append(r)
    no_indice = {r["codigo"] for r in indice}
    so_pagina = [r for r in pag_rows if r["codigo"] not in no_indice]
    problemas["ret_so_pagina"] = [(r["pagina"], r["mod"], r["codigo"]) for r in so_pagina]
    problemas["ret_repetidos"] = []
    problemas["ret_so_indice"] = [(r["pagina"], r["mod"], r["codigo"]) for r in indice if r["codigo"] not in por_pag]

    saida = []
    vistos = set()
    for r in indice + so_pagina:
        if r["codigo"] in vistos:  # código repetido no índice / em duas páginas de perfil
            problemas["ret_repetidos"].append((r["pagina"], r["mod"], r["codigo"]))
            continue
        vistos.add(r["codigo"])
        paginas = por_pag.get(r["codigo"], [])
        if len({p["mod"] for p in paginas}) > 1:
            problemas["ret_indice_vs_pagina"].append((r["codigo"], "mod", r["mod"], " / ".join(p["mod"] for p in paginas),
                                                      r["pagina"], " / ".join(str(p["pagina"]) for p in paginas)))
        for p in paginas:
            if p is r:
                continue
            for campo in ("int", "ext", "h1", "h2"):
                a, b = r[campo], p[campo]
                if (a is None) != (b is None) or (a is not None and abs(a - b) > TOL_DIVERGENCIA):
                    problemas["ret_indice_vs_pagina"].append((r["codigo"], campo, r[campo], p[campo], r["pagina"], p["pagina"]))
            for campo in ("mat", "ori"):
                if r[campo] != p[campo]:
                    problemas["ret_indice_vs_pagina"].append((r["codigo"], campo, r[campo], p[campo], r["pagina"], p["pagina"]))
            # BRGF no índice e na página do BRG é esperado (variante de material)
            if p["mod"] != r["mod"] and perfil_base(r["mod"], perfis) != p["mod"]:
                problemas["ret_indice_vs_pagina"].append((r["codigo"], "mod", r["mod"], p["mod"], r["pagina"], p["pagina"]))
        # Perfil = o da página onde o código aparece (o catálogo agrupa as variantes no perfil-base)
        modelo = paginas[0]["mod"] if paginas else perfil_base(r["mod"], perfis) or r["mod"]
        tipo, base = tipo_retentor(modelo, perfis)
        if base is None:
            problemas["ret_tipo_inferido"].add((r["mod"], tipo))
        linha = linha_csv_retentor(r, tipo, modelo)
        if r["codigo"] in RET_ERRATA and "pagina" in RET_ERRATA[r["codigo"]][0]:
            linha["Pagina"] = RET_ERRATA[r["codigo"]][0]["pagina"]
        elif paginas:  # a página do perfil (com desenho) é mais útil que a do índice
            linha["Pagina"] = paginas[0]["pagina"]
        saida.append(linha)
    return saida


def juntar_catalogos(gaxetas, retentores, itens, perfis, mods, problemas):
    """Mesmo código nos dois catálogos: fica a linha do de gaxetas, com REF, H1/H2 e orientação do de retentores.
    O de gaxetas imprime só "h" (= H1) nos raspadores GA/GAE/GAG; o de retentores imprime H1/H2.
    Quando retentores 2021 e lista 2025 concordam contra gaxetas 2022, adota o consenso."""
    idx = {}
    for s in gaxetas:
        idx.setdefault(chave(s["Codigo"]), []).append(s)
    lista_por_cod = {}
    for it in itens:
        lista_por_cod.setdefault(chave(it["codigo"]), []).append(it)
    out = list(gaxetas)
    for r in retentores:
        gs = idx.get(chave(r["Codigo"]))
        if not gs:
            out.append(r)
            continue
        ja_tem_modelo_r = any(x["Modelo"] == r["Modelo"] for x in gs)
        for g in gs:
            juntar_linha(g, r, lista_por_cod.get(chave(r["Codigo"]), []), perfis, mods, problemas, ja_tem_modelo_r)
    return out


def juntar_linha(g, r, lista_its, perfis, mods, problemas, ja_tem_modelo_r=False):
    """Linha do catálogo de gaxetas `g` herda REF, H1/H2 e orientação da linha de retentores `r`."""
    extras_r = parse_extras(r)
    h1 = parse_h(extras_r["H1/H2"])[0] if "H1/H2" in extras_r else None
    comparar = {"Interno": r["Interno"], "Externo": r["Externo"], "Altura": r4(h1) if h1 is not None else r["Altura"]}
    difs = [c for c, v in comparar.items() if g[c] != "" and v != "" and abs(float(g[c]) - float(v)) > TOL_DIVERGENCIA]
    if g["Material"] != r["Material"]:
        difs.append("Material")
    if g["Modelo"] != r["Modelo"]:
        difs.append("Modelo")
    g_antes = f"{g['Tipo']} {g['Modelo']} {g['Material']} p{g['Pagina']}"
    r_desc = f"{r['Tipo']} {r['Modelo']} {r['Material']} p{r['Pagina']}"

    # Consenso: se retentores 2021 + lista 2025 concordam contra gaxetas 2022, adota o consenso
    resolvidas = []
    if difs and lista_its:
        it = next((x for x in lista_its if x["linha"] == "RETENTORES"), lista_its[0])
        d_lst = dims_da_descricao(it["descricao"]) or {}
        r_lst = retentor_da_lista(it, perfis, mods)
        for campo in list(difs):
            if campo in ("Interno", "Externo", "Altura"):
                v_lst = d_lst.get("H1") if campo == "Altura" and "H1" in d_lst else d_lst.get(campo)
                v_ret = float(comparar[campo]) if comparar[campo] != "" else None
                if v_lst is not None and v_ret is not None and abs(v_lst - v_ret) <= TOL_DIVERGENCIA:
                    problemas["consenso_catalogos"].append((r["Codigo"], campo, g[campo], comparar[campo], it["descricao"]))
                    g[campo] = comparar[campo]
                    resolvidas.append(campo)
            elif campo == "Material" and r_lst["Material"] and r_lst["Material"] == r["Material"]:
                problemas["consenso_catalogos"].append((r["Codigo"], campo, g[campo], r[campo], it["descricao"]))
                g["Material"] = r["Material"]
                resolvidas.append(campo)
            elif campo == "Modelo" and not ja_tem_modelo_r and r_lst["Modelo"] and r_lst["Modelo"] == r["Modelo"]:
                problemas["consenso_catalogos"].append((r["Codigo"], campo, g[campo], r[campo], it["descricao"]))
                g["Modelo"] = r["Modelo"]
                resolvidas.append(campo)

    difs_rel = [f"{c} (consenso→{g[c]})" if c in resolvidas else c for c in difs]
    problemas["entre_catalogos"].append((r["Codigo"], g_antes, r_desc, difs_rel))
    if not g["Referencia"]:
        g["Referencia"] = r["Referencia"]
    herdados = [f"{k}={v}" for k, v in extras_r.items() if k in ("H1/H2", "Orientação do lábio")]
    g["Extras"] = "|".join(filter(None, [g["Extras"], *herdados]))


# ---------------------------------------------------------------------------
# Listas AGEL 2025 (somente código + descrição; UN e % IPI são descartados)
# ---------------------------------------------------------------------------
def extrair_lista(pdf_path):
    itens = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            linha_lista = ""
            # use_text_flow + tamanho da fonte separam Código (>= 9 pt) e Descrição (8 pt)
            # mesmo quando a descrição encosta ou atravessa a coluna UN ("PC", 10 pt).
            ws_pag = page.extract_words(use_text_flow=True, extra_attrs=["size"])
            un_x = min((w["x0"] for w in ws_pag if w["text"] == "UN"), default=345)
            for ln in agrupar_linhas(ws_pag, tol=3):
                if ln["text"].startswith("Linha:"):
                    linha_lista = ln["text"].replace("Linha:", "").strip()
                    continue
                ws = ln["words"]
                if not ws or ws[0]["x0"] > 60:
                    continue
                cod_ws = [w["text"] for w in ws if w["size"] >= 9 and w["x0"] < un_x - 5]
                desc_ws = [w["text"] for w in ws if w["size"] < 9]
                # abreviação da descrição com fonte grande ("625002874-189 STD. GAXETA …") não é código
                while len(cod_ws) > 1 and re.search(r"[A-Z]\.", cod_ws[-1]):
                    desc_ws.insert(0, cod_ws.pop())
                codigo = " ".join(cod_ws)
                if not re.match(r"^[A-Z0-9][A-Z0-9 ./-]*$", codigo) or codigo == "Código":
                    continue
                desc = " ".join(desc_ws).strip()
                if not desc:
                    continue
                itens.append({"codigo": codigo, "descricao": desc, "linha": linha_lista, "arquivo": Path(pdf_path).name})
    return itens


# Par de valores em mm ("5,00/7,00", "13/17,70"): H1/H2 na altura, ØEXT escalonado no externo
_H12 = r"\d+,\d+/\d+(?:,\d+)?|\d+/\d+,\d+"
_NUM = r"(" + _H12 + r"|\d+[ .]\d+/\d+|\d+/\d+|\d+(?:[.,]\d+)?)"
DESC_DIM_RE = re.compile(_NUM + r"\s*X\s*" + _NUM + r"\s*X\s*" + _NUM)


def dims_da_descricao(desc):
    d = re.sub(r"\b(AG|RP)\s*-?\s*\d+\b", " ", desc.upper())   # nome do modelo não é medida
    d = re.sub(r"(\d)\s+\.(\d)", r"\1.\2", d)                   # "2 .1/4" -> "2.1/4"
    d = re.sub(r"(\d,\d+)\s+/\s*(\d)", r"\1/\2", d)             # "7,00 / 11,50" -> "7,00/11,50"
    d = re.sub(r"\b(\d+)\.(\d+)/(\d+,\d+)", r"\1,\2/\3", d)        # "5.00/6,00" -> "5,00/6,00"
    d = re.sub(r"(X\s*\d+,\d+\s*X\s*\d+,\d+)\s*X\s*(\d+,\d+)", r"\1/\2", d)  # "A X B X H1 X H2"
    m = DESC_DIM_RE.search(d)
    if not m:  # "20,00 X 28,00 6,00": faltou um "X" entre duas medidas em mm
        m = DESC_DIM_RE.search(re.sub(r"(\d,\d+)\s+(\d+,\d+(?:/\d+(?:,\d+)?)?)\b", r"\1 X \2", d))
    if not m:
        return None
    grupos = [g.strip() for g in m.groups()]
    mm = any("," in g for g in grupos)
    # "10/15" numa descrição em mm também é par de valores, não fração de polegada
    par = [bool(re.fullmatch(_H12, g)) or (mm and bool(re.fullmatch(r"\d+/\d+", g))) for g in grupos]
    fracao = any("/" in g and not p for g, p in zip(grupos, par))
    vals = []
    for i, (g, eh_par) in enumerate(zip(grupos, par)):
        if eh_par:
            a, b = (float(x.replace(",", ".")) for x in g.split("/"))
            v = b if i == 2 else a  # altura: H2 (total); diâmetro escalonado: o primeiro
        elif "/" in g:
            v = parse_pol(g)
        elif "," in g:
            v = parse_mm(g)
        elif "." in g and re.fullmatch(r"\d+\.\d+", g):
            v = parse_mm(g)
        else:
            # inteiro: decide pelo contexto (frações na mesma descrição => pol)
            v = parse_pol(g) if fracao else parse_mm(g)
        vals.append(v)
    if None in vals:
        return None
    out = dict(zip(["Interno", "Externo", "Altura"], vals))
    if par[1]:
        out["ØEXT"] = grupos[1]
    if par[2]:
        out["H1"], out["H1/H2"] = float(grupos[2].split("/")[0].replace(",", ".")), grupos[2]
    return out


def chave(c):
    return re.sub(r"[\s\-./]", "", (c or "").upper())


# ---------------------------------------------------------------------------
# Montagem
# ---------------------------------------------------------------------------
def r4(v):
    return "" if v is None else f"{v:.4f}".rstrip("0").rstrip(".")


def montar(rows, problemas):
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
            else:
                material = MATERIAL_PADRAO.get((linha, modelo), "")
            linha_label = LINHA_LABEL[linha]

        decod = None
        if linha in ("gaxeta", "raspador") and (r["unidade"] == "pol" or CODE_PATTERN.get(modelo) != "d4"):
            decod = decode_ref(r["ref"], CODE_PATTERN.get(modelo))
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
            "Extras": "|".join(f"{k if linha == 'reparo' else k.upper()}={v}" for k, v in r["extras"].items()),
            "Descricao": r.get("descricao", ""),
            "NaLista": "",
            "Fonte": fonte,
            "Catalogo": CAT_GAXETAS,
            "Pagina": r["pagina"],
        })
    return saida


def fundir_componentes(saida, problemas):
    """A pág. 66 repete, pela REFERÊNCIA, peças das tabelas pneumáticas (62-65): vira descrição da peça."""
    por_ref = {}
    for s in saida:
        if s["Referencia"] and s["Tipo"] != "Reparo pneumático":
            por_ref.setdefault(chave(s["Referencia"]), []).append(s)
    out = []
    for s in saida:
        alvos = por_ref.get(chave(s["Codigo"])) if s["Modelo"] == "Componente" else None
        if not alvos:
            out.append(s)
            continue
        for a in alvos:
            a["Descricao"] = a["Descricao"] or s["Descricao"]
            if s["Extras"]:
                a["Extras"] = "|".join(filter(None, [a["Extras"], s["Extras"]]))
        problemas["componentes_fundidos"].append(s["Codigo"])
    return out


def duplicados(saida, problemas):
    """Mesmo código em duas tabelas do mesmo catálogo."""
    vistos = {}
    for s in saida:
        vistos.setdefault(s["Codigo"], []).append(s)
    for cod, lst in vistos.items():
        if len(lst) > 1:
            problemas["duplicados_catalogo"].append(
                (cod, [f"{x['Modelo']}/{x['Material'] or '—'} p{x['Pagina']} ({x['Catalogo']})" for x in lst]))


def medidas_equivalentes(a, b):
    """Confere se dois itens têm as mesmas medidas (aceita H1 de H1/H2 e segundo ØEXT escalonado)."""
    ex_a, ex_b = parse_extras(a), parse_extras(b)
    for campo in ("Interno", "Externo", "Altura"):
        if not a[campo] or not b[campo]:
            return False
        va, vb = [float(a[campo])], [float(b[campo])]
        if campo == "Altura":
            if "H1/H2" in ex_a and (h1 := parse_h(ex_a["H1/H2"])[0]) is not None:
                va.append(h1)
            if "H1/H2" in ex_b and (h1 := parse_h(ex_b["H1/H2"])[0]) is not None:
                vb.append(h1)
        elif campo == "Externo":
            for ex, lst in ((ex_a, va), (ex_b, vb)):
                if "ØEXT" in ex and "/" in ex["ØEXT"]:
                    if (e2 := parse_mm(ex["ØEXT"].split("/", 1)[1])) is not None:
                        lst.append(e2)
        if all(abs(x - y) > TOL_DIVERGENCIA for x in va for y in vb):
            return False
    return True


def vincular_equivalentes_rt_tcs(todos, casados, problemas):
    """Vincula códigos RTxxxx (lista 2025) ao TCSxxxx correspondente quando as medidas batem.
    Mantém ambos pesquisáveis no painel (marca TCSxxxx com NaLista=S) e anota Equivalente= em Extras."""
    por_cod = {s["Codigo"]: s for s in todos}
    for s in todos:
        m = re.fullmatch(r"RT(\d+)", s["Codigo"])
        if not m:
            continue
        tcs = por_cod.get(f"TCS{m.group(1)}")
        if not tcs or tcs["Catalogo"] == CAT_LISTA:
            continue
        if not medidas_equivalentes(s, tcs):
            problemas["rt_tcs_divergente"].append((
                s["Codigo"], tcs["Codigo"],
                f"{s['Interno']}×{s['Externo']}×{s['Altura']}",
                f"{tcs['Interno']}×{tcs['Externo']}×{tcs['Altura']}",
            ))
            continue
        if not s["Modelo"] and tcs["Modelo"]:
            s["Modelo"] = tcs["Modelo"]
            s["Tipo"] = tcs["Tipo"]
            s["Aplicacao"] = tcs["Aplicacao"]
            s["Linha"] = tcs["Linha"]
        if not s["Material"] and tcs["Material"]:
            s["Material"] = tcs["Material"]
        if not s["Referencia"] and tcs["Referencia"]:
            s["Referencia"] = tcs["Referencia"]
        elif not tcs["Referencia"] and s["Referencia"]:
            tcs["Referencia"] = s["Referencia"]
        ex_rt, ex_tcs = parse_extras(s), parse_extras(tcs)
        if "Orientação do lábio" not in ex_rt and "Orientação do lábio" in ex_tcs:
            ex_rt["Orientação do lábio"] = ex_tcs["Orientação do lábio"]
        if "H1/H2" not in ex_rt and "H1/H2" in ex_tcs:
            ex_rt["H1/H2"] = ex_tcs["H1/H2"]
        ex_rt["Equivalente"] = tcs["Codigo"]
        ex_tcs["Equivalente"] = s["Codigo"]
        set_extras(s, ex_rt)
        set_extras(tcs, ex_tcs)
        tcs["NaLista"] = "S"
        casados.add(id(tcs))
        problemas["rt_tcs_vinculados"].append((s["Codigo"], tcs["Codigo"]))


def cruzar_listas(saida, itens, perfis, mods, problemas):
    """Marca NaLista, completa a descrição e inclui o que só existe na lista."""
    idx = {}
    for s in saida:
        idx.setdefault(chave(s["Codigo"]), []).append(s)
        # Referência só no catálogo de gaxetas: é o código Tipo B/STD (no de retentores é a REF de mercado)
        if s["Referencia"] and s["Catalogo"] == CAT_GAXETAS:
            idx.setdefault(chave(s["Referencia"]), []).append(s)

    def eh_polymax(it):
        return it["linha"] == "POLYMAX" or "POLYMAX" in it["descricao"].upper() or it["codigo"].endswith("PM")

    def achar(it):
        # Polymax e PU podem ter a mesma Referência (ex.: 25002250312BS): a seção POLYMAX da lista casa com a Polymax
        pm = eh_polymax(it)
        for c in (it["codigo"], re.sub(r"^AG\s?\d+-", "", it["codigo"])):  # "AG 7-4065" = 4065 da tabela AG 7
            cands = idx.get(chave(c))
            if cands:
                igual = next((s for s in cands if (s["Material"] == "Polymax") == pm), None)
                # item POLYMAX da lista sem a versão Polymax no catálogo: é outro produto, não a peça PU
                return igual if igual or not pm else None
        return None

    casados = set()

    def casar(it, s):
        """Marca a peça do catálogo como da lista. Mesmo código em duas tabelas (ex.: 7044PM em AG 14 e AG 4 (BS)):
        estar na lista é propriedade do código, então as linhas gêmeas também ficam em linha."""
        if s["Codigo"] in RET_LISTA_PREVALECE and s["Catalogo"] == CAT_RETENTORES:
            novo = retentor_da_lista(it, perfis, mods)
            problemas["ret_lista_prevalece"].append((
                s["Codigo"],
                f"{s['Modelo']} {s['Material']} {s['Interno']}×{s['Externo']}×{s['Altura']} p{s['Pagina']}",
                f"{novo['Modelo']} {novo['Material']} {novo['Interno']}×{novo['Externo']}×{novo['Altura']}",
                it["descricao"],
            ))
            casados.add(id(s))
            s.clear()
            s.update(novo)
            return
        for t in idx.get(chave(s["Codigo"]), []):
            if chave(t["Codigo"]) != chave(s["Codigo"]):
                continue
            casados.add(id(t))
            t["NaLista"] = "S"
            if not t["Descricao"]:
                t["Descricao"] = it["descricao"]
        d = dims_da_descricao(it["descricao"])
        if d:
            ex_s = parse_extras(s)
            for campo in ("Interno", "Externo", "Altura"):
                v = d[campo]
                cat = s[campo]
                if cat == "":
                    continue
                alvos = [v]
                if campo == "Altura" and "H1" in d:
                    alvos.append(d["H1"])
                if campo == "Externo" and "ØEXT" in d and "/" in d["ØEXT"]:
                    if (e2 := parse_mm(d["ØEXT"].split("/", 1)[1])) is not None:
                        alvos.append(e2)
                cats = [float(cat)]
                if campo == "Altura" and "H1/H2" in ex_s:
                    if (h1_cat := parse_h(ex_s["H1/H2"])[0]) is not None:
                        cats.append(h1_cat)
                if campo == "Externo" and "ØEXT" in ex_s and "/" in ex_s["ØEXT"]:
                    if (e2_cat := parse_mm(ex_s["ØEXT"].split("/", 1)[1])) is not None:
                        cats.append(e2_cat)
                if all(abs(c - x) > TOL_DIVERGENCIA for c in cats for x in alvos):
                    problemas["lista_vs_catalogo"].append((it["codigo"], s["Codigo"], it["descricao"], campo, float(cat), v))

    def casar_por_medida(it):
        """Código Tipo B/STD da lista que difere da Referência do catálogo por um dígito (ex.: 627601417-314 × 6-27601417312):
        casa pela medida da descrição quando sobra uma única gaxeta do catálogo com o mesmo perfil, material e medidas."""
        if it["linha"] not in ("GAXETA E RASPADOR", "POLYMAX") or not it["descricao"].upper().startswith("GAX"):
            return None
        cod = it["codigo"].upper().replace("-", "").replace(" ", "")
        bs = bool(re.search(r"BS(PMX?)?$", cod))
        digitos = re.sub(r"(BS)?(PMX?)?$", "", cod)
        if len(digitos) in (9, 12) and digitos.startswith("6"):  # prefixo 6 = peça métrica
            digitos = digitos[1:]
        if not digitos.isdigit():
            return None
        modelo = "AG 4 (BS)" if bs else {8: "STD", 11: "B"}.get(len(digitos))
        d = dims_da_descricao(it["descricao"])
        if not modelo or not d or any(d.get(c) is None for c in ("Interno", "Externo", "Altura")):
            return None
        pm = eh_polymax(it)
        cands = [s for s in saida if s["Catalogo"] == CAT_GAXETAS and s["Tipo"] == "Gaxeta" and s["Modelo"] == modelo
                 and (s["Material"] == "Polymax") == pm and id(s) not in casados
                 and all(s[c] != "" and abs(float(s[c]) - d[c]) <= TOL_DIVERGENCIA for c in ("Interno", "Externo", "Altura"))]
        return cands[0] if len(cands) == 1 else None

    # 1ª passagem: casa por código e aprende as siglas de perfil que o catálogo arquiva noutro perfil (ex.: BGO → BG)
    pendentes, aliases = [], {}
    for it in itens:
        s = achar(it)
        if not s:
            pendentes.append(it)
            continue
        sobrescrito = s["Codigo"] in RET_LISTA_PREVALECE and s["Catalogo"] == CAT_RETENTORES
        casar(it, s)
        if not sobrescrito and it["linha"] == "RETENTORES" and s["Modelo"]:
            sigla = sigla_antes_material(it["descricao"])
            if sigla and sigla != s["Modelo"] and sigla not in mods and not perfil_base(sigla, perfis):
                aliases.setdefault(sigla, set()).add(s["Modelo"])
    aliases = {k: next(iter(v)) for k, v in aliases.items() if len(v) == 1}  # só as sem ambiguidade
    # 2ª passagem: o que não casou por código tenta pela medida; o resto entra como item só da lista
    novos, tratados = {}, set()
    for it in pendentes:
        k = chave(it["codigo"])
        if k in tratados:  # a lista repete códigos entre linhas (ex.: POLYMAX)
            continue
        tratados.add(k)
        s = casar_por_medida(it)
        if s:
            casar(it, s)
            problemas["lista_casado_medida"].append((it["codigo"], s["Codigo"], s["Referencia"], it["descricao"]))
            continue
        problemas["lista_sem_catalogo"].append(it)
        novos[k] = item_da_lista(it, perfis, mods, problemas, aliases)
    todos = saida + [n for n in novos.values() if n]
    vincular_equivalentes_rt_tcs(todos, casados, problemas)
    problemas["catalogo_sem_lista"] = [s for s in saida if id(s) not in casados]
    return todos


RET_MATERIAIS = {"HNBR", "NBR", "FPM", "VITON", "MVQ", "ACM", "PTFE", "TEFLON", "PU", "EPDM", "FELTRO"}
_MAT_ATOM = r"HNBR|NBR|FPM|VITON|MVQ|ACM|PTFE|TEFLON|PU|EPDM|FELTRO"
_MAT_SEC = _MAT_ATOM + r"|NYLON|INOX"
RET_MAT_RE = re.compile(rf"\b(?:({_MAT_ATOM})(?:\s*/\s*({_MAT_SEC}))?|(INOX)\s*/\s*({_MAT_ATOM}))\b")
RET_NAO_PERFIL = RET_MATERIAIS | {"REF", "PC", "C", "FUROS", "AZUL", "PT", "INOX", "NYLON", "X", "RETENTOR", "RET", "HASTE", "VALVULA"}
# Letra de variante do perfil (BRGF, BAS, GRP) vale como material quando a descrição não o traz
RET_VARIANTE_MATERIAL = {"F": "FPM", "S": "MVQ", "P": "ACM"}  # no índice 2021, toda variante P é ACM (poliacrilato)


def sigla_antes_material(desc):
    """Única sigla entre as medidas e o material da descrição ("… 8,50 AGNA NBR/NYLON" → AGNA), ou "".
    Duas siglas ("BRG AH FPM", "DUPLO LABIO NBR") não decidem; orientação do lábio e NYLON não são perfil."""
    d = desc.upper()
    m = DESC_DIM_RE.search(re.sub(r"(\d)\s+\.(\d)", r"\1.\2", d))
    cauda = d[m.end():] if m else d
    mat = RET_MAT_RE.search(cauda)
    if not m or not mat:
        return ""
    sigla = re.fullmatch(r"\s*-?\s*([A-Z]{2,6}\d?)\s*-?\s*", cauda[:mat.start()])
    if sigla and sigla.group(1) not in RET_NAO_PERFIL | set(ORIENTACAO):
        return sigla.group(1)
    return ""


def retentor_da_lista(it, perfis, mods, problemas=None, aliases=None):
    """Retentor que só existe na lista: perfil e material pela descrição."""
    aliases = aliases or {}
    desc = it["descricao"].upper()
    desc = re.sub(r"\b([A-Z]{2,6})-([FSP])\b", r"\1\2", desc)  # "BRG-F" = BRGF (variante de material)
    d_busca = re.sub(r"(\d)\s+\.(\d)", r"\1.\2", desc)
    m = DESC_DIM_RE.search(d_busca)
    if not m:
        d_busca = re.sub(r"(\d,\d+)\s+(\d+,\d+(?:/\d+(?:,\d+)?)?)\b", r"\1 X \2", d_busca)
        m = DESC_DIM_RE.search(d_busca)
    cauda = d_busca[m.end():] if m else d_busca
    # perfil = primeira palavra que é perfil do catálogo ("PIVO TRACAO" não é)
    conhecido = lambda t: t not in RET_NAO_PERFIL and (t in mods or perfil_base(t, perfis))
    tok_re = r"\b[A-Z]{1,6}\d?(?:-[A-Z0-9])?\b"
    perfil = next((t for t in re.findall(tok_re, cauda) if conhecido(t)), "")
    if not perfil and m:  # "RETENTOR K7 35,00 X …": perfil antes das medidas
        perfil = next((t for t in re.findall(tok_re, d_busca[:m.start()]) if conhecido(t)), "")
    mat = RET_MAT_RE.search(cauda)
    inferido = False
    if not perfil:
        # Perfil sem página no catálogo 2021 (AGNA, BRGH, GY…): a única sigla entre as medidas e o material.
        # Se o catálogo arquiva essa sigla noutro perfil (BGO → BG, aprendido nos itens casados), vira Variante dele.
        sigla = sigla_antes_material(desc)
        if sigla:
            perfil, inferido = sigla, sigla not in aliases
    material = ""
    if mat:
        partes = [x.replace("VITON", "FPM").replace("TEFLON", "PTFE") for x in mat.groups() if x]
        if len(partes) == 2 and partes[0] == "INOX":
            partes = [partes[1], "INOX"]
        material = "/".join(partes)
    ref = re.search(r"REF[.:]?\s*(\d{5})", desc)
    modelo = perfil_base(perfil, perfis) or aliases.get(perfil) or perfil
    if not material and modelo and modelo != perfil:
        # variante de material sem material na descrição: BRF, BRGF, BRGGF → FPM
        material = RET_VARIANTE_MATERIAL.get(re.sub(r"-?\d+$", "", perfil)[len(modelo):], "")
    tipo = tipo_retentor(modelo, perfis)[0] if modelo else "Retentor"
    if problemas is not None:
        if perfil and perfil in aliases:
            problemas["lista_perfil_alias"].append((it["codigo"], perfil, modelo))
        elif inferido:
            problemas["lista_perfil_novo"].setdefault((modelo, tipo), []).append(it["codigo"])
    dims = dims_da_descricao(desc) or {}
    extras = {}
    if modelo != perfil:
        extras["Variante"] = perfil
    if "ØEXT" in dims:
        extras["ØEXT"] = dims["ØEXT"]
    if "H1/H2" in dims:
        extras["H1/H2"] = dims["H1/H2"]
    return {
        "Codigo": it["codigo"], "Referencia": ref.group(1) if ref else "", "Tipo": tipo, "Modelo": modelo,
        "Material": material, "Aplicacao": HASTE if tipo == "Raspador" else EIXO,
        "Linha": "Hidráulica" if tipo == "Raspador" else "Retentores",
        "Interno": r4(dims.get("Interno")), "Externo": r4(dims.get("Externo")), "Altura": r4(dims.get("Altura")),
        "UnidadeNominal": "mm", "PressaoPsi": "", "TempMin": "", "TempMax": "", "VelocidadeMs": "",
        "Extras": "|".join(f"{k}={v}" for k, v in extras.items()), "Descricao": it["descricao"], "NaLista": "S",
        "Fonte": "lista2025", "Catalogo": CAT_LISTA, "Pagina": "",
    }


def item_da_lista(it, perfis, mods, problemas, aliases):
    """Produto que existe só na lista 2025: facetas pela descrição, medidas pelo código ou descrição."""
    desc, cod = it["descricao"].upper(), it["codigo"].upper()
    if it["linha"] == "RETENTORES" or desc.startswith(("RETENTOR", "RET.", "RET,")):
        return retentor_da_lista(it, perfis, mods, problemas, aliases)
    pneumatica = it["linha"] == "PNEUMÁTICA"
    if desc.startswith(("GAX", "CONJUNTO GAX")):
        tipo, linha = "Gaxeta", "pneumatica" if pneumatica else "gaxeta"
    elif desc.startswith(("RASP", "RAPADOR")):
        tipo, linha = "Raspador", "pneumatica" if pneumatica else "raspador"
    elif desc.startswith("REPARO") and pneumatica:
        tipo, linha = "Reparo pneumático", None
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
    elif re.search(r"\bSTD\b", desc):
        modelo = "STD"
    # Perfil pelo código só quando o padrão é exclusivo no catálogo.
    # "6" + SSS IIIII HHH sem sufixo é B ou STD: fica em branco (relatório).
    elif re.search(r"BS(PMX?)?$", cod):
        modelo = "AG 4 (BS)"
    elif linha == "raspador" and re.match(r"66?D-\d{4}", cod):
        modelo = "6D/66D"
    elif linha == "raspador" and re.match(r"D-\d{4}", cod):
        modelo = "D"
    codigo_limpo = re.sub(r"(BS)?(PMX?)?$", "", cod.replace("-", ""))
    pattern = None
    if linha in ("gaxeta", "raspador") and re.fullmatch(r"\d{8}", codigo_limpo):
        pattern, modelo = "std8", modelo or "STD"
    elif linha in ("gaxeta", "raspador") and re.fullmatch(r"\d{11}", codigo_limpo):
        pattern, modelo = "b11", modelo or "B"
    if modelo == "AG 4":
        modelo = "AG 4 (BS)"
    if linha == "pneumatica":
        tipo = tipo_do_modelo(linha, modelo)

    polymax = it["linha"] == "POLYMAX" or "POLYMAX" in desc or bool(re.search(r"PMX?$", cod))
    if polymax:
        material = "Polymax"
    elif it["linha"] == "GAXETAS GSK" or "GSK" in desc:
        material = "GSK"
    elif m := re.search(r"\b(PU|NBR|MVQ|VITON|FKM)\b", desc):
        material = m.group(1)
    else:
        material = MATERIAL_PADRAO.get((linha, modelo), "") if linha else ""

    dims = (decode_ref(codigo_limpo, pattern) if pattern else None) or dims_da_descricao(desc) or {}
    if "H1" in dims:  # como no catálogo de gaxetas: Altura = H1
        dims["Altura"] = dims["H1"]
    aplic = APLICACOES.get((linha, modelo), []) if linha else []
    if not aplic and tipo == "Raspador":  # raspador trabalha na haste
        aplic = [HASTE]
    ficha = (FICHA.get((linha, modelo, polymax)) or FICHA.get((linha, modelo, False))) if linha else None
    ficha = ficha or (None, None, None, None)
    return {
        "Codigo": it["codigo"], "Referencia": "", "Tipo": tipo, "Modelo": modelo, "Material": material,
        "Aplicacao": ",".join(aplic),
        "Linha": "Pneumática" if pneumatica else "Hidráulica" if linha else "",
        "Interno": r4(dims.get("Interno")), "Externo": r4(dims.get("Externo")), "Altura": r4(dims.get("Altura")),
        "UnidadeNominal": "pol" if re.search(r"\d/\d", desc) and "," not in desc else "mm",
        "PressaoPsi": ficha[0] if ficha[0] is not None else "", "TempMin": ficha[1] if ficha[1] is not None else "",
        "TempMax": ficha[2] if ficha[2] is not None else "", "VelocidadeMs": ficha[3] if ficha[3] is not None else "",
        "Extras": f"H1/H2={dims['H1/H2']}" if "H1/H2" in dims else "", "Descricao": it["descricao"], "NaLista": "S",
        "Fonte": "codigo" if pattern and dims else "lista2025", "Catalogo": CAT_LISTA, "Pagina": "",
    }


def ler_legado():
    """Mapeia códigos das CSVs antigas para detectar sobreposição com o APC."""
    leg = {}
    for f in sorted(LEGACY_DIR.glob("*.csv")):
        if f == OUT_CSV:  # CSVs antigas = <tipo>-<perfil>.csv; o gerado fica de fora
            continue
        with open(f, encoding="utf-8") as fh:
            linhas = [l for l in fh if not l.startswith("#")]
        for row in csv.DictReader(linhas, delimiter=";"):
            c = (row.get("Codigo") or "").strip()
            if c:
                leg.setdefault(chave(c), []).append((f.name, c, row))
    return leg


def ler_anterior():
    """CSV versionado no último commit (para o relatório de mudanças); vazio fora do git."""
    try:
        txt = subprocess.run(["git", "show", f"HEAD:{OUT_CSV.relative_to(ROOT).as_posix()}"], cwd=ROOT,
                             capture_output=True, text=True, encoding="utf-8", check=True).stdout
    except (OSError, subprocess.CalledProcessError):
        return []
    return list(csv.DictReader(io.StringIO(txt), delimiter=";"))


CAMPOS = ["Codigo", "Referencia", "Tipo", "Modelo", "Material", "Aplicacao", "Linha", "Interno", "Externo",
          "Altura", "UnidadeNominal", "PressaoPsi", "TempMin", "TempMax", "VelocidadeMs", "Extras",
          "Descricao", "NaLista", "Fonte", "Catalogo", "Pagina"]


def agrupar_metalicos(saida):
    for s in saida:
        if s["Tipo"] == "Raspador" and s["Modelo"] in PERFIS_METALICOS:
            s["Tipo"] = TIPO_RASPADOR_METALICO
    return saida


TIPO_ANEL, PERFIL_ORING = "Anel", "O-ring"


def ler_oring(saida, caminho=ORING_CSV):
    """Anéis O-ring da lista 01/2025: D.I. = Ø interno, W = altura e seção; sem aplicação (genérico)."""
    existentes = {chave(s["Codigo"]) for s in saida}
    with open(caminho, encoding="utf-8", newline="") as fh:
        linhas = list(csv.DictReader(fh, delimiter=";"))
    repetidos = sorted(r["Codigo"] for r in linhas if chave(r["Codigo"]) in existentes)
    if repetidos:
        sys.exit(f"O-ring com código que já existe nos catálogos/listas: {repetidos[:20]}")
    aneis = []
    for r in linhas:
        di, w = float(r["DI"]), float(r["W"])
        aneis.append({
            "Codigo": r["Codigo"], "Referencia": "", "Tipo": TIPO_ANEL, "Modelo": PERFIL_ORING,
            "Material": r["Material"], "Aplicacao": "", "Linha": "",
            "Interno": r4(di), "Externo": r4(di + 2 * w), "Altura": r4(w), "UnidadeNominal": "mm",
            "PressaoPsi": "", "TempMin": "", "TempMax": "", "VelocidadeMs": "",
            "Extras": f"Série={r['Serie']}",
            "Descricao": f"O-RING {r['Serie'].upper()} {fmt(di)} X {fmt(w)}",
            "NaLista": "S", "Fonte": "lista2025", "Catalogo": CAT_LISTA, "Pagina": r["Pagina"],
        })
    return aneis


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


def fmt_opt(v):
    return "—" if v is None else fmt(v) if isinstance(v, float) else str(v)


def mudancas(anterior, saida):
    """Códigos que entraram/saíram e medidas/facetas que mudaram em relação ao CSV anterior."""
    ant = {chave(r["Codigo"]): r for r in anterior}
    nov = {chave(s["Codigo"]): s for s in saida}
    por_ref = {chave(s["Referencia"]): s for s in saida if s["Referencia"] and s["Catalogo"] == CAT_GAXETAS}
    # código antigo que agora é a Referência de uma peça do catálogo (componente da pág. 66, item da lista)
    viraram_ref = [(ant[k], por_ref[k]) for k in ant if k not in nov and k in por_ref]
    sairam = [ant[k] for k in ant if k not in nov and k not in por_ref]
    entraram = [nov[k] for k in nov if k not in ant]
    mudou = []
    for k in ant.keys() & nov.keys():
        a, n = ant[k], nov[k]
        for campo in ("Tipo", "Modelo", "Material", "Aplicacao", "Interno", "Externo", "Altura"):
            va, vn = str(a.get(campo, "")), str(n.get(campo, ""))
            try:
                if abs(float(va) - float(vn)) <= TOL_DIVERGENCIA:
                    continue
            except ValueError:
                pass
            if va != vn:
                mudou.append((n["Codigo"], campo, va or "—", vn or "—"))
    return sairam, entraram, mudou, viraram_ref


def escrever_relatorio(saida, problemas, legado, anterior):
    L = ["# Relatório de ingestão — catálogos APC", "",
         "Gerado por `scripts/ingest_catalogos.py`. Não editar à mão.", "",
         "Fontes: catálogo de gaxetas e raspadores ref. 2022 (`gaxetas-2022`), catálogo de retentores "
         "ref. 2021 (`retentores-2021`) e listas AGEL 2025 (`lista-2025`), incluindo a lista de anéis "
         "O-ring ref. 01/2025 (extrato sem preço em `docs/catalogos/listas/lista-oring-2025.csv`).", ""]
    # contagens
    from collections import Counter
    cont = Counter((s["Tipo"], s["Modelo"], s["Material"] or "—", s["Linha"]) for s in saida)
    por_cat = Counter(s["Catalogo"] for s in saida)
    L += ["## Itens por modelo", "", f"Total: **{len(saida)}** itens "
          f"({', '.join(f'{c}: {n}' for c, n in sorted(por_cat.items()))}).", "",
          "| Tipo | Modelo | Material | Linha | Itens |", "|---|---|---|---|---|"]
    L += [f"| {t} | {m} | {mat} | {li} | {n} |" for (t, m, mat, li), n in sorted(cont.items())]

    sairam, entraram, mudou, viraram_ref = mudancas(anterior, saida)
    L += ["", "## Mudanças em relação ao CSV do último commit", "",
          f"- Saíram: **{len(sairam)}** · Entraram: **{len(entraram)}** · Campos alterados: **{len(mudou)}**",
          f"- Viraram Referência de uma peça do catálogo (continuam pesquisáveis pela peça): **{len(viraram_ref)}**", ""]
    if sairam:
        L += ["### Saíram", "", "| Código | Tipo | Modelo | Material | Medidas (mm) | Fonte anterior |", "|---|---|---|---|---|---|"]
        L += [f"| `{r['Codigo']}` | {r['Tipo']} | {r['Modelo']} | {r['Material']} | "
              f"{r['Interno'] or '—'} × {r['Externo'] or '—'} × {r['Altura'] or '—'} | {r.get('Fonte', '')} p{r.get('Pagina', '')} |"
              for r in sorted(sairam, key=lambda r: (r["Tipo"], r["Modelo"], r["Codigo"]))]
        L += [""]
    if viraram_ref:
        L += ["### Viraram Referência", "", "| Código antigo | Peça no catálogo | Tipo | Modelo |", "|---|---|---|---|"]
        L += [f"| `{a['Codigo']}` | `{n['Codigo']}` p{n['Pagina']} | {n['Tipo']} | {n['Modelo']} |"
              for a, n in sorted(viraram_ref, key=lambda x: x[0]["Codigo"])]
        L += [""]
    if mudou:
        L += ["### Campos alterados", "", "| Código | Campo | Antes | Agora |", "|---|---|---|---|"]
        L += [f"| `{c}` | {campo} | {a} | {n} |" for c, campo, a, n in sorted(mudou)]
        L += [""]
    if entraram:
        cont_e = Counter((s["Catalogo"], s["Tipo"]) for s in entraram)
        L += ["### Entraram (por catálogo e tipo)", "", "| Catálogo | Tipo | Itens |", "|---|---|---|"]
        L += [f"| {c} | {t} | {n} |" for (c, t), n in sorted(cont_e.items())]

    oring = [s for s in saida if s["Tipo"] == TIPO_ANEL and s["Modelo"] == PERFIL_ORING]
    cont_o = Counter((s["Extras"].split("=", 1)[1], s["Material"]) for s in oring)
    L += ["", "## Anéis O-ring (lista 01/2025)", "",
          f"**{len(oring)}** anéis, todos em linha (`NaLista=S`). D.I. = Ø interno; W = altura e seção; "
          "ØEXT = D.I. + 2·W. Sem aplicação (genéricos). Kit O-rings e Backup ficam de fora.", "",
          "| Série | Material | Itens |", "|---|---|---|"]
    L += [f"| {serie} | {mat} | {n} |" for (serie, mat), n in sorted(cont_o.items())]

    L += ["", f"## Código da referência × valor impresso (> {fmt(TOL_DIVERGENCIA)} mm)", "",
          "O CSV usa o valor do **código** (fonte da verdade).", ""]
    if problemas["codigo_vs_impresso"]:
        L += ["| Pág. | Modelo | Nº AGEL | Referência | Campo | Impresso (mm) | Código (mm) |", "|---|---|---|---|---|---|---|"]
        L += [f"| {p} | {m} | {a} | {r} | {c} | {fmt(i)} | {fmt(v)} |" for p, m, a, r, c, i, v in problemas["codigo_vs_impresso"]]
    else:
        L += ["Nenhuma divergência."]

    L += ["", "## Linhas sem Nº AGEL (Código = Referência)", ""]
    L += [f"- pág. {p} · {m} · `{r}`" for p, m, r in problemas["sem_agel"]] or ["Nenhuma."]

    L += ["", "## Componentes pneumáticos (pág. 66) fundidos à peça da tabela", "",
          "A pág. 66 repete pela REFERÊNCIA peças das págs. 62–65; a descrição vai para a peça e não vira linha separada.", ""]
    L += [f"{len(problemas['componentes_fundidos'])} códigos: " + ", ".join(f"`{c}`" for c in problemas["componentes_fundidos"])
          if problemas["componentes_fundidos"] else "Nenhum."]

    L += ["", "## Mesmo código em mais de uma tabela", ""]
    L += [f"- `{c}`: {', '.join(lst)}" for c, lst in problemas["duplicados_catalogo"]] or ["Nenhum."]

    L += ["", "## Retentores: índice × páginas de perfil", "",
          "O CSV usa o **índice** (págs. 84–111). Divergência = mesmo código com valor diferente na página do perfil.", ""]
    if problemas["ret_indice_vs_pagina"]:
        L += ["| Código | Campo | Índice | Página do perfil | Pág. índice | Pág. perfil |", "|---|---|---|---|---|---|"]
        L += [f"| `{c}` | {campo} | {fmt_opt(a)} | {fmt_opt(b)} | {pi} | {pp} |" for c, campo, a, b, pi, pp in problemas["ret_indice_vs_pagina"]]
    else:
        L += ["Nenhuma divergência."]
    L += ["", "### Só nas páginas de perfil (fora do índice; incluídos)", ""]
    L += [f"- pág. {p} · {m} · `{c}`" for p, m, c in problemas["ret_so_pagina"]] or ["Nenhum."]
    L += ["", "### Só no índice (sem página de perfil)", ""]
    L += [f"- pág. {p} · {m} · `{c}`" for p, m, c in problemas["ret_so_indice"]] or ["Nenhum."]
    L += ["", "### Código repetido (fica a primeira ocorrência)", ""]
    L += [f"- pág. {p} · {m} · `{c}`" for p, m, c in problemas["ret_repetidos"]] or ["Nenhum."]
    L += ["", "### Itens BLOQUEADOS no catálogo (fora do painel)", ""]
    L += [f"- pág. {p} · `{raw}`" for p, raw in problemas["ret_bloqueados"]] or ["Nenhum."]
    L += ["", "### Erratas aplicadas (retentores 2021)", ""]
    if problemas["ret_erratas"]:
        L += ["| Código | Motivo |", "|---|---|"]
        L += [f"| `{c}` | {RET_ERRATA[c][1]} |" for c in sorted(problemas["ret_erratas"])]
    else:
        L += ["Nenhuma."]
    L += ["", "### Perfis sem página própria (tipo inferido)", "",
          "Variantes de material (sufixo F/S/P = FPM/MVQ/ACM) seguem o perfil-base. Estes não têm base com página:", ""]
    L += [f"- {m} → {t}" for m, t in sorted(problemas["ret_tipo_inferido"])] or ["Nenhum."]

    L += ["", "## Mesmo código nos dois catálogos (o de gaxetas prevalece, salvo consenso ret+lista)", ""]
    if problemas["consenso_catalogos"]:
        L += ["### Resolvidas por consenso (retentores 2021 + lista 2025 contra gaxetas 2022)", "",
              "| Código | Campo | Gaxetas 2022 | Adotado (ret+lista) | Descrição lista 2025 |", "|---|---|---|---|---|"]
        L += [f"| `{c}` | {campo} | {a} | {n} | {d} |" for c, campo, a, n, d in sorted(problemas["consenso_catalogos"])]
        L += [""]
    if problemas["entre_catalogos"]:
        L += ["| Código | Gaxetas 2022 | Retentores 2021 | Divergências |", "|---|---|---|---|"]
        L += [f"| `{c}` | {g} | {r} | {', '.join(d) or '—'} |" for c, g, r, d in problemas["entre_catalogos"]]
    else:
        L += ["Nenhum."]

    L += ["", "## Sobreposição com as CSVs antigas (o APC prevalece no painel)", ""]
    sobre = []
    for s in saida:
        for arq, c, row in legado.get(chave(s["Codigo"]), []):
            sobre.append(f"| `{c}` | {arq} | {s['Tipo']} {s['Modelo']} {s['Material']} |")
    if sobre:
        L += [f"{len(sobre)} códigos.", "", "| Código | CSV antiga | APC |", "|---|---|---|"] + sobre
    else:
        L += ["Nenhuma."]

    L += ["", "## Listas 2025 × catálogos", "",
          "Cruzamento por código (ou Referência Tipo B/STD; hífens ignorados). Só código e descrição são lidos.", "",
          "As listas 2025 são a **fonte mestra** do que está em linha: item dos catálogos que não está nelas fica no CSV "
          "com `NaLista` vazio e **não aparece no painel** (`DatabaseService.loadData`).", ""]
    n_cat = sum(1 for s in saida if s["Catalogo"] != CAT_LISTA)
    fora = problemas["catalogo_sem_lista"]
    L += [f"- Itens dos catálogos encontrados nas listas: **{sum(1 for s in saida if s['NaLista'] and s['Catalogo'] != CAT_LISTA)}** de {n_cat}",
          f"- Itens dos catálogos fora das listas 2025 (ocultos no painel): **{len(fora)}**",
          f"- Itens da lista casados pela medida (código ≠ Referência do catálogo): **{len(problemas['lista_casado_medida'])}**",
          f"- Itens das listas sem correspondência nos catálogos: **{len(problemas['lista_sem_catalogo'])}**",
          f"- Códigos reutilizados (lista 2025 prevalece sobre retentores 2021): **{len(problemas['ret_lista_prevalece'])}**",
          f"- Equivalências `RTxxxx` ↔ `TCSxxxx` vinculadas (ambos em linha): **{len(problemas['rt_tcs_vinculados'])}**"
          + (f" (não vinculadas por divergência de medida: **{len(problemas['rt_tcs_divergente'])}**)"
             if problemas["rt_tcs_divergente"] else ""), ""]
    if problemas["ret_lista_prevalece"]:
        L += ["### Códigos reutilizados na lista 2025 (prevalecem sobre retentores 2021)", "",
              "| Código | Catálogo 2021 (substituído) | Lista 2025 (adotado) | Descrição lista 2025 |", "|---|---|---|---|"]
        L += [f"| `{c}` | {ant} | {nov} | {d} |" for c, ant, nov, d in sorted(problemas["ret_lista_prevalece"])]
        L += [""]
    if problemas["rt_tcs_divergente"]:
        L += ["### `RTxxxx` × `TCSxxxx` não vinculados (medidas divergentes)", "",
              "| Código RT | Código TCS | Medidas RT (mm) | Medidas TCS (mm) |", "|---|---|---|---|"]
        L += [f"| `{a}` | `{b}` | {ma} | {mb} |" for a, b, ma, mb in sorted(problemas["rt_tcs_divergente"])]
        L += [""]
    L += ["### Medida da descrição (lista) × catálogo", ""]
    if problemas["lista_vs_catalogo"]:
        L += ["| Código lista | Código catálogo | Descrição | Campo | Catálogo (mm) | Descrição (mm) |", "|---|---|---|---|---|---|"]
        L += [f"| `{a}` | `{b}` | {d} | {c} | {fmt(x)} | {fmt(y)} |" for a, b, d, c, x, y in problemas["lista_vs_catalogo"]]
    else:
        L += ["Nenhuma divergência."]
    L += ["", "### Itens das listas que não estão nos catálogos (incluídos com Catalogo=lista-2025)", ""]
    if problemas["lista_sem_catalogo"]:
        L += ["| Código | Lista | Linha | Descrição |", "|---|---|---|---|"]
        L += [f"| `{i['codigo']}` | {i['arquivo']} | {i['linha']} | {i['descricao']} |" for i in problemas["lista_sem_catalogo"]]
    else:
        L += ["Nenhum."]
    L += ["", "### Casados pela medida (código da lista ≠ Referência do catálogo; confirmar)", "",
          "Código Tipo B/STD da lista sem correspondência exata: casou com a única gaxeta do catálogo de mesmo perfil, "
          "material e medidas. Provável erro de dígito numa das fontes.", ""]
    if problemas["lista_casado_medida"]:
        L += ["| Código lista | Código catálogo | Referência catálogo | Descrição |", "|---|---|---|---|"]
        L += [f"| `{a}` | `{b}` | `{r}` | {d} |" for a, b, r, d in problemas["lista_casado_medida"]]
    else:
        L += ["Nenhum."]
    L += ["", "### Itens dos catálogos fora das listas 2025 (ficam no CSV, ocultos no painel)", "",
          "Tratados como fora de linha. Continuam no CSV para o histórico e para seguir sobrepondo as CSVs antigas "
          "(coluna CSV antiga = o mesmo código existe numa CSV antiga e continua suprimido).", ""]
    if fora:
        med = lambda v: fmt(float(v)) if v not in ("", None) else "—"
        cont_f = Counter((s["Catalogo"], s["Tipo"]) for s in fora)
        L += ["| Catálogo | Tipo | Itens |", "|---|---|---|"]
        L += [f"| {c} | {t} | {n} |" for (c, t), n in sorted(cont_f.items())]
        L += ["", "| Código | Catálogo | Tipo | Modelo | Material | Medidas (mm) | CSV antiga |", "|---|---|---|---|---|---|---|"]
        L += [f"| `{s['Codigo']}` | {s['Catalogo']} | {s['Tipo']} | {s['Modelo'] or '—'} | {s['Material'] or '—'} | "
              f"{med(s['Interno'])} × {med(s['Externo'])} × {med(s['Altura'])} | "
              f"{', '.join(sorted({arq for arq, _, _ in legado.get(chave(s['Codigo']), [])})) or '—'} |"
              for s in sorted(fora, key=lambda s: (s["Catalogo"], s["Tipo"], s["Modelo"], s["Codigo"]))]
    else:
        L += ["Nenhum."]
    L += ["", "### Perfis só na lista 2025 (sem página no catálogo 2021; tipo inferido)", "",
          "Única sigla entre as medidas e o material na descrição. Confirmar perfil e tipo.", ""]
    L += [f"- {p} → {t} · " + ", ".join(f"`{c}`" for c in cods)
          for (p, t), cods in sorted(problemas["lista_perfil_novo"].items())] or ["Nenhum."]
    L += ["", "Siglas que o catálogo arquiva noutro perfil (ficam como Variante do perfil do catálogo):", ""]
    L += [f"- `{c}` · {sig} → {mod}" for c, sig, mod in sorted(problemas["lista_perfil_alias"])] or ["Nenhuma."]

    L += ["", "## Modelos sem ficha/aplicação no manifesto", ""]
    L += [f"- pág. {p} · {li} · {m} · polymax={pm}" for p, li, m, pm in sorted(problemas["sem_manifesto"])] or ["Nenhum."]
    L += ["", "## Linhas não extraídas", "", "Página com prefixo R = catálogo de retentores.", ""]
    L += [f"- pág. {p} · {m} · `{raw}`" for p, m, raw in problemas["nao_extraidas"]] or ["Nenhuma."]
    sem_perfil = [s for s in saida if s["Tipo"] in ("Gaxeta", "Raspador", TIPO_RASPADOR_METALICO, "Retentor") and not s["Modelo"]]
    L += ["", "## Perfil a confirmar", "",
          "Só na lista 2025, sem perfil na descrição nem código exclusivo. No filtro de Perfil aparecem como `—` ('Não informado', "
          "último da lista); os sem medida (ver 'Medida incompleta') só pela busca por código.", ""]
    L += [f"- `{s['Codigo']}` · {s['Descricao']}" for s in sem_perfil] or ["Nenhum."]
    sem_medida = [s for s in saida if s["Tipo"] in ("Gaxeta", "Raspador", TIPO_RASPADOR_METALICO, "Retentor")
                  and not (s["Interno"] and s["Externo"] and s["Altura"])]
    L += ["", "## Medida incompleta", "", "Aparecem na busca por código, mas não em todas as buscas por medida.", ""]
    L += [f"- `{s['Codigo']}` · {s['Catalogo']} · {s['Descricao'] or s['Modelo']}" for s in sem_medida] or ["Nenhum."]
    L += ["", "## Pendências conhecidas (dados antigos)", "",
          "- `conjunto-bp.csv`: colunas Externo/Interno parecem trocadas em parte das linhas.",
          "- Raspadores D, 6D/66D, 900D, K, RP-25, DG e E não têm coluna MATERIAL: PU por inferência (faixa -30/+100 °C).",
          "- Linha pneumática não informa material (exceto Z = borracha); fica em branco.",
          "- Retentores não têm ficha de pressão/temperatura no catálogo.",
          "- Tabela de conversão do Drive: `11 1/2` = 292,10 (não 292,70); `18 1/4` = 463,55; `22` = 558,80; falta `27/32` (21,43)."]
    OUT_REPORT.write_text("\n".join(L) + "\n", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalogo", default=str(CATALOGO_PDF))
    ap.add_argument("--retentores", default=str(RETENTORES_PDF))
    ap.add_argument("--listas", nargs="*", default=[str(p) for p in LISTAS_PDF])
    ap.add_argument("--oring", default=str(ORING_CSV))
    a = ap.parse_args()

    problemas = {"codigo_vs_impresso": [], "sem_agel": [], "nao_extraidas": [], "sem_manifesto": set(),
                 "duplicados_catalogo": [], "lista_sem_catalogo": [], "lista_vs_catalogo": [],
                 "catalogo_sem_lista": [], "ret_indice_vs_pagina": [], "ret_so_pagina": [], "ret_so_indice": [],
                 "ret_tipo_inferido": set(), "entre_catalogos": [], "componentes_fundidos": [],
                 "ret_bloqueados": [], "lista_perfil_novo": {}, "lista_perfil_alias": [], "lista_casado_medida": [],
                 "ret_erratas": set(), "consenso_catalogos": [], "ret_lista_prevalece": [],
                 "rt_tcs_vinculados": [], "rt_tcs_divergente": []}
    anterior = ler_anterior()
    gaxetas = fundir_componentes(montar(extrair_catalogo(a.catalogo, problemas), problemas), problemas)
    perfis, pag_rows, indice = extrair_retentores(a.retentores, problemas)
    retentores = montar_retentores(perfis, pag_rows, indice, problemas)
    duplicados(gaxetas, problemas)
    duplicados(retentores, problemas)
    itens = [it for f in a.listas for it in extrair_lista(f)]
    mods = {r["mod"] for r in indice + pag_rows}
    saida = juntar_catalogos(gaxetas, retentores, itens, perfis, mods, problemas)
    saida = agrupar_metalicos(cruzar_listas(saida, itens, perfis, mods, problemas))
    saida += ler_oring(saida, a.oring)  # depois do cruzamento: a lista de O-rings não tem catálogo para casar
    escrever_csv(saida)
    escrever_relatorio(saida, problemas, ler_legado(), anterior)

    from collections import Counter
    print(f"itens: {len(saida)}")
    for k, n in sorted(Counter((s['Catalogo'], s['Tipo']) for s in saida).items()):
        print(f"  {k[0]:<16} {k[1]:<18} {n}")
    print({k: len(v) for k, v in problemas.items()})
    print(f"listas 2025: {len(itens)} linhas; casados com catálogo: "
          f"{sum(1 for s in saida if s['NaLista'] and s['Catalogo'] != CAT_LISTA)}; "
          f"só na lista: {len(problemas['lista_sem_catalogo'])}; "
          f"fora da lista (ocultos no painel): {len(problemas['catalogo_sem_lista'])}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
