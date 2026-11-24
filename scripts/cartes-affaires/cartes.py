"""Cartes d'affaires kontrolshop, une par déclinaison (recto-verso, PDF prêt à imprimer).

    python3 scripts/cartes-affaires/cartes.py
    python3 scripts/cartes-affaires/cartes.py --nom "Prénom Nom" --titre "Ventes" --tel "514 000-0000"
    python3 scripts/cartes-affaires/cartes.py --secteurs garage,ferme

Résultat dans scripts/cartes-affaires/sortie/ (non versionné) :
kontrolshop-carte-<secteur>.pdf (page 1 recto, page 2 verso), aperçus PNG et
kontrolshop-cartes-apercu.png (planche de toutes les cartes).

Format 3,5 x 2 po avec 1/8 po de fond perdu (fichier 3,75 x 2,25 po), en RVB.
Recto : logo métal public/marque/kontrolshop-metal-<secteur>.png. Couleurs des
secteurs : les mêmes que SECTEURS dans lib/marque.js — garder pareilles.
Le code QR mène à la page du secteur : www.kontrolshop.com/<page>/ (PAGES).

Exige : pip install qrcode pillow ; Playwright (Chromium) pour le rendu ;
police Inter installée.
"""
import argparse, base64, json, subprocess
from pathlib import Path
import qrcode

ICI = Path(__file__).resolve().parent
MARQUE = ICI.parent.parent / "public" / "marque"

p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
p.add_argument("--nom", default="Sébastien Gareau")
p.add_argument("--titre", default="Développeur")
p.add_argument("--tel", default="514 983-2974")
p.add_argument("--courriel", default="info@kontrolshop.com")
p.add_argument("--site", default="www.kontrolshop.com")
p.add_argument("--secteurs", default="", help="liste séparée par des virgules (défaut : tous)")
p.add_argument("--sortie", default=str(ICI / "sortie"))
args = p.parse_args()
NOM, TITRE, TEL, COURRIEL, SITE = args.nom, args.titre, args.tel, args.courriel, args.site
OUT = Path(args.sortie)
OUT.mkdir(parents=True, exist_ok=True)
SECTEURS = {
    "garage": ("Garage", "#e07338", ["Bons de travail, du comptoir à la facture", "Inspection numérique avec photos, approuvée par le client", "Paiement en ligne et textos automatiques"]),
    "ferme": ("Ferme", "#457a3c", ["Troupeau, saillies, vêlages et lignée", "Registre ATQ et délais de retrait", "Traçabilité de la viande par code QR"]),
    "copropriete": ("Copropriété", "#2f6db5", ["Unités, quotes-parts et charges communes", "Réparations et entretien préventif", "Portail sécurisé des copropriétaires"]),
    "immobilier": ("Immobilier", "#7c4dbd", ["Baux du TAL et calcul des hausses 2026", "Signature électronique et état des lieux", "Loyers, retards et revenus pour l'impôt"]),
    "premium": ("Premium", "#b8902f", ["Tous les modules réunis", "Une installation à votre image", "Un accompagnement personnalisé"]),
}

# Page du secteur sur le site de vente (dépôt kontrolshop.com), où mène le code QR
PAGES = {"garage": "garage", "ferme": "ferme", "copropriete": "copropriete", "immobilier": "immobilier", "premium": "vr"}


def b64(p):
    return base64.b64encode(p.read_bytes()).decode()


def qr_svg(data):
    q = qrcode.QRCode(border=0, error_correction=qrcode.constants.ERROR_CORRECT_M)
    q.add_data(data)
    q.make()
    m = q.get_matrix()
    n = len(m)
    rects = "".join(f'<rect x="{x}" y="{y}" width="1.02" height="1.02"/>' for y, row in enumerate(m) for x, v in enumerate(row) if v)
    return f'<svg viewBox="0 0 {n} {n}" xmlns="http://www.w3.org/2000/svg" fill="#111">{rects}</svg>'


