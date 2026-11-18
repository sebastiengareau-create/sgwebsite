"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORIES_DOCUMENTS, CATEGORIES_REPARATION, STATUTS_REPARATION, STATUTS_BAIL, MODES_PAIEMENT,
  argent, dateLisible, soldeBail, releveBail, trouver, libelle, taille, servicesLisibles, adresseLogement, nomLogement, ajouterMois, dureeMois,
} from "@/lib/immobilierCalculs";
import { Onglets, PastilleCode, ChampsFormulaire, Erreur, boutonPrincipal, labelStyle } from "@/app/copropriete/ui";
import BandeauSection from "@/app/components/BandeauSection";
import { Icone, TEINTES, CarteChiffre, Pastille, TitrePanneau, BoutonAction, stylePanneau } from "@/app/components/StyleSection";

function Bloc({ icone = "liste", teinte = TEINTES.ambre, titre, sousTitre, droite, children, style }) {
  return (
    <div style={{ ...stylePanneau, ...style }}>
      <TitrePanneau icone={icone} teinte={teinte} titre={titre} sousTitre={sousTitre} droite={droite} />
      {children}
    </div>
  );
}

function Vide({ children }) {
  return <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: 0 }}>{children}</p>;
}

function Ligne({ label, valeur, premiere }) {
  if (valeur == null || valeur === "") return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 2px", borderTop: premiere ? "none" : "1px solid var(--border)", fontSize: 13.5 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 700, textAlign: "right" }}>{valeur}</span>
    </div>
  );
}

const ONGLETS = [
  { code: "LOGEMENT", label: "Mon logement" },
  { code: "DOCUMENTS", label: "Documents" },
  { code: "REPARATIONS", label: "Réparations" },
];

const jour = (n) => (n === 1 ? "1er" : String(n));

export default function PortailLocataireClient({ jeton, locataire, entreprise, baux, documents, reparations }) {
  const [onglet, setOnglet] = useState("LOGEMENT");
  const actifs = baux.filter((b) => b.statut === "ACTIF");
  // Anciens baux : seulement s'il y reste un solde
  const anciens = baux.filter((b) => b.statut !== "ACTIF" && Math.abs(soldeBail(b)) > 0.005);
  const solde = [...actifs, ...anciens].reduce((t, b) => t + soldeBail(b), 0);
  const ouvertes = reparations.filter((r) => trouver(STATUTS_REPARATION, r.statut)?.ouverte).length;
  const avisAttente = actifs.filter((b) => b.avisEnvoyeLe && !b.reponseAvis && b.dateFin);
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div className="conteneur-page">
        <BandeauSection icone="🏠" titre={`Bonjour ${locataire.nom}`} sousTitre={`${entreprise.nom} · Espace locataire`}>
          {(entreprise.telephone || entreprise.courriel) && (
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 12.5, margin: "6px 0 0" }}>
              Propriétaire : {[entreprise.telephone, entreprise.courriel].filter(Boolean).join(" · ")}
            </p>
          )}
        </BandeauSection>

        <div className="grille-trois" style={{ marginBottom: 20 }}>
          <CarteChiffre
            titre={solde < -0.005 ? "Payé d'avance" : "Solde dû"} montant={argent(Math.abs(solde))}
            teinte={solde > 0.005 ? "var(--danger)" : "var(--success)"} couleur={solde > 0.005 ? "var(--danger)" : "var(--success)"}
            note={solde > 0.005 ? "Loyer à payer" : "Votre compte est à jour"} onClick={() => setOnglet("LOGEMENT")}
          />
          <CarteChiffre titre="Réparations en cours" montant={String(ouvertes)} teinte="var(--accent)" note={`${reparations.length} au total`} onClick={() => setOnglet("REPARATIONS")} />
          <CarteChiffre titre="Documents" montant={String(documents.length)} teinte="var(--bleu)" note="Bail, avis, reçus…" onClick={() => setOnglet("DOCUMENTS")} />
        </div>

        {avisAttente.map((b) => <ReponseAvis key={b.id} bail={b} jeton={jeton} />)}

        <Onglets options={ONGLETS} valeur={onglet} onChange={setOnglet} />
        {onglet === "LOGEMENT" && (
          <>
            {actifs.length === 0 && <Bloc icone="maison" teinte={TEINTES.bleu} titre="Mon logement"><Vide>Aucun bail en cours à votre nom.</Vide></Bloc>}
            {actifs.map((b) => <Bail key={b.id} bail={b} jeton={jeton} locataireId={locataire.id} />)}
            {anciens.map((b) => <Bail key={b.id} bail={b} jeton={jeton} locataireId={locataire.id} ancien />)}
          </>
        )}
        {onglet === "DOCUMENTS" && <Documents documents={documents} jeton={jeton} />}
        {onglet === "REPARATIONS" && <Reparations reparations={reparations} actifs={actifs} jeton={jeton} locataireId={locataire.id} />}
        <p style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", textAlign: "center", margin: "24px 0 8px" }}>
          <Icone nom="cadenas" taille={14} couleur="var(--text-muted)" /> Ce lien vous est personnel : ne le partagez pas.
        </p>
      </div>
    </div>
  );
}

