"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LigneInfo } from "../../../components/ui";
import { TYPES_UNITE, STATUTS_DEMANDE, argent, pourcent, dateLisible, trouver, soldeUnite, libelle, MODES_PAIEMENT } from "@/lib/coproprieteCalculs";
import { champsCoproprietaire, quotePartDetenue } from "../CoproprietairesClient";
import { Retour, Section, Formulaire, BoutonTexte, BoutonSupprimer, PastilleCode, Vide, Tableau, cellule, celluleDroite, valeursDe, useApi, Erreur } from "../../ui";

export default function CoproprietaireClient({ coproprietaire: c, lien, courrielConfigure }) {
  const actuelles = c.proprietes.filter((p) => !p.dateFin);
  const anciennes = c.proprietes.filter((p) => p.dateFin);
  const soldeTotal = actuelles.reduce((s, p) => s + soldeUnite(p.unite), 0);
  return (
    <div className="conteneur-page">
      <Retour href="/copropriete/coproprietaires">Copropriétaires</Retour>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, margin: "10px 0 14px", flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 21, margin: 0 }}>👤 {c.nom}</h1>
        {actuelles.length > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: soldeTotal > 0.005 ? "var(--danger)" : "var(--success)" }}>{soldeTotal > 0.005 ? `Solde dû : ${argent(soldeTotal)}` : "Comptes à jour"}</span>}
      </div>
      <Fiche c={c} />
      <Section titre="Fractions détenues">
        <LigneInfo label="Nombre de fractions" valeur={String(actuelles.length)} />
        <LigneInfo label="Quote-part dans les parties communes" valeur={pourcent(quotePartDetenue(actuelles))} />
        {actuelles.map((p) => (
          <Link key={p.id} href={`/copropriete/unites/${p.unite.id}`} className="ligne-info" style={{ textDecoration: "none", color: "inherit" }}>
            <span>{trouver(TYPES_UNITE, p.unite.type)?.icone} Unité <strong>{p.unite.numero}</strong> · {pourcent(p.unite.quotePart)}{p.partDetenue < 100 && ` × ${pourcent(p.partDetenue, 2)} détenu`}
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{p.dateDebut && ` · depuis le ${dateLisible(p.dateDebut)}`}</span></span>
            <span style={{ fontWeight: 700, color: soldeUnite(p.unite) > 0.005 ? "var(--danger)" : "var(--text-muted)" }}>{argent(soldeUnite(p.unite))}</span>
          </Link>
        ))}
        {actuelles.length === 0 && <Vide>Aucune unité en ce moment. Pour l'inscrire, va sur la fiche de l'unité → Propriétaires.</Vide>}
        {anciennes.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", margin: "12px 0 4px" }}>Unités détenues auparavant</div>
            {anciennes.map((p) => (
              <div key={p.id} className="ligne-info" style={{ opacity: 0.75 }}>
                <span>Unité {p.unite.numero}</span><span style={{ fontSize: 12 }}>{p.dateDebut ? dateLisible(p.dateDebut) : "?"} → {dateLisible(p.dateFin)}</span>
              </div>
            ))}
          </>
        )}
      </Section>
      <Portail c={c} lien={lien} courrielConfigure={courrielConfigure} />
      <Paiements actuelles={actuelles} />
      <Section titre="Demandes faites">
        {c.demandes.length === 0 ? <Vide>Aucune demande.</Vide> : c.demandes.map((d) => (
          <Link key={d.id} href={`/copropriete/demandes/${d.id}`} className="ligne-info" style={{ textDecoration: "none", color: "inherit" }}>
            <span><strong>{d.numero}</strong> {d.titre} <span style={{ color: "var(--text-muted)", fontSize: 12 }}>· {dateLisible(d.creeLe)}</span></span>
            <PastilleCode liste={STATUTS_DEMANDE} code={d.statut} />
          </Link>
        ))}
      </Section>
    </div>
  );
}

