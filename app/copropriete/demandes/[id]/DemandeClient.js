"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LigneInfo } from "../../../components/ui";
import { PRIORITES, STATUTS_DEMANDE, STATUTS_TRAVAIL, TYPES_DEMANDE, CATEGORIES_TRAVAUX, argent, libelle, dateLisible } from "@/lib/coproprieteCalculs";
import { champsDemande, champsTravail } from "../../entretien/champs";
import {
  Retour, Section, Formulaire, BoutonTexte, BoutonSupprimer, PastilleCode, Vide, valeursDe, useApi, Erreur, EnvoiFichiers, ListeFichiers, champStyle, Endroit,
} from "../../ui";

export default function DemandeClient({ demande: d, unites, batiments, coproprietaires, fournisseurs }) {
  const router = useRouter();
  const [edition, setEdition] = useState(false);
  const [nouveauBon, setNouveauBon] = useState(false);
  const champs = champsDemande({ unites, batiments, coproprietaires });
  return (
    <div className="conteneur-page">
      <Retour href="/copropriete/entretien">Entretien</Retour>
      <div style={{ margin: "10px 0 14px" }}>
        <h1 style={{ fontSize: 21, margin: "0 0 6px" }}>{d.type === "SIGNALEMENT" ? "⚠️" : "🔧"} {d.numero} — {d.titre}</h1>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <PastilleCode liste={STATUTS_DEMANDE} code={d.statut} /><PastilleCode liste={PRIORITES} code={d.priorite} />
          {d.source === "PORTAIL" && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>🌐 reçue par le portail</span>}
        </div>
      </div>

      <Traitement d={d} />

      <Section titre="Détails" droite={<BoutonTexte onClick={() => setEdition((v) => !v)}>{edition ? "Annuler" : "Modifier"}</BoutonTexte>}>
        {edition ? (
          <>
            <Formulaire cadre={false} champs={champs} initial={valeursDe(d, champs)} url={`/api/copropriete/demandes/${d.id}`} methode="PATCH" onFini={() => setEdition(false)} />
            <div style={{ marginTop: 10 }}><BoutonSupprimer url={`/api/copropriete/demandes/${d.id}`} confirmation={`Supprimer la demande ${d.numero} et ses photos ?`} onFini={() => router.push("/copropriete/entretien")}>Supprimer la demande</BoutonSupprimer></div>
          </>
        ) : (
          <>
            <LigneInfo label="Type" valeur={libelle(TYPES_DEMANDE, d.type)} />
            <LigneInfo label="Endroit" valeur={<Endroit x={d} />} />
            <LigneInfo label="Catégorie" valeur={d.categorie && libelle(CATEGORIES_TRAVAUX, d.categorie)} />
            <LigneInfo label="Demandé par" valeur={d.coproprietaire ? <Link href={`/copropriete/coproprietaires/${d.coproprietaire.id}`} style={{ color: "var(--accent)" }}>{d.coproprietaire.nom}</Link> : d.signalePar} />
            {d.coproprietaire?.telephone && <LigneInfo label="Téléphone" valeur={<a href={`tel:${d.coproprietaire.telephone}`} style={{ color: "var(--accent)" }}>{d.coproprietaire.telephone}</a>} />}
            <LigneInfo label="Reçue le" valeur={dateLisible(d.creeLe)} />
            {d.description && <p style={{ fontSize: 13.5, whiteSpace: "pre-wrap", margin: "10px 0 0" }}>{d.description}</p>}
          </>
        )}
      </Section>

      <Section titre="Photos et pièces jointes">
        <ListeFichiers fichiers={d.fichiers} />
        <EnvoiFichiers url="/api/copropriete/fichiers" champsFixes={{ demandeId: d.id }} />
      </Section>

      <Section titre="Bons de travail" droite={<BoutonTexte onClick={() => setNouveauBon((v) => !v)}>{nouveauBon ? "Annuler" : "+ Bon de travail"}</BoutonTexte>}>
        {nouveauBon && (
          <Formulaire
            champs={champsTravail({ unites, batiments, fournisseurs })}
            initial={{ titre: d.titre, description: d.description || "", priorite: d.priorite, categorie: d.categorie || "", uniteId: d.unite?.id || "", batimentId: d.batiment?.id || "", emplacement: d.emplacement || "" }}
            extra={{ demandeId: d.id }} url="/api/copropriete/travaux" bouton="Créer le bon de travail" onFini={(r) => router.push(`/copropriete/travaux/${r.id}`)}
          />
        )}
        {d.travaux.length === 0 ? <Vide>Aucun bon de travail. Crée-en un pour confier la réparation à un fournisseur.</Vide> : d.travaux.map((t) => (
          <Link key={t.id} href={`/copropriete/travaux/${t.id}`} className="ligne-info" style={{ textDecoration: "none", color: "inherit" }}>
            <span><strong>{t.numero}</strong> {t.titre} <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{t.fournisseur && `· ${t.fournisseur.nom}`} {t.coutReel != null ? `· ${argent(t.coutReel)}` : t.coutEstime != null ? `· ≈ ${argent(t.coutEstime)}` : ""}</span></span>
            <PastilleCode liste={STATUTS_TRAVAIL} code={t.statut} />
          </Link>
        ))}
      </Section>
    </div>
  );
}

// Changer le statut et répondre au demandeur (affiché dans son portail,
// envoyé par courriel s'il en a un)
function Traitement({ d }) {
  const [reponse, setReponse] = useState(d.reponse || "");
  const { appeler, enCours, erreur } = useApi();
  const changer = (statut, extra = {}) => appeler(`/api/copropriete/demandes/${d.id}`, "PATCH", { statut, ...extra });
  const aviseParCourriel = d.coproprietaire?.courriel && d.coproprietaire.avisCourriel;
  return (
    <Section titre="Traitement">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {STATUTS_DEMANDE.filter((s) => s.code !== d.statut).map((s) => (
          <button key={s.code} type="button" disabled={enCours} onClick={() => (s.code === "REFUSEE" && !reponse.trim() ? window.alert("Écris d'abord la raison du refus dans la réponse au demandeur.") : changer(s.code, s.code === "REFUSEE" ? { reponse } : {}))}
            style={{ fontSize: 12.5, fontWeight: 700, padding: "6px 10px", borderRadius: 9, cursor: "pointer", border: `1px solid ${s.couleur}`, background: "transparent", color: s.couleur }}>
            {s.label}
          </button>
        ))}
      </div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
        Réponse au demandeur {d.coproprietaire ? `(visible dans son portail${aviseParCourriel ? ", envoyée par courriel" : ""})` : ""}
      </label>
      <textarea value={reponse} onChange={(e) => setReponse(e.target.value)} rows={3} style={{ ...champStyle, resize: "vertical" }} placeholder="Ex. : Un plombier passera jeudi entre 8 h et 12 h." />
      <BoutonTexte onClick={() => appeler(`/api/copropriete/demandes/${d.id}`, "PATCH", { reponse })} disabled={enCours || reponse === (d.reponse || "")}>Enregistrer la réponse</BoutonTexte>
      <Erreur texte={erreur} />
    </Section>
  );
}