// Avis de modification en attente : le locataire répond d'ici un mois
function ReponseAvis({ bail, jeton }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const debut = new Date(new Date(bail.dateFin).getTime() + 86400000);
  const limite = ajouterMois(bail.avisEnvoyeLe, 1);
  const choix = [
    { code: "ACCEPTE", label: `J'accepte (nouveau loyer de ${argent(bail.nouveauLoyer ?? bail.loyer)})`, confirmation: "Confirmer : vous acceptez la modification du bail." },
    { code: "REFUSE", label: "Je refuse et je reste", confirmation: "Confirmer : vous refusez la modification et demeurez dans le logement. Le propriétaire pourra demander au Tribunal administratif du logement de fixer le loyer." },
    { code: "QUITTE", label: "Je quitte à la fin du bail", confirmation: `Confirmer : vous quitterez le logement à la fin du bail, le ${dateLisible(bail.dateFin)}.` },
  ];
  async function repondre(c) {
    if (!window.confirm(`${c.confirmation}\n\nVotre réponse sera transmise au propriétaire et ne pourra plus être changée ici.`)) return;
    setEnCours(true);
    setErreur("");
    const res = await fetch(`/api/portail-locataire/${jeton}/avis`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bailId: bail.id, reponse: c.code }) });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) return setErreur(data.erreur || "Envoi impossible.");
    router.refresh();
  }
  return (
    <Bloc icone="cloche" teinte={TEINTES.ambre} titre="Avis de modification de votre bail" sousTitre={`Reçu le ${dateLisible(bail.avisEnvoyeLe)} · réponse attendue d'ici le ${dateLisible(limite)}`} style={{ border: "1.5px solid var(--accent)" }}>
      <p style={{ fontSize: 13.5, margin: "0 0 10px" }}>
        À compter du <strong>{dateLisible(debut)}</strong>, votre loyer passerait de <strong>{argent(bail.loyer)}</strong> à <strong>{argent(bail.nouveauLoyer ?? bail.loyer)}</strong> par mois. Sans réponse d'ici un mois après la réception de l'avis, vous êtes réputé accepter.
      </p>
      <div style={{ display: "grid", gap: 8 }}>
        {choix.map((c) => <BoutonAction key={c.code} icone={c.code === "ACCEPTE" ? "crochet" : c.code === "QUITTE" ? "chevron" : "bloque"} onClick={() => repondre(c)} disabled={enCours}>{c.label}</BoutonAction>)}
      </div>
      <Erreur texte={erreur} />
    </Bloc>
  );
}

