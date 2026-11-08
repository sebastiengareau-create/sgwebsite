"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORIES_DOCUMENTS, CATEGORIES_TRAVAUX, STATUTS_DEMANDE, TYPES_UNITE, TYPES_ESPACE, TYPES_DEMANDE,
  argent, pourcent, dateLisible, soldeUnite, releveUnite, trouver, libelle, taille,
} from "@/lib/coproprieteCalculs";
import { Onglets, PastilleCode, ChampsFormulaire, Erreur, boutonPrincipal, labelStyle } from "@/app/copropriete/ui";
import BandeauSection from "@/app/components/BandeauSection";
import { Icone, TEINTES, CarteChiffre, Pastille, TitrePanneau, BoutonAction, stylePanneau } from "@/app/components/StyleSection";

// Panneau titré avec icône (le portail a ses propres panneaux : les
// composants du module Copropriété, eux, servent aussi aux pages de l'équipe)
function Bloc({ icone = "liste", teinte = TEINTES.ambre, titre, sousTitre, droite, children }) {
  return (
    <div style={stylePanneau}>
      <TitrePanneau icone={icone} teinte={teinte} titre={titre} sousTitre={sousTitre} droite={droite} />
      {children}
    </div>
  );
}

function Vide({ children }) {
  return <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: 0 }}>{children}</p>;
}

// Ligne « libellé … valeur » séparée par un trait
function Ligne({ label, valeur, premiere }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 2px", borderTop: premiere ? "none" : "1px solid var(--border)", fontSize: 13.5 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 700, textAlign: "right" }}>{valeur}</span>
    </div>
  );
}

const ONGLETS = [
  { code: "ACCUEIL", label: "Mon unité" },
  { code: "DOCUMENTS", label: "Documents" },
  { code: "DEMANDES", label: "Demandes" },
];

export default function PortailClient({ jeton, coproprietaire, entreprise, proprietes, documents, demandes }) {
  const [onglet, setOnglet] = useState("ACCUEIL");
  const avis = documents.filter((d) => d.categorie === "AVIS").slice(0, 3);
  const soldeTotal = proprietes.reduce((t, p) => t + soldeUnite(p.unite), 0);
  const ouvertes = demandes.filter((d) => trouver(STATUTS_DEMANDE, d.statut)?.ouverte).length;
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div className="conteneur-page">
        <BandeauSection icone="🏢" titre={`Bonjour ${coproprietaire.nom}`} sousTitre={`${entreprise.nom} · Espace copropriétaire`}>
          {(entreprise.telephone || entreprise.courriel) && (
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 12.5, margin: "6px 0 0" }}>
              Administration : {[entreprise.telephone, entreprise.courriel].filter(Boolean).join(" · ")}
            </p>
          )}
        </BandeauSection>

        <div className="grille-trois" style={{ marginBottom: 20 }}>
          <CarteChiffre
            titre={soldeTotal < -0.005 ? "Crédit à votre compte" : "Solde dû"} montant={argent(Math.abs(soldeTotal))}
            teinte={soldeTotal > 0.005 ? "var(--danger)" : "var(--success)"} couleur={soldeTotal > 0.005 ? "var(--danger)" : "var(--success)"}
            note={soldeTotal > 0.005 ? "Charges à payer" : "Votre compte est à jour"}
            onClick={() => setOnglet("ACCUEIL")}
          />
          <CarteChiffre titre="Demandes en cours" montant={String(ouvertes)} teinte="var(--accent)" note={`${demandes.length} au total`} onClick={() => setOnglet("DEMANDES")} />
          <CarteChiffre titre="Documents" montant={String(documents.length)} teinte="var(--bleu)" note={avis.length > 0 ? `${avis.length} avis récent${avis.length > 1 ? "s" : ""}` : "Règlements, procès-verbaux…"} onClick={() => setOnglet("DOCUMENTS")} />
        </div>

        <Onglets options={ONGLETS} valeur={onglet} onChange={setOnglet} />
        {onglet === "ACCUEIL" && <Accueil proprietes={proprietes} avis={avis} jeton={jeton} demandes={demandes} allerA={setOnglet} />}
        {onglet === "DOCUMENTS" && <Documents documents={documents} jeton={jeton} />}
        {onglet === "DEMANDES" && <Demandes demandes={demandes} proprietes={proprietes} jeton={jeton} />}
        <p style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", textAlign: "center", margin: "24px 0 8px" }}>
          <Icone nom="cadenas" taille={14} couleur="var(--text-muted)" /> Ce lien vous est personnel : ne le partagez pas.
        </p>
      </div>
    </div>
  );
}

