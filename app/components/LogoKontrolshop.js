import { NOM_LOGICIEL, SLOGAN, SECTEUR } from "@/lib/marque";

// Le « K » de kontrolshop : sa branche du haut est l'aiguille d'une jauge
// (couleur du secteur), sur un arc pointillé. Les traits foncés suivent la
// couleur du texte, pour rester lisibles en thème clair comme en sombre.
export function MarqueK({ taille = 32, couleur = SECTEUR.couleur }) {
  return (
    <svg
      viewBox="478 240 240 292" width={(taille * 240) / 292} height={taille}
      role="img" aria-label={NOM_LOGICIEL} style={{ display: "block", flexShrink: 0 }}
    >
      <path d="M 632 254 A 162 162 0 0 1 632 520" fill="none" stroke="var(--text-muted)" strokeOpacity="0.7" strokeWidth="7" strokeLinecap="round" strokeDasharray="5 15" />
      <rect x="493" y="267" width="47" height="240" rx="4" fill="currentColor" />
      <polygon points="551,409 576,383 686,487 654,518" fill="currentColor" />
      {/* Pivot en anneau (trou transparent, quel que soit le fond) ;
          l'aiguille part de son bord */}
      <line x1="560" y1="370" x2="660" y2="286" stroke={couleur} strokeWidth="22" strokeLinecap="round" />
      <circle cx="540" cy="387" r="17.5" fill="none" stroke={couleur} strokeWidth="17" />
    </svg>
  );
}

// Nom en deux temps : « kontrol » gras, « shop » léger et grisé
export function NomKontrolshop({ taille = 18 }) {
  return (
    <span style={{ fontSize: taille, letterSpacing: "-0.03em", lineHeight: 1, whiteSpace: "nowrap" }}>
      <span style={{ fontWeight: 800 }}>kontrol</span>
      <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>shop</span>
    </span>
  );
}

// Badge du secteur : carré de couleur + libellé espacé (GARAGE, FERME…)
export function BadgeSecteur({ taille = 11 }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: taille * 0.7 }}>
      <span style={{ width: taille, height: taille, borderRadius: taille * 0.25, background: SECTEUR.couleur }} />
      <span style={{ fontSize: taille, fontWeight: 500, letterSpacing: "0.3em", textTransform: "uppercase" }}>{SECTEUR.libelle}</span>
    </span>
  );
}

// Signature discrète : petit K + nom sur une ligne, slogan dessous
export function SignatureKontrolshop() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <MarqueK taille={22} />
        <NomKontrolshop taille={15} />
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{SLOGAN}</div>
    </div>
  );
}

// Logo complet, empilé comme l'original : K, nom, badge du secteur
export function LogoKontrolshop({ taille = 72 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: taille * 0.22 }}>
      <MarqueK taille={taille} />
      <NomKontrolshop taille={taille * 0.42} />
      <BadgeSecteur taille={taille * 0.16} />
    </div>
  );
}
