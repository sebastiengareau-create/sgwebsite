"use client";

// Bail officiel du TAL (lib/bailTal.js) : le bail se remplit et se signe sur
// la plateforme du TAL ; la fiche reprend les données du bail dans l'ordre
// du formulaire, avec un bouton « Copier » par case ; le PDF signé se dépose
// ensuite ici (documents du bail, catégorie BAIL_TAL, visible au locataire).

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TEINTES, BoutonContour } from "../../../components/StyleSection";
import { ficheBailTal, texteFiche, manquesFiche, URL_BAIL_TAL, CATEGORIE_BAIL_TAL, JOURS_CONSERVATION_TAL } from "@/lib/bailTal";
import { dateLisible, nomsLocataires } from "@/lib/immobilierCalculs";
import { Section, BoutonTexte, Erreur, champStyle, labelStyle, boutonPrincipal, aujourdhui, lien } from "../../ui";

// Copie dans le presse-papiers, même sans l'API moderne (page en http)
async function copier(texte) {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    const zone = document.createElement("textarea");
    zone.value = texte;
    zone.setAttribute("readonly", "");
    zone.style.position = "fixed";
    zone.style.opacity = "0";
    document.body.appendChild(zone);
    zone.select();
    const ok = document.execCommand("copy");
    zone.remove();
    return ok;
  }
}

function BoutonCopier({ texte, libelle = "Copier", style }) {
  const [fait, setFait] = useState(false);
  const vide = !texte;
  return (
    <button
      type="button"
      disabled={vide}
      onClick={async () => { if (await copier(texte)) { setFait(true); setTimeout(() => setFait(false), 1500); } }}
      className="bouton-copier"
      style={{ opacity: vide ? 0.35 : 1, ...style }}
      aria-label={vide ? "Rien à copier" : `${libelle} : ${texte}`}
    >
      {fait ? "✓ Copié" : libelle}
    </button>
  );
}

