"use client";

// Éléments communs aux écrans de la copropriété. Les briques génériques
// (champs, onglets, tableau, appel à l'API) sont celles de l'élevage.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TitreSection } from "../components/ui";
import { Pastille } from "../components/StyleSection";
import { champStyle, labelStyle, boutonPrincipal, boutonLien, grille2, Champ, Erreur, useApi } from "../elevage/ui";
import { trouver, taille } from "@/lib/coproprieteCalculs";

export { champStyle, labelStyle, boutonPrincipal, boutonLien, grille2, Champ, Erreur, useApi };
export { Onglets, Statistique, Tableau, cellule, celluleDroite, aujourdhui } from "../elevage/ui";

export function NavCopro({ actif }) {
  const liens = [
    { href: "/copropriete", label: "📊 Tableau de bord" },
    { href: "/copropriete/unites", label: "🏠 Unités" },
    { href: "/copropriete/coproprietaires", label: "👥 Copropriétaires" },
    { href: "/copropriete/finances", label: "💰 Charges" },
    { href: "/copropriete/entretien", label: "🛠️ Entretien" },
    { href: "/copropriete/documents", label: "📁 Documents" },
  ];
  return (
    <nav style={{
      display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))", gap: 4, marginBottom: 16,
      padding: 4, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)",
    }}>
      {liens.map((l) => {
        const estActif = l.href === actif;
        return (
          <Link
            key={l.href} href={l.href} aria-current={estActif ? "page" : undefined}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
              fontSize: 13.5, fontWeight: 700, padding: "10px 6px", borderRadius: 10, textDecoration: "none",
              background: estActif ? "var(--accent)" : "transparent", color: estActif ? "#221f18" : "var(--text-muted)",
            }}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Retour({ href, children }) {
  return <Link href={href} style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← {children}</Link>;
}

// Carte de section d'une fiche, avec un bouton à droite au besoin
export function Section({ titre, children, droite, id }) {
  return (
    <div className="carte" id={id} style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <TitreSection>{titre}</TitreSection>
        {droite}
      </div>
      {children}
    </div>
  );
}

export function BoutonTexte({ onClick, children, couleur = "var(--accent)", disabled }) {
  return <button type="button" onClick={onClick} disabled={disabled} style={{ ...boutonLien, color: couleur, fontWeight: 700 }}>{children}</button>;
}

// Pastille de statut / priorité d'une liste { code, label, couleur }
export function PastilleCode({ liste, code }) {
  const x = trouver(liste, code);
  if (!x) return null;
  return <Pastille couleur={x.couleur || "var(--text-muted)"} fond={`${x.couleur || "#888888"}22`}>{x.label}</Pastille>;
}

export function Vide({ children }) {
  return <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "4px 0" }}>{children}</p>;
}

// ---------- Formulaires décrits par une liste de champs ----------
// champs : [{ nom, label, type: "texte" | "long" | "date" | "nombre" |
// "choix" | "case", options: [{ code, label }], vide: "— libellé —",
// placeholder, pleineLargeur }]

export function ChampsFormulaire({ champs, valeurs, maj }) {
  const enGrille = champs.filter((c) => !c.pleineLargeur && c.type !== "long" && c.type !== "case");
  const pleins = champs.filter((c) => c.pleineLargeur || c.type === "long" || c.type === "case");
  return (
    <>
      <div style={grille2}>{enGrille.map((c) => <UnChamp key={c.nom} c={c} valeurs={valeurs} maj={maj} />)}</div>
      {pleins.map((c) => <UnChamp key={c.nom} c={c} valeurs={valeurs} maj={maj} />)}
    </>
  );
}