# Format 3,5 x 2 po + 1/8 po de fond perdu de chaque côté = 3,75 x 2,25 po.
# Tout le texte reste à 1/4 po du bord du fichier (1/8 po en dedans de la coupe).
CSS = """
@page { size: 3.75in 2.25in; margin: 0 }
* { box-sizing: border-box; margin: 0; padding: 0 }
html, body { background: #0f1216 }
body { font-family: Inter, sans-serif; color: #eef0f3; -webkit-print-color-adjust: exact; print-color-adjust: exact }
.carte { width: 3.75in; height: 2.25in; position: relative; overflow: hidden; break-after: page;
  background: radial-gradient(120% 140% at 50% 35%, #2a2f37 0%, #15181d 55%, #0b0d10 100%) }
.zone { position: absolute; inset: 0.25in }
.recto .logo { position: absolute; left: 50%; top: 1.0in; transform: translate(-50%,-50%); width: 2.75in }
.recto .slogan { position: absolute; left: 0; right: 0; bottom: 0.36in; text-align: center; font-size: 7pt; font-weight: 500; letter-spacing: .22em; color: #aab1bb }
.recto .filet { position: absolute; left: 0; right: 0; bottom: 0; height: 0.22in; background: var(--c) }
.verso { background: #f6f5f2; color: #1a1d22 }
.verso .bande { position: absolute; left: 0; top: 0; bottom: 0; width: 0.36in; background: var(--c) }
.verso .zone { left: 0.52in }
.badge { display: flex; align-items: center; gap: 6px; font-size: 6.8pt; font-weight: 600; letter-spacing: .3em; text-transform: uppercase; color: var(--c) }
.badge i { width: 7px; height: 7px; border-radius: 2px; background: var(--c) }
.nom { margin-top: 5px; font-size: 12pt; font-weight: 700; letter-spacing: -0.01em }
.titre { font-size: 7pt; color: #5b6270; margin-top: 1px }
ul { list-style: none; margin-top: 7px; font-size: 6.4pt; line-height: 1.5; color: #2b3038; max-width: 2.0in }
li { padding-left: 9px; position: relative }
li::before { content: ""; position: absolute; left: 0; top: calc(0.75em - 2px); width: 4px; height: 4px; border-radius: 50%; background: var(--c) }
.contact { position: absolute; left: 0; bottom: 0; font-size: 6.6pt; line-height: 1.45 }
.contact b { font-weight: 600 }
.qr { position: absolute; right: 0; top: 0; width: 0.7in; text-align: center }
.qr svg { width: 0.7in; height: 0.7in; display: block }
.qr span { display: block; font-size: 5.2pt; color: #5b6270; margin-top: 3px }
.k { position: absolute; right: 0; bottom: 0; font-size: 9pt; letter-spacing: -0.03em }
.k b { font-weight: 800 } .k s { text-decoration: none; color: #8a909a }
"""

choisis = [s.strip() for s in args.secteurs.split(",") if s.strip()] or list(SECTEURS)
inconnus = [s for s in choisis if s not in SECTEURS]
if inconnus:
    raise SystemExit(f"Secteur inconnu : {', '.join(inconnus)} (offerts : {', '.join(SECTEURS)})")

for cle in choisis:
    lib, c, av = SECTEURS[cle]
    logo = b64(MARQUE / f"kontrolshop-metal-{cle}.png")
    qr = qr_svg(f"https://www.kontrolshop.com/{PAGES[cle]}/")
    lis = "".join(f"<li>{a}</li>" for a in av)
    recto = (f'<div class="carte recto" style="--c:{c}"><img class="logo" src="data:image/png;base64,{logo}">'
             f'<div class="slogan">TOUT EST SOUS KONTROL.</div><div class="filet"></div></div>')
    verso = (f'<div class="carte verso" style="--c:{c}"><div class="bande"></div><div class="zone">'
             f'<div class="badge"><i></i>{lib}</div><div class="nom">{NOM}</div><div class="titre">{TITRE}</div><ul>{lis}</ul>'
             f'<div class="contact"><b>{TEL}</b><br>{COURRIEL}<br>{SITE}</div>'
             f'<div class="qr">{qr}<span>Voir la démo</span></div>'
             f'<div class="k"><b>kontrol</b><s>shop</s></div></div></div>')
    (OUT / f"carte-{cle}.html").write_text(f"<!doctype html><meta charset=utf-8><style>{CSS}</style>{recto}{verso}")

# Rendu : PDF et aperçus par Chromium (rendre.js), puis planche d'aperçu
subprocess.run(["node", str(ICI / "rendre.js"), str(OUT), json.dumps(choisis)], check=True)

from PIL import Image
ims = [Image.open(OUT / f"apercu-{s}-{f}.png") for s in choisis for f in ("recto", "verso")]
w, h = ims[0].size
planche = Image.new("RGB", (w * 2 + 60, (h + 60) * len(choisis) + 20), "#e9e7e2")
for i, im in enumerate(ims):
    planche.paste(im, (20 + (i % 2) * (w + 20), 20 + (i // 2) * (h + 60)))
planche.save(OUT / "kontrolshop-cartes-apercu.png")
print(f"{len(choisis)} carte(s) dans {OUT}")