function Bail({ bail, jeton, ancien }) {
  const [tout, setTout] = useState(false);
  const solde = soldeBail(bail);
  const releve = releveBail(bail).reverse();
  const etat = solde > 0.005
    ? { texte: `Solde dû : ${argent(solde)}`, couleur: "var(--danger)", fond: "var(--danger-fond)" }
    : solde < -0.005
      ? { texte: `Payé d'avance : ${argent(-solde)}`, couleur: "var(--success)", fond: "var(--success-fond)" }
      : { texte: "À jour", couleur: "var(--success)", fond: "var(--success-fond)" };
  const colocataires = bail.locataires.map((l) => l.nom).join(", ");
  const duree = dureeMois(bail);
  return (
    <Bloc
      icone="maison" teinte={TEINTES.bleu} titre={ancien ? `Ancien bail — ${nomLogement(bail.logement)}` : nomLogement(bail.logement)}
      sousTitre={adresseLogement(bail.logement)}
      droite={<Pastille couleur={etat.couleur} fond={etat.fond}>{etat.texte}</Pastille>}
    >
      {!ancien && (
        <>
          <Ligne premiere label="Loyer" valeur={`${argent(bail.loyer)} par mois, payable le ${jour(bail.jourPaiement)}`} />
          <Ligne label="Bail" valeur={bail.dateFin ? `du ${dateLisible(bail.dateDebut)} au ${dateLisible(bail.dateFin)}${duree ? ` (${duree} mois)` : ""}` : `depuis le ${dateLisible(bail.dateDebut)}, durée indéterminée`} />
          <Ligne label="Le loyer comprend" valeur={servicesLisibles(bail.services)} />
          <Ligne label="Pièces" valeur={bail.logement.pieces} />
          {bail.locataires.length > 1 && <Ligne label="Locataires" valeur={colocataires} />}
          {bail.reponseAvis && <Ligne label="Renouvellement" valeur={bail.reponseAvis === "QUITTE" ? `Départ prévu le ${dateLisible(bail.dateFin)}` : bail.reponseAvis === "ACCEPTE" ? `Nouveau loyer de ${argent(bail.nouveauLoyer ?? bail.loyer)} accepté` : "Modification refusée"} />}
        </>
      )}
      {ancien && <Ligne premiere label="Bail" valeur={<PastilleCode liste={STATUTS_BAIL} code={bail.statut} />} />}
      {releve.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", margin: "14px 0 6px" }}>Relevé de compte</div>
          {(tout ? releve : releve.slice(0, 8)).map((l, i) => (
            <div key={`${l.genre}-${l.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "9px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>
                  {l.genre === "paiement" ? "Paiement reçu" : l.libelle}
                  {l.genre === "paiement" && <> · <a href={`/api/portail-locataire/${jeton}/recus/${l.id}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent-ombre)", fontWeight: 700 }}>reçu</a></>}
                </span>
                <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>{dateLisible(l.date)}{l.genre === "paiement" && bail.paiements.find((p) => p.id === l.id)?.mode ? ` · ${libelle(MODES_PAIEMENT, bail.paiements.find((p) => p.id === l.id).mode)}` : ""}</span>
              </span>
              <span style={{ textAlign: "right", flexShrink: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 800, color: l.montant < 0 ? "var(--success)" : "var(--text)" }}>{argent(l.montant)}</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>Solde {argent(l.solde)}</span>
              </span>
            </div>
          ))}
          {releve.length > 8 && !tout && <BoutonAction icone="liste" onClick={() => setTout(true)} style={{ width: "100%", marginTop: 10 }}>Tout le relevé ({releve.length} lignes)</BoutonAction>}
        </>
      )}
    </Bloc>
  );
}

