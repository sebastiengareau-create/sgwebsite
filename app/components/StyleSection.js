// Pièces visuelles communes aux pages d'accueil de section (Comptabilité,
// Paie…) : icônes au trait, cartes de chiffres, groupes de liens colorés.
// Une seule source pour que les sections gardent le même style.
import Link from "next/link";

// Icônes au trait (style uniforme), dessinées en ligne pour éviter toute dépendance.
const ICONES = {
  echange: <><path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" /></>,
  liste: <><path d="m3 7 2 2 4-4" /><path d="m3 17 2 2 4-4" /><path d="M13 6h8" /><path d="M13 12h8" /><path d="M13 18h8" /></>,
  crayon: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  livre: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /></>,
  presse: <><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></>,
  cadenas: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  banque: <><path d="m3 9 9-6 9 6" /><path d="M5 9h14" /><path d="M6 13v5" /><path d="M10 13v5" /><path d="M14 13v5" /><path d="M18 13v5" /><path d="M3 21h18" /></>,
  imprimante: <><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
  tendance: <><path d="m22 7-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></>,
  boite: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M3.3 7 12 12l8.7-5" /><path d="M12 22V12" /></>,
  drapeau: <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><path d="M4 22v-7" /></>,
  graphique: <><path d="M3 3v18h18" /><path d="M8 17v-4" /><path d="M12 17V9" /><path d="M16 17v-6" /></>,
  balance: <><path d="M12 3v18" /><path d="M7 21h10" /><path d="M3 7h18" /><path d="m6 7-3 7a3 3 0 0 0 6 0Z" /><path d="m18 7-3 7a3 3 0 0 0 6 0Z" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  chevronGauche: <path d="m15 18-6-6 6-6" />,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  calculatrice: <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8" /><path d="M8 10h.01" /><path d="M12 10h.01" /><path d="M16 10h.01" /><path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14v4" /><path d="M8 18h.01" /><path d="M12 18h.01" /></>,
  utilisateurs: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  utilisateurPlus: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6" /><path d="M22 11h-6" /></>,
  document: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h5" /></>,
  calendrier: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></>,
  horloge: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  alerte: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
  crochet: <><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>,
};

export function Icone({ nom, taille = 22, couleur = "currentColor" }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke={couleur} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      {ICONES[nom]}
    </svg>
  );
}

// Teintes des groupes de liens — chaque groupe a la sienne pour se repérer.
export const TEINTES = {
  ambre: { couleur: "var(--accent-ombre)", fond: "rgba(232,163,61,0.16)" },
  bleu: { couleur: "var(--bleu)", fond: "var(--bleu-fond)" },
  vert: { couleur: "var(--success)", fond: "var(--success-fond)" },
  rouge: { couleur: "var(--danger)", fond: "var(--danger-fond)" },
  neutre: { couleur: "var(--text-muted)", fond: "var(--surface-alt)", discret: true },
};

export function CarteChiffre({ titre, montant, couleur = "var(--text)", note, teinte, href }) {
  const contenu = (
    <div style={{
      position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 18, padding: "18px 20px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", height: "100%", boxSizing: "border-box",
    }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: teinte }} />
      <div style={{ position: "absolute", right: -30, top: -30, width: 110, height: 110, borderRadius: "50%", background: teinte, opacity: 0.08 }} />
      <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>{titre}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: couleur, letterSpacing: "-0.02em", margin: "6px 0 4px", fontVariantNumeric: "tabular-nums" }}>
        {montant}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{note}</div>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>{contenu}</Link> : contenu;
}

export function GrilleChiffres({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 28 }}>
      {children}
    </div>
  );
}

// Bouton à bordure dorée (ex. « État des résultats », « Bilan »).
export function BoutonContour({ href, icone, children }) {
  return (
    <Link href={href} style={{
      display: "inline-flex", alignItems: "center", gap: 10, padding: "11px 18px", borderRadius: 12,
      border: "1.5px solid var(--accent)", background: "var(--surface)", color: "var(--text)",
      fontSize: 14, fontWeight: 700, textDecoration: "none",
    }}>
      {icone && <Icone nom={icone} taille={18} couleur="var(--accent-ombre)" />}
      {children}
    </Link>
  );
}

// Bouton plein doré (action principale de la page).
export function BoutonPlein({ href, icone = "plus", children }) {
  return (
    <Link href={href} style={{
      display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 12,
      border: "1.5px solid var(--accent)", background: "var(--accent)", color: "#221f18",
      fontSize: 14, fontWeight: 700, textDecoration: "none",
    }}>
      {icone && <Icone nom={icone} taille={18} />}
      {children}
    </Link>
  );
}

export function TitreGroupe({ couleur, children, droite }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: couleur, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700 }}>
        {children}
      </span>
      {droite}
    </div>
  );
}

// Carte-lien : icône teintée, titre, détail, flèche.
export function CarteLien({ href, icone, label, detail, teinte = TEINTES.ambre, droite }) {
  return (
    <Link href={href} style={{
      display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: 16,
      background: teinte.discret ? "var(--surface-alt)" : "var(--surface)", border: "1px solid var(--border)",
      textDecoration: "none", color: "var(--text)",
    }}>
      <span style={{ flexShrink: 0, width: 46, height: 46, borderRadius: 12, background: teinte.fond, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icone nom={icone} couleur={teinte.couleur} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>{label}</span>
        {detail && <span style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{detail}</span>}
      </span>
      {droite}
      <Icone nom="chevron" taille={18} couleur="var(--text-muted)" />
    </Link>
  );
}

// Groupe titré de cartes-liens : { titre, teinte, liens: [{ href, icone, label, detail }] }
export function GroupeLiens({ titre, teinte, liens }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <TitreGroupe couleur={teinte.couleur}>{titre}</TitreGroupe>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
        {liens.map((l) => <CarteLien key={l.href} {...l} teinte={teinte} />)}
      </div>
    </section>
  );
}

// Grande carte blanche (ex. Plan comptable, Dernier traitement de paie).
export function Panneau({ titre, action, children, style }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 18, marginBottom: 24, ...style }}>
      {(titre || action) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em" }}>{titre}</div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// Petite étiquette arrondie colorée (statut).
export function Pastille({ couleur, fond, children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: couleur, background: fond, whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: couleur }} />
      {children}
    </span>
  );
}