function UnChamp({ c, valeurs, maj }) {
  const v = valeurs[c.nom] ?? "";
  const changer = (e) => maj(c.nom, c.type === "case" ? e.target.checked : e.target.value);
  if (c.type === "case") {
    return (
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 10, cursor: "pointer" }}>
        <input type="checkbox" checked={Boolean(v)} onChange={changer} />
        {c.label}
      </label>
    );
  }
  let entree;
  if (c.type === "choix") {
    entree = (
      <select value={v} onChange={changer} style={champStyle}>
        {c.vide !== undefined && <option value="">{c.vide}</option>}
        {c.options.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
      </select>
    );
  } else if (c.type === "long") {
    entree = <textarea value={v} onChange={changer} rows={c.lignes || 3} placeholder={c.placeholder} style={{ ...champStyle, resize: "vertical" }} />;
  } else if (c.type === "date") {
    entree = <input type="date" max="9999-12-31" value={v} onChange={changer} style={champStyle} />;
  } else {
    entree = <input value={v} onChange={changer} inputMode={c.type === "nombre" ? "decimal" : undefined} placeholder={c.placeholder} type={c.typeHtml || "text"} style={champStyle} />;
  }
  return <Champ label={c.label}>{entree}</Champ>;
}

// Valeurs d'un formulaire à partir d'un élément enregistré (dates en
// « 2026-11-05 », nombres avec virgule, vide plutôt que null)
export function valeursDe(element, champs) {
  return Object.fromEntries(champs.map((c) => {
    const v = element?.[c.nom];
    if (c.type === "case") return [c.nom, Boolean(v)];
    if (v == null) return [c.nom, c.defaut ?? ""];
    if (c.type === "date") return [c.nom, String(v).slice(0, 10)];
    if (c.type === "nombre") return [c.nom, String(v).replace(".", ",")];
    return [c.nom, String(v)];
  }));
}

// Formulaire complet : champs + bouton, envoyé à l'API (POST ou PATCH).
// extra : valeurs fixes ajoutées à l'envoi (ex. { uniteId }).
export function Formulaire({ champs, initial, url, methode = "POST", extra, bouton = "Enregistrer", onFini, cadre = true, avantEnvoi, children }) {
  const [valeurs, setValeurs] = useState(() => ({ ...valeursDe(null, champs), ...initial }));
  const { appeler, enCours, erreur, setErreur } = useApi();
  const maj = (nom, v) => setValeurs((x) => ({ ...x, [nom]: v }));

  async function envoyer() {
    let corps = { ...valeurs, ...extra };
    if (avantEnvoi) {
      const r = await avantEnvoi(corps);
      if (r?.erreur) return setErreur(r.erreur);
      if (r === false) return;
      if (r?.corps) corps = r.corps;
    }
    const data = await appeler(url, methode, corps);
    if (data) onFini?.(data, corps);
  }

  const contenu = (
    <>
      <ChampsFormulaire champs={champs} valeurs={valeurs} maj={maj} />
      {typeof children === "function" ? children({ valeurs, maj }) : children}
      <Erreur texte={erreur} />
      <button type="button" onClick={envoyer} disabled={enCours} className="bouton-3d" style={boutonPrincipal}>{enCours ? "…" : bouton}</button>
    </>
  );
  if (!cadre) return contenu;
  return <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 16, padding: 16, marginBottom: 16 }}>{contenu}</div>;
}

// Bouton « Supprimer » avec confirmation
export function BoutonSupprimer({ url, confirmation, onFini, children = "Supprimer" }) {
  const { appeler, enCours, erreur } = useApi();
  async function supprimer() {
    if (!window.confirm(confirmation)) return;
    if (await appeler(url, "DELETE")) onFini?.();
  }
  return (
    <>
      <BoutonTexte onClick={supprimer} couleur="var(--danger)" disabled={enCours}>{enCours ? "…" : children}</BoutonTexte>
      {erreur && <span style={{ color: "var(--danger)", fontSize: 12, marginLeft: 8 }}>{erreur}</span>}
    </>
  );
}

// ---------- Fichiers ----------