function LienDocument({ d, jeton, premiere }) {
  return (
    <a href={`/api/portail-locataire/${jeton}/documents/${d.id}`} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 2px", borderTop: premiere ? "none" : "1px solid var(--border)", textDecoration: "none", color: "var(--text)" }}>
      <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: TEINTES.bleu.fond, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icone nom="document" taille={18} couleur={TEINTES.bleu.couleur} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{d.titre}</span>
        <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>{dateLisible(d.date || d.creeLe)} · {taille(d.taille)}</span>
      </span>
      <Icone nom="chevron" taille={16} couleur="var(--text-muted)" />
    </a>
  );
}

function Documents({ documents, jeton }) {
  if (documents.length === 0) return <Bloc icone="document" teinte={TEINTES.bleu} titre="Documents"><Vide>Aucun document pour le moment.</Vide></Bloc>;
  const categories = CATEGORIES_DOCUMENTS.map((c) => ({ ...c, docs: documents.filter((d) => d.categorie === c.code) })).filter((c) => c.docs.length > 0);
  return categories.map((c) => (
    <Bloc key={c.code} icone="document" teinte={TEINTES.bleu} titre={c.label} sousTitre={`${c.docs.length} document${c.docs.length > 1 ? "s" : ""}`}>
      {c.docs.map((d, i) => <LienDocument key={d.id} d={d} jeton={jeton} premiere={i === 0} />)}
    </Bloc>
  ));
}

function Reparations({ reparations, actifs, jeton, locataireId }) {
  const [formulaire, setFormulaire] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  return (
    <>
      {confirmation && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--success-fond)", border: "1px solid var(--success)", borderRadius: 12, padding: "10px 14px", fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>
          <Icone nom="crochet" taille={16} couleur="var(--success)" /> {confirmation}
        </div>
      )}
      {actifs.length > 0 && (formulaire ? (
        <NouvelleDemande actifs={actifs} jeton={jeton} onFini={(numero) => { setFormulaire(false); setConfirmation(`Demande ${numero} reçue. Vous serez avisé de sa progression.`); }} onAnnuler={() => setFormulaire(false)} />
      ) : (
        <button type="button" onClick={() => { setFormulaire(true); setConfirmation(""); }} className="bouton-3d" style={{ ...boutonPrincipal, marginBottom: 16 }}>+ Demander une réparation</button>
      ))}
      {reparations.length === 0 && <Bloc icone="outils" teinte={TEINTES.ambre} titre="Réparations"><Vide>Aucune demande pour le moment.</Vide></Bloc>}
      {reparations.map((r) => (
        <Bloc
          key={r.id} icone="outils" teinte={TEINTES.ambre} titre={r.titre}
          sousTitre={[r.numero, r.logement ? nomLogement(r.logement) : "parties communes", r.locataireId === locataireId ? `demandée le ${dateLisible(r.creeLe)}` : `inscrite le ${dateLisible(r.creeLe)}`].join(" · ")}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            <PastilleCode liste={STATUTS_REPARATION} code={r.statut} />
            {r.datePrevue && trouver(STATUTS_REPARATION, r.statut)?.ouverte && <Pastille couleur={TEINTES.bleu.couleur} fond={TEINTES.bleu.fond}>Travaux prévus le {dateLisible(r.datePrevue)}</Pastille>}
            {r.dateFin && r.statut === "TERMINEE" && <Pastille couleur="var(--success)" fond="var(--success-fond)">Terminée le {dateLisible(r.dateFin)}</Pastille>}
          </div>
          {r.description && <p style={{ fontSize: 13.5, whiteSpace: "pre-wrap", margin: 0, padding: "10px 12px", borderRadius: 12, background: "var(--bg)" }}>{r.description}</p>}
          {r.fichiers.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {r.fichiers.map((f) => (
                <a key={f.id} href={`/api/portail-locataire/${jeton}/fichiers/${f.id}`} target="_blank" rel="noreferrer">
                  {f.typeMime.startsWith("image/") && !/heic|heif/.test(f.typeMime)
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={`/api/portail-locataire/${jeton}/fichiers/${f.id}`} alt={f.nom} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 12, border: "1px solid var(--border)" }} />
                    : <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--accent-ombre)", padding: "6px 10px", borderRadius: 10, border: "1px solid var(--border)" }}><Icone nom="document" taille={14} couleur="var(--accent-ombre)" /> {f.nom}</span>}
                </a>
              ))}
            </div>
          )}
          {r.reponse && (
            <div style={{ background: "rgba(232,163,61,0.12)", borderRadius: 12, padding: "10px 12px", marginTop: 10, fontSize: 13.5, whiteSpace: "pre-wrap" }}>
              <strong style={{ color: "var(--accent-ombre)" }}>Réponse du propriétaire :</strong> {r.reponse}
            </div>
          )}
        </Bloc>
      ))}
    </>
  );
}

