# Génère les logos kontrolshop de public/marque/ (SVG, texte converti en
# tracés avec la police Inter, donc pareils sur tous les écrans).
# Usage : pip install fonttools && python3 scripts/logos-kontrolshop.py public/marque
# Les couleurs doivent suivre SECTEURS dans lib/marque.js.
import sys, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

D = "/usr/share/fonts/opentype/inter/"
POLICES = {k: TTFont(D + f) for k, f in {"xb": "InterDisplay-ExtraBold.otf", "rg": "InterDisplay-Regular.otf", "md": "Inter-Medium.otf"}.items()}

def texte(cle, chaine, taille, x0, base, tracking=0.0):
    """Tracé SVG d'une chaîne (avance + crénage simple), renvoie (d, largeur)."""
    f = POLICES[cle]; gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f["head"].unitsPerEm
    k = taille / upm; x = x0; pen = SVGPathPen(gs)
    for i, c in enumerate(chaine):
        g = cmap[ord(c)]
        gs[g].draw(TransformPen(pen, (k, 0, 0, -k, x, base)))
        x += gs[g].width * k + (tracking * taille if i < len(chaine) - 1 else 0)
    return pen.getCommands(), x - x0

def largeur(cle, chaine, taille, tracking=0.0):
    return texte(cle, chaine, taille, 0, 0, tracking)[1]

SECTEURS = {
    "kontrolshop": (None, "#e07338"),
    "garage": ("GARAGE", "#e07338"),
    "ferme": ("FERME", "#457a3c"),
    "copropriete": ("COPROPRIÉTÉ", "#2f6db5"),
    "boutique": ("BOUTIQUE", "#c2416b"),
    "premium": ("PREMIUM", "#b8902f"),
}
SOMBRE = {"ferme": "#5e9e52", "copropriete": "#4a88d0", "boutique": "#d4567f", "premium": "#cfa646"}
THEMES = {
    "clair": {"encre": "#212833", "shop": "#5a6470", "arc": "#a0a7b2"},
    "sombre": {"encre": "#f3f4f6", "shop": "#a0a7b2", "arc": "#5a6470"},
}

def marque_k(t, accent, x, y, h):
    """Le K à aiguille, mis à l'échelle h (hauteur de la boîte 240×292)."""
    s = h / 292
    return (f'<g transform="translate({x:.2f} {y:.2f}) scale({s:.5f}) translate(-478 -240)">'
            f'<path d="M 632 254 A 162 162 0 0 1 632 520" fill="none" stroke="{t["arc"]}" stroke-width="7" stroke-linecap="round" stroke-dasharray="5 15"/>'
            f'<rect x="493" y="267" width="47" height="240" rx="4" fill="{t["encre"]}"/>'
            f'<polygon points="551,409 576,383 686,487 654,518" fill="{t["encre"]}"/>'
            f'<line x1="560" y1="370" x2="660" y2="286" stroke="{accent}" stroke-width="22" stroke-linecap="round"/>'
            f'<circle cx="540" cy="387" r="17.5" fill="none" stroke="{accent}" stroke-width="17"/></g>')

def nom(t, x, base, F):
    trk = -0.03
    d1, w1 = texte("xb", "kontrol", F, x, base, trk)
    d2, w2 = texte("rg", "shop", F, x + w1 + trk * F, base, trk)
    return f'<path d="{d1}" fill="{t["encre"]}"/><path d="{d2}" fill="{t["shop"]}"/>', w1 + trk * F + w2

def largeur_nom(F):
    return largeur("xb", "kontrol", F, -0.03) - 0.03 * F + largeur("rg", "shop", F, -0.03)

def badge(t, accent, libelle, x, base, T):
    c = T * 0.95; gap = T * 0.75
    d, w = texte("md", libelle, T, x + c + gap, base, 0.3)
    return (f'<rect x="{x:.2f}" y="{base - T*0.72 - (c - T*0.72)/2:.2f}" width="{c:.2f}" height="{c:.2f}" rx="{c*0.22:.2f}" fill="{accent}"/>'
            f'<path d="{d}" fill="{t["encre"]}"/>'), c + gap + w

def largeur_badge(libelle, T):
    return T * 0.95 + T * 0.75 + largeur("md", libelle, T, 0.3)

def svg(w, h, corps, titre):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}" role="img">'
            f'<title>{titre}</title>{corps}</svg>\n')

def empile(t, accent, libelle):
    F = 130; T = 38; M = 40
    wn = largeur_nom(F); wb = largeur_badge(libelle, T) if libelle else 0
    W = max(wn, wb, 240) + 2 * M
    hk = 292; y = M
    corps = marque_k(t, accent, W / 2 - 120 + 8, y, hk)  # +8 : centre optique (l'arc allège la droite)
    base = y + hk + 50 + F * 0.73
    n, _ = nom(t, (W - wn) / 2, base, F); corps += n
    H = base + F * 0.24 + M
    if libelle:
        bb = base + F * 0.24 + 52 + T * 0.72
        b, _ = badge(t, accent, libelle, (W - wb) / 2, bb, T); corps += b
        H = bb + M
    return svg(W, H, corps, "kontrolshop" + (f" {libelle.capitalize()}" if libelle else ""))

def horizontal(t, accent, libelle):
    F = 110; T = 30; M = 24
    hk = 196; wk = hk * 240 / 292
    x = M; y = M
    corps = marque_k(t, accent, x, y, hk)
    xn = x + wk + 26
    base = y + (hk * 0.56 if libelle else hk * 0.5 + F * 0.36)
    n, wn = nom(t, xn, base, F); corps += n
    W = xn + wn + M
    if libelle:
        b, wb = badge(t, accent, libelle, xn + 4, base + F * 0.24 + 26 + T * 0.72, T); corps += b
        W = max(W, xn + 4 + wb + M)
    return svg(W, hk + 2 * M, corps, "kontrolshop" + (f" {libelle.capitalize()}" if libelle else ""))

sortie = sys.argv[1]; os.makedirs(sortie, exist_ok=True)
for id_, (libelle, accent) in SECTEURS.items():
    for th, t in THEMES.items():
        for forme, fn in (("", empile), ("-horizontal", horizontal)):
            nom_fichier = f"{id_}{forme}-{th}.svg"
            a = SOMBRE.get(id_, accent) if th == "sombre" else accent
            open(os.path.join(sortie, nom_fichier), "w").write(fn(t, a, libelle))
print("ok", len(os.listdir(sortie)))