function Fiche({ c }) {
  const router = useRouter();
  const [edition, setEdition] = useState(false);
  return (
    <Section titre="Coordonnées" droite={<BoutonTexte onClick={() => setEdition((v) => !v)}>{edition ? "Annuler" : "Modifier"}</BoutonTexte>}>
      {edition ? (
        <>
          <Formulaire cadre={false} champs={champsCoproprietaire} initial={valeursDe(c, champsCoproprietaire)} url={`/api/copropriete/coproprietaires/${c.id}`} methode="PATCH" onFini={() => setEdition(false)} />
          <div style={{ marginTop: 10 }}>
            <BoutonSupprimer url={`/api/copropriete/coproprietaires/${c.id}`} confirmation={`Supprimer ${c.nom} ? Son historique de propriété sera effacé.`} onFini={() => router.push("/copropriete/coproprietaires")}>Supprimer le copropriétaire</BoutonSupprimer>
          </div>
        </>
      ) : (
        <>
          <LigneInfo label="Téléphone" valeur={c.telephone && <a href={`tel:${c.telephone}`} style={{ color: "var(--accent)" }}>{c.telephone}</a>} />
          {c.telephone2 && <LigneInfo label="Autre téléphone" valeur={c.telephone2} />}
          <LigneInfo label="Courriel" valeur={c.courriel && <a href={`mailto:${c.courriel}`} style={{ color: "var(--accent)" }}>{c.courriel}</a>} />
          <LigneInfo label="Adresse postale" valeur={c.adressePostale} />
          <LigneInfo label="Avis par courriel" valeur={c.avisCourriel ? "Oui" : "Non"} />
          {c.notes && <p style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{c.notes}</p>}
        </>
      )}
    </Section>
  );
}

function Portail({ c, lien, courrielConfigure }) {
  const { appeler, enCours, erreur } = useApi();
  const [message, setMessage] = useState("");
  async function action(a, confirmation) {
    if (confirmation && !window.confirm(confirmation)) return;
    setMessage("");
    const r = await appeler(`/api/copropriete/coproprietaires/${c.id}/portail`, "POST", { action: a });
    if (r && a === "envoyer") setMessage(`Lien envoyé à ${c.courriel}.`);
  }
  async function copier() {
    try { await navigator.clipboard.writeText(lien); setMessage("Lien copié."); } catch { setMessage(lien); }
  }
  return (
    <Section titre="🌐 Portail du copropriétaire">
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
        Espace sécurisé par un lien personnel : documents permis, compte de ses unités, demandes de réparation et leur progression.
        {c.dernierAccesPortail && ` Dernière visite : ${dateLisible(c.dernierAccesPortail)}.`}
      </p>
      {lien ? (
        <>
          <div style={{ fontSize: 12, wordBreak: "break-all", background: "var(--surface-alt)", padding: "8px 10px", borderRadius: 8, marginBottom: 10 }}>{lien}</div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <BoutonTexte onClick={copier}>Copier le lien</BoutonTexte>
            <a href={lien} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>Ouvrir</a>
            {c.courriel && courrielConfigure && <BoutonTexte onClick={() => action("envoyer")} disabled={enCours}>Envoyer par courriel</BoutonTexte>}
            <BoutonTexte onClick={() => action("activer", "Créer un nouveau lien ? L'ancien ne fonctionnera plus.")} disabled={enCours}>Nouveau lien</BoutonTexte>
            <BoutonTexte couleur="var(--danger)" onClick={() => action("desactiver", "Retirer l'accès au portail ?")} disabled={enCours}>Retirer l'accès</BoutonTexte>
          </div>
        </>
      ) : (
        <button type="button" onClick={() => action("activer")} disabled={enCours} className="bouton-3d" style={{ padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>Activer l'accès au portail</button>
      )}
      {message && <p style={{ fontSize: 12, color: "var(--success)", margin: "8px 0 0" }}>{message}</p>}
      <Erreur texte={erreur} />
    </Section>
  );
}

// Historique des paiements de toutes ses unités actuelles
function Paiements({ actuelles }) {
  const paiements = actuelles.flatMap((p) => p.unite.paiements.map((x) => ({ ...x, unite: p.unite.numero }))).sort((a, b) => new Date(b.date) - new Date(a.date));
  return (
    <Section titre="Historique des paiements">
      {paiements.length === 0 ? <Vide>Aucun paiement.</Vide> : (
        <Tableau entetes={["Date", "Unité", "Mode", "Montant"]} alignDroite={[3]}>
          {paiements.slice(0, 24).map((p) => (
            <tr key={p.id}>
              <td style={cellule}>{dateLisible(p.date)}</td>
              <td style={cellule}>{p.unite}</td>
              <td style={cellule}>{[p.mode && libelle(MODES_PAIEMENT, p.mode), p.reference].filter(Boolean).join(" · ") || "—"}</td>
              <td style={celluleDroite}>{argent(p.montant)}</td>
            </tr>
          ))}
        </Tableau>
      )}
    </Section>
  );
}