function NouvelleDemande({ actifs, jeton, onFini, onAnnuler }) {
  const router = useRouter();
  const [valeurs, setValeurs] = useState({ titre: "", description: "", categorie: "", logementId: actifs[0].logement.id, urgente: false });
  const [fichiers, setFichiers] = useState([]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const maj = (nom, v) => setValeurs((x) => ({ ...x, [nom]: v }));
  const champs = [
    { nom: "logementId", label: "Où ?", type: "choix", vide: "Parties communes de l'immeuble", options: actifs.map((b) => ({ code: b.logement.id, label: `Mon logement — ${nomLogement(b.logement)}` })) },
    { nom: "categorie", label: "Catégorie", type: "choix", vide: "Je ne sais pas", options: CATEGORIES_REPARATION },
    { nom: "titre", label: "En quelques mots", placeholder: "Ex. : le robinet de la cuisine coule", pleineLargeur: true },
    { nom: "description", label: "Description (depuis quand, à quel endroit, disponibilités pour l'accès…)", type: "long", lignes: 4 },
    { nom: "urgente", label: "C'est urgent (dégât d'eau, pas de chauffage, danger…)", type: "case" },
  ];
  async function envoyer() {
    setErreur("");
    if (!valeurs.titre.trim()) return setErreur("Décrivez le problème en quelques mots.");
    setEnCours(true);
    const fd = new FormData();
    fd.append("titre", valeurs.titre);
    fd.append("description", valeurs.description);
    fd.append("categorie", valeurs.categorie);
    fd.append("logementId", valeurs.logementId || "");
    fd.append("urgente", valeurs.urgente ? "oui" : "");
    for (const f of fichiers) fd.append("fichier", f);
    const res = await fetch(`/api/portail-locataire/${jeton}/reparations`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) return setErreur(data.erreur || "Envoi impossible. Réessayez.");
    router.refresh();
    onFini(data.numero);
  }
  return (
    <div style={{ ...stylePanneau, border: "1.5px solid var(--accent)" }}>
      <TitrePanneau icone="outils" teinte={TEINTES.ambre} titre="Nouvelle demande de réparation" sousTitre="Décrivez le problème : le propriétaire vous répondra ici." />
      <ChampsFormulaire champs={champs} valeurs={valeurs} maj={maj} />
      <label style={labelStyle}>Photos (jusqu'à 6)</label>
      <input type="file" accept="image/*,.pdf" multiple onChange={(e) => setFichiers([...(e.target.files || [])].slice(0, 6))} style={{ fontSize: 13, marginBottom: 10 }} />
      {fichiers.length > 0 && <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{fichiers.length} fichier{fichiers.length > 1 ? "s" : ""} choisi{fichiers.length > 1 ? "s" : ""}</div>}
      <Erreur texte={erreur} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button type="button" onClick={envoyer} disabled={enCours} className="bouton-3d" style={{ ...boutonPrincipal, width: "auto" }}>{enCours ? "Envoi…" : "Envoyer la demande"}</button>
        <BoutonAction icone="bloque" couleur="var(--text-muted)" onClick={onAnnuler}>Annuler</BoutonAction>
      </div>
    </div>
  );
}