// Envoi de fichiers (multipart) : photos du téléphone, PDF…
export function EnvoiFichiers({ url, champsFixes = {}, libelle = "📎 Ajouter des photos ou fichiers", accept = "image/*,.pdf,.doc,.docx,.xls,.xlsx" }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  async function envoyer(e) {
    const fichiers = [...(e.target.files || [])];
    e.target.value = "";
    if (fichiers.length === 0) return;
    setErreur("");
    setEnCours(true);
    const fd = new FormData();
    for (const [k, v] of Object.entries(champsFixes)) fd.append(k, v);
    for (const f of fichiers) fd.append("fichier", f);
    const res = await fetch(url, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) return setErreur(data.erreur || "Envoi impossible.");
    router.refresh();
  }
  return (
    <div style={{ marginTop: 8 }}>
      <label className="bouton-3d" style={{ display: "inline-block", padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
        {enCours ? "Envoi…" : libelle}
        <input type="file" multiple accept={accept} onChange={envoyer} disabled={enCours} style={{ display: "none" }} />
      </label>
      <Erreur texte={erreur} />
    </div>
  );
}

// Vignettes des photos, liste des autres fichiers
export function ListeFichiers({ fichiers, base = "/api/copropriete/fichiers", supprimable = true }) {
  const images = fichiers.filter((f) => f.typeMime.startsWith("image/") && !/heic|heif/.test(f.typeMime));
  const autres = fichiers.filter((f) => !images.includes(f));
  if (fichiers.length === 0) return <Vide>Aucune photo ni pièce jointe.</Vide>;
  return (
    <>
      {images.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8, marginBottom: 8 }}>
          {images.map((f) => (
            <div key={f.id} style={{ position: "relative" }}>
              <a href={`${base}/${f.id}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${base}/${f.id}`} alt={f.nom} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 10, border: "1px solid var(--border)" }} />
              </a>
              {supprimable && <div style={{ textAlign: "right" }}><BoutonSupprimer url={`${base}/${f.id}`} confirmation={`Supprimer la photo ${f.nom} ?`}>✕</BoutonSupprimer></div>}
            </div>
          ))}
        </div>
      )}
      {autres.map((f) => (
        <div key={f.id} className="ligne-info">
          <a href={`${base}/${f.id}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>📄 {f.nom}</a>
          <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{taille(f.taille)}</span>
            {supprimable && <BoutonSupprimer url={`${base}/${f.id}`} confirmation={`Supprimer ${f.nom} ?`}>✕</BoutonSupprimer>}
          </span>
        </div>
      ))}
    </>
  );
}

// Boîte de recherche avec loupe
export function Recherche({ valeur, onChange, placeholder }) {
  return (
    <input
      value={valeur} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      style={{ ...champStyle, marginBottom: 12, padding: "11px 12px", fontSize: 14, borderRadius: 12, background: "var(--surface)" }}
    />
  );
}

// Carte cliquable d'une liste (bande de couleur à gauche)
export function CarteListe({ href, couleur = "var(--border)", titre, sousTitre, droite, bas }) {
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <div style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "13px 16px 13px 20px", display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: couleur }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{titre}</div>
          {sousTitre && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{sousTitre}</div>}
          {bas && <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>{bas}</div>}
        </div>
        {droite && <div style={{ textAlign: "right", flexShrink: 0, fontSize: 12.5 }}>{droite}</div>}
      </div>
    </Link>
  );
}

// « Unité 101 · Bâtiment A · Garage P1 », ou « Parties communes »
export function Endroit({ x }) {
  const morceaux = [x.batiment?.nom, x.emplacement].filter(Boolean).join(" · ");
  if (!x.unite) return morceaux || "Parties communes";
  return <><Link href={`/copropriete/unites/${x.unite.id}`} style={{ color: "var(--accent)" }}>Unité {x.unite.numero}</Link>{morceaux && ` · ${morceaux}`}</>;
}