function Accueil({ proprietes, avis, jeton, demandes, allerA }) {
  const ouvertes = demandes.filter((d) => trouver(STATUTS_DEMANDE, d.statut)?.ouverte);
  return (
    <>
      {avis.length > 0 && (
        <Bloc icone="cloche" teinte={TEINTES.ambre} titre="Derniers avis">
          {avis.map((d, i) => <LienDocument key={d.id} d={d} jeton={jeton} premiere={i === 0} />)}
        </Bloc>
      )}
      {proprietes.length === 0 && <Bloc icone="immeuble" teinte={TEINTES.bleu} titre="Mes unités"><Vide>Aucune unité n'est inscrite à votre nom en ce moment.</Vide></Bloc>}
      {proprietes.map((p) => <Unite key={p.id} p={p} />)}
      {ouvertes.length > 0 && (
        <Bloc
          icone="outils" teinte={TEINTES.ambre} titre="Demandes en cours"
          droite={<button type="button" onClick={() => allerA("DEMANDES")} style={{ background: "none", border: "none", color: "var(--accent-ombre)", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Tout voir</button>}
        >
          {ouvertes.map((d, i) => (
            <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
              <span style={{ fontSize: 14, minWidth: 0 }}><strong>{d.numero}</strong> {d.titre}</span>
              <PastilleCode liste={STATUTS_DEMANDE} code={d.statut} />
            </div>
          ))}
        </Bloc>
      )}
    </>
  );
}

function Unite({ p }) {
  const [tout, setTout] = useState(false);
  const u = p.unite;
  const solde = soldeUnite(u);
  const releve = releveUnite(u).reverse();
  const etat = solde > 0.005
    ? { texte: `Solde dû : ${argent(solde)}`, couleur: "var(--danger)", fond: "var(--danger-fond)" }
    : solde < -0.005
      ? { texte: `Crédit : ${argent(-solde)}`, couleur: "var(--success)", fond: "var(--success-fond)" }
      : { texte: "À jour", couleur: "var(--success)", fond: "var(--success-fond)" };
  return (
    <Bloc
      icone="immeuble" teinte={TEINTES.bleu} titre={`Unité ${u.numero}`} sousTitre={libelle(TYPES_UNITE, u.type)}
      droite={<Pastille couleur={etat.couleur} fond={etat.fond}>{etat.texte}</Pastille>}
    >
      <Ligne premiere label="Quote-part" valeur={<>{pourcent(u.quotePart)}{p.partDetenue < 100 && ` (vous en détenez ${pourcent(p.partDetenue, 2)})`}</>} />
      {u.batiment && <Ligne label="Bâtiment" valeur={u.batiment.nom} />}
      {u.espaces.map((e) => (
        <Ligne key={e.id} label={libelle(TYPES_ESPACE, e.type)} valeur={<>{e.numero}{e.emplacement && ` · ${e.emplacement}`}</>} />
      ))}
      {releve.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", margin: "14px 0 6px" }}>Relevé de compte</div>
          {(tout ? releve : releve.slice(0, 8)).map((l, i) => (
            <div key={`${l.genre}-${l.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "9px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>{l.genre === "paiement" ? "Paiement reçu" : l.libelle}</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>{dateLisible(l.date)}</span>
              </span>
              <span style={{ textAlign: "right", flexShrink: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 800, color: l.montant < 0 ? "var(--success)" : "var(--text)" }}>{argent(l.montant)}</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>Solde {argent(l.solde)}</span>
              </span>
            </div>
          ))}
          {releve.length > 8 && !tout && (
            <BoutonAction icone="liste" onClick={() => setTout(true)} style={{ width: "100%", marginTop: 10 }}>Tout le relevé ({releve.length} lignes)</BoutonAction>
          )}
        </>
      )}
    </Bloc>
  );
}

function LienDocument({ d, jeton, premiere }) {
  return (
    <a href={`/api/portail-copro/${jeton}/documents/${d.id}`} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 2px", borderTop: premiere ? "none" : "1px solid var(--border)", textDecoration: "none", color: "var(--text)" }}>
      <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: TEINTES.bleu.fond, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icone nom="document" taille={18} couleur={TEINTES.bleu.couleur} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{d.titre}</span>
        {d.description && <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)" }}>{d.description}</span>}
        <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>{d.date ? dateLisible(d.date) : dateLisible(d.creeLe)} · {taille(d.taille)}</span>
      </span>
      <Icone nom="chevron" taille={16} couleur="var(--text-muted)" />
    </a>
  );
}

function Documents({ documents, jeton }) {
  const [categorie, setCategorie] = useState("");
  const categories = CATEGORIES_DOCUMENTS.map((c) => ({ ...c, docs: documents.filter((d) => d.categorie === c.code) })).filter((c) => c.docs.length > 0);
  if (documents.length === 0) return <Bloc icone="document" teinte={TEINTES.bleu} titre="Documents"><Vide>Aucun document pour le moment.</Vide></Bloc>;
  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {[{ code: "", label: "Tous", icone: "🗂️" }, ...categories].map((c) => {
          const actif = categorie === c.code;
          return (
            <button key={c.code} type="button" onClick={() => setCategorie(c.code)} style={{ fontSize: 13, padding: "7px 12px", borderRadius: 999, cursor: "pointer", border: `1px solid ${actif ? "var(--accent)" : "var(--border)"}`, background: actif ? "var(--accent)" : "var(--surface)", color: actif ? "#221f18" : "var(--text)", fontWeight: 700, fontFamily: "inherit" }}>
              {c.icone} {c.label}
            </button>
          );
        })}
      </div>
      {categories.filter((c) => !categorie || c.code === categorie).map((c) => (
        <Bloc key={c.code} icone="document" teinte={TEINTES.bleu} titre={c.label} sousTitre={`${c.docs.length} document${c.docs.length > 1 ? "s" : ""}`}>
          {c.docs.map((d, i) => <LienDocument key={d.id} d={d} jeton={jeton} premiere={i === 0} />)}
        </Bloc>
      ))}
    </>
  );
}

function Demandes({ demandes, proprietes, jeton }) {
  const [formulaire, setFormulaire] = useState(demandes.length === 0);
  const [confirmation, setConfirmation] = useState("");
  return (
    <>
      {confirmation && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--success-fond)", border: "1px solid var(--success)", borderRadius: 12, padding: "10px 14px", fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>
          <Icone nom="crochet" taille={16} couleur="var(--success)" /> {confirmation}
        </div>
      )}
      {formulaire ? (
        <NouvelleDemande proprietes={proprietes} jeton={jeton} onFini={(numero) => { setFormulaire(false); setConfirmation(`Demande ${numero} reçue. Vous serez avisé de sa progression.`); }} onAnnuler={demandes.length > 0 ? () => setFormulaire(false) : null} />
      ) : (
        <button type="button" onClick={() => { setFormulaire(true); setConfirmation(""); }} className="bouton-3d" style={{ ...boutonPrincipal, marginBottom: 16 }}>+ Faire une demande ou signaler un problème</button>
      )}
      {demandes.map((d) => <Demande key={d.id} d={d} jeton={jeton} />)}
    </>
  );
}

function Demande({ d, jeton }) {
  const suivis = d.travaux.flatMap((t) => t.suivis).sort((a, b) => new Date(b.date) - new Date(a.date));
  const planifie = d.travaux.find((t) => t.datePrevue && t.statut !== "TERMINE" && t.statut !== "ANNULE");
  return (
    <Bloc
      icone="outils" teinte={TEINTES.ambre} titre={d.titre}
      sousTitre={[d.numero, libelle(TYPES_DEMANDE, d.type), d.unite ? `unité ${d.unite.numero}` : d.emplacement || "parties communes", `envoyée le ${dateLisible(d.creeLe)}`].join(" · ")}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        <PastilleCode liste={STATUTS_DEMANDE} code={d.statut} />
        {planifie && <Pastille couleur={TEINTES.bleu.couleur} fond={TEINTES.bleu.fond}>Travaux prévus le {dateLisible(planifie.datePrevue)}</Pastille>}
      </div>
      {d.description && <p style={{ fontSize: 13.5, whiteSpace: "pre-wrap", margin: 0, padding: "10px 12px", borderRadius: 12, background: "var(--bg)" }}>{d.description}</p>}
      {d.fichiers.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {d.fichiers.map((f) => (
            <a key={f.id} href={`/api/portail-copro/${jeton}/fichiers/${f.id}`} target="_blank" rel="noreferrer">
              {f.typeMime.startsWith("image/") && !/heic|heif/.test(f.typeMime)
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={`/api/portail-copro/${jeton}/fichiers/${f.id}`} alt={f.nom} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 12, border: "1px solid var(--border)" }} />
                : <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--accent-ombre)", padding: "6px 10px", borderRadius: 10, border: "1px solid var(--border)" }}><Icone nom="document" taille={14} couleur="var(--accent-ombre)" /> {f.nom}</span>}
            </a>
          ))}
        </div>
      )}
      {d.reponse && (
        <div style={{ background: "rgba(232,163,61,0.12)", borderRadius: 12, padding: "10px 12px", marginTop: 10, fontSize: 13.5, whiteSpace: "pre-wrap" }}>
          <strong style={{ color: "var(--accent-ombre)" }}>Réponse de l'administration :</strong> {d.reponse}
        </div>
      )}
      {suivis.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>Suivi des travaux</div>
          {suivis.map((s) => (
            <div key={s.id} style={{ borderLeft: "3px solid var(--accent)", padding: "2px 0 2px 12px", marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{dateLisible(s.date)}</div>
              <div style={{ fontSize: 13.5, whiteSpace: "pre-wrap" }}>{s.texte}</div>
            </div>
          ))}
        </div>
      )}
    </Bloc>
  );
}

function NouvelleDemande({ proprietes, jeton, onFini, onAnnuler }) {
  const router = useRouter();
  const unites = proprietes.map((p) => p.unite);
  const [valeurs, setValeurs] = useState({ type: "REPARATION", titre: "", description: "", categorie: "", uniteId: unites.length === 1 ? unites[0].id : "", emplacement: "", priorite: "NORMALE" });
  const [fichiers, setFichiers] = useState([]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const maj = (nom, v) => setValeurs((x) => ({ ...x, [nom]: v }));
  const champs = [
    { nom: "type", label: "Je veux…", type: "choix", options: [{ code: "REPARATION", label: "Demander une réparation" }, { code: "SIGNALEMENT", label: "Signaler un problème" }] },
    { nom: "uniteId", label: "Où ?", type: "choix", vide: "Parties communes", options: unites.map((u) => ({ code: u.id, label: `Mon unité ${u.numero}` })) },
    { nom: "titre", label: "En quelques mots", placeholder: "Ex. : Fuite d'eau au plafond de la salle de bain", pleineLargeur: true },
    { nom: "emplacement", label: "Endroit précis", placeholder: "Ex. : corridor du 3e, garage P1, porte d'entrée…" },
    { nom: "categorie", label: "Catégorie", type: "choix", vide: "Je ne sais pas", options: CATEGORIES_TRAVAUX },
    { nom: "description", label: "Description (depuis quand, à quelle fréquence…)", type: "long", lignes: 4 },
    { nom: "urgente", label: "C'est urgent (dégât d'eau, danger, bris de sécurité…)", type: "case" },
  ];

  async function envoyer() {
    setErreur("");
    if (!valeurs.titre.trim()) return setErreur("Décrivez le problème en quelques mots.");
    setEnCours(true);
    const fd = new FormData();
    for (const [k, v] of Object.entries(valeurs)) if (k !== "urgente") fd.append(k, v ?? "");
    fd.set("priorite", valeurs.urgente ? "URGENTE" : "NORMALE");
    for (const f of fichiers) fd.append("fichier", f);
    const res = await fetch(`/api/portail-copro/${jeton}/demandes`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) return setErreur(data.erreur || "Envoi impossible. Réessayez.");
    router.refresh();
    onFini(data.numero);
  }

  return (
    <div style={{ ...stylePanneau, border: "1.5px solid var(--accent)" }}>
      <TitrePanneau icone="outils" teinte={TEINTES.ambre} titre="Nouvelle demande" sousTitre="Décrivez le problème : l'administration vous répondra ici." />
      <ChampsFormulaire champs={champs} valeurs={valeurs} maj={maj} />
      <label style={labelStyle}>Photos (jusqu'à 6)</label>
      <input type="file" accept="image/*,.pdf" multiple onChange={(e) => setFichiers([...(e.target.files || [])].slice(0, 6))} style={{ fontSize: 13, marginBottom: 10 }} />
      {fichiers.length > 0 && <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{fichiers.length} fichier{fichiers.length > 1 ? "s" : ""} choisi{fichiers.length > 1 ? "s" : ""}</div>}
      <Erreur texte={erreur} />
      <div style={{ display: "grid", gridTemplateColumns: onAnnuler ? "1fr 1fr" : "1fr", gap: 8 }}>
        <button type="button" onClick={envoyer} disabled={enCours} className="bouton-3d" style={{ ...boutonPrincipal, width: "auto" }}>{enCours ? "Envoi…" : "Envoyer la demande"}</button>
        {onAnnuler && <BoutonAction icone="bloque" couleur="var(--text-muted)" onClick={onAnnuler}>Annuler</BoutonAction>}
      </div>
    </div>
  );
}