const etape = { border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", marginBottom: 10, background: "var(--surface-alt)" };
const titreEtape = { fontSize: 14, fontWeight: 800, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 };
const numero = { width: 22, height: 22, borderRadius: 999, background: "var(--accent)", color: "#221f18", fontSize: 12.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const texte = { fontSize: 13, margin: "0 0 10px", lineHeight: 1.5 };

export default function BailOfficiel({ bail, officiel, locateur }) {
  const { document: doc, reconduction, origine } = officiel;
  const [depot, setDepot] = useState(false);

  if (doc) {
    return (
      <Section
        titre="Bail officiel du TAL" icone="presse" teinte={TEINTES.vert}
        sousTitre={doc.date ? `Signé le ${dateLisible(doc.date)}, déposé ici` : "Signé et déposé ici"}
        droite={<BoutonTexte onClick={() => setDepot((v) => !v)}>{depot ? "Annuler" : "Remplacer"}</BoutonTexte>}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 13.5 }}>
          <a href={`/api/immobilier/documents/${doc.id}`} target="_blank" rel="noreferrer" style={{ ...lien, fontWeight: 700 }}>🏛️ {doc.titre}</a>
          <span style={{ color: "var(--text-muted)", fontSize: 12.5 }}>
            déposé le {dateLisible(doc.creeLe)}{doc.visibleLocataire ? " · visible dans l'espace du locataire" : " · pas montré au locataire"}{doc.signeLe ? " · signatures reçues dans kontrolshop" : ""}
          </span>
        </div>
        {depot && <Depot bail={bail} onFini={() => setDepot(false)} />}
      </Section>
    );
  }

  if (reconduction) {
    return (
      <Section
        titre="Bail officiel du TAL" icone="presse" teinte={TEINTES.neutre}
        sousTitre="Reconduction : pas de nouveau formulaire"
        droite={<BoutonTexte onClick={() => setDepot((v) => !v)}>{depot ? "Annuler" : "Déposer"}</BoutonTexte>}
      >
        <p style={{ ...texte, margin: 0 }}>
          Ce bail continue celui du {dateLisible(origine.dateDebut)} avec le même locataire : il se reconduit de plein droit, sans nouveau formulaire. Le bail officiel reste celui signé au début.{" "}
          {origine.document
            ? <a href={`/api/immobilier/documents/${origine.document.id}`} target="_blank" rel="noreferrer" style={{ ...lien, fontWeight: 700 }}>🏛️ Ouvrir le bail officiel</a>
            : <>Il n'est pas encore déposé : <Link href={`/immobilier/baux/${origine.id}`} style={{ ...lien, fontWeight: 700 }}>dépose-le dans le bail du {dateLisible(origine.dateDebut)}</Link>.</>}
        </p>
        {depot && <Depot bail={bail} onFini={() => setDepot(false)} />}
      </Section>
    );
  }

  // Bail commencé depuis longtemps ou terminé : seulement le dépôt du bail signé (papier numérisé ou PDF)
  if (!officiel.nouveau) {
    return (
      <Section
        titre="Bail officiel du TAL" icone="presse" teinte={TEINTES.neutre}
        sousTitre="Aucun bail signé déposé"
        droite={<BoutonTexte onClick={() => setDepot((v) => !v)}>{depot ? "Annuler" : "Déposer"}</BoutonTexte>}
      >
        <p style={{ ...texte, margin: 0 }}>Dépose le bail signé (PDF de la plateforme du TAL, ou bail papier numérisé) pour le garder ici et le montrer au locataire dans son espace.</p>
        {depot && <Depot bail={bail} onFini={() => setDepot(false)} />}
      </Section>
    );
  }

  return (
    <Section titre="Bail officiel du TAL" icone="presse" teinte={TEINTES.ambre} sousTitre="À remplir et signer sur la plateforme du TAL, puis à déposer ici">
      <div style={etape}>
        <p style={titreEtape}><span style={numero}>1</span> Remplir et signer sur la plateforme du TAL</p>
        <p style={texte}>
          Le formulaire obligatoire, toujours à jour, s'achète et se remplit en ligne. Chaque partie signe à partir de son courriel.
          Le TAL ne garde le bail que {JOURS_CONSERVATION_TAL} jours : télécharge-le et dépose-le ici dès qu'il est signé.
        </p>
        <BoutonContour href={URL_BAIL_TAL} target="_blank" icone="globe">Ouvrir la plateforme du TAL ↗</BoutonContour>
      </div>
      <div style={etape}>
        <p style={titreEtape}><span style={numero}>2</span> Recopier les renseignements du bail</p>
        <Fiche bail={bail} officiel={officiel} locateur={locateur} />
      </div>
      <div style={{ ...etape, marginBottom: 0 }}>
        <p style={titreEtape}><span style={numero}>3</span> Déposer le bail signé</p>
        <Depot bail={bail} />
      </div>
    </Section>
  );
}

// La fiche à recopier, section par section
function Fiche({ bail, officiel, locateur }) {
  const sections = ficheBailTal({ bail, entreprise: locateur, loyerAncien: officiel.loyerAncien });
  const { vides, alertes } = manquesFiche(sections);
  const [ouvert, setOuvert] = useState(true);
  return (
    <>
      <p style={texte}>Les données du bail, dans l'ordre des sections du formulaire. Touche « Copier » puis colle dans la case du TAL.</p>
      {alertes.length > 0 && (
        <ul style={{ fontSize: 12.5, color: "var(--danger)", fontWeight: 600, margin: "0 0 10px 18px", padding: 0 }}>
          {alertes.map((a) => <li key={a}>{a}</li>)}
        </ul>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
        <BoutonCopier texte={texteFiche(sections)} libelle="📋 Tout copier" style={{ padding: "7px 12px", fontSize: 12.5 }} />
        <BoutonTexte onClick={() => setOuvert((v) => !v)}>{ouvert ? "Replier la fiche" : "Voir la fiche"}</BoutonTexte>
        {vides.length > 0 && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{vides.length} case{vides.length > 1 ? "s" : ""} à compléter (Bail → Modifier)</span>}
      </div>
      {ouvert && sections.map((s) => (
        <div key={s.lettre} style={{ marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800, margin: "0 0 2px" }}>
            <span style={{ ...numero, borderRadius: 6, background: "var(--bleu-fond)", color: "var(--bleu)" }}>{s.lettre}</span>
            {s.titre}
          </div>
          {s.groupes.map((g, n) => (
            <div key={`${s.lettre}-${n}`}>
              {g.titre && <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--text-muted)", margin: "8px 0 0" }}>{g.titre}</div>}
              {g.champs.map((c) => (
                <div key={c.libelle} className="ligne-fiche">
                  <span className="libelle">{c.libelle}</span>
                  <span className="valeur">
                    {c.valeur ? c.valeur : <em style={{ color: "var(--text-muted)", fontWeight: 400 }}>{c.facultatif ? "— facultatif" : "à inscrire"}</em>}
                    {c.note && <span className="note">{c.note}</span>}
                    {c.alerte && <span className="note" style={{ color: "var(--danger)", fontWeight: 600 }}>{c.alerte}</span>}
                  </span>
                  <BoutonCopier texte={c.copie ?? c.valeur} />
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

// Dépôt du PDF : dans les documents du bail, catégorie BAIL_TAL ; s'il
// n'est pas encore signé, signature demandée en ligne aux parties
function Depot({ bail, onFini }) {
  const router = useRouter();
  const [fichier, setFichier] = useState(null);
  const [date, setDate] = useState(aujourdhui());
  const [signe, setSigne] = useState(true);
  const [visible, setVisible] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const pdf = fichier && (fichier.type === "application/pdf" || /\.pdf$/i.test(fichier.name));

  async function deposer() {
    if (!fichier) return setErreur("Choisis le PDF du bail signé.");
    if (!signe && !pdf) return setErreur("La signature en ligne demande un PDF.");
    setErreur("");
    setEnCours(true);
    const fd = new FormData();
    const champs = {
      titre: `Bail de logement (formulaire du TAL) — ${nomsLocataires(bail)}`.slice(0, 200),
      categorie: CATEGORIE_BAIL_TAL,
      date,
      description: signe ? "Bail signé, sur le formulaire du Tribunal administratif du logement." : "Bail sur le formulaire du Tribunal administratif du logement ; signatures demandées en ligne.",
      bailId: bail.id,
      logementId: bail.logement.id,
      visibleLocataire: visible ? "oui" : "",
    };
    for (const [k, v] of Object.entries(champs)) fd.append(k, v);
    fd.append("fichier", fichier);
    const res = await fetch("/api/immobilier/documents", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setEnCours(false);
      return setErreur(data.erreur || "Dépôt impossible.");
    }
    if (!signe) {
      const r = await fetch(`/api/immobilier/documents/${data.id}/signatures`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locataireIds: bail.locataires.map((l) => l.id), locateur: true, envoyer: true }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErreur(`Bail déposé, mais signatures non demandées : ${d.erreur || "erreur"}. Fais-le depuis Documents du bail.`);
    }
    setEnCours(false);
    setFichier(null);
    router.refresh();
    onFini?.();
  }

  return (
    <div style={{ marginTop: onFini ? 12 : 0 }}>
      <p style={texte}>Le PDF va dans les documents du bail et, au choix, dans l'espace du locataire. Il reste ici pour de bon.</p>
      <label style={labelStyle}>Bail signé : PDF de la plateforme du TAL, ou bail papier numérisé</label>
      <input type="file" accept="application/pdf,.pdf,image/*" onChange={(e) => setFichier(e.target.files?.[0] || null)} style={{ fontSize: 13, marginBottom: 10, maxWidth: "100%" }} />
      <label style={labelStyle}>Date de signature du bail</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...champStyle, maxWidth: 200 }} />
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, margin: "4px 0 8px", cursor: "pointer" }}>
        <input type="checkbox" checked={signe} onChange={(e) => setSigne(e.target.checked)} style={{ marginTop: 2 }} />
        <span>Déjà signé par toutes les parties<span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>{signe ? "Décoche si le bail n'est pas signé : le locateur et les locataires recevront un lien pour le signer en ligne ici." : "Le locateur et chaque locataire recevront par courriel un lien pour signer le PDF en ligne (suivi dans Documents du bail)."}</span></span>
      </label>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, margin: "0 0 12px", cursor: "pointer" }}>
        <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} /> Visible dans l'espace du locataire
      </label>
      <Erreur texte={erreur} />
      <button type="button" onClick={deposer} disabled={enCours} className="bouton-3d" style={boutonPrincipal}>{enCours ? "Dépôt…" : "Déposer le bail officiel"}</button>
    </div>
  );
}
