"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORIES_DOCUMENTS, CATEGORIES_TRAVAUX, STATUTS_DEMANDE, TYPES_UNITE, TYPES_ESPACE, TYPES_DEMANDE,
  argent, pourcent, dateLisible, soldeUnite, releveUnite, trouver, libelle, taille,
} from "@/lib/coproprieteCalculs";
import { Onglets, Section, PastilleCode, Vide, ChampsFormulaire, Erreur, boutonPrincipal, labelStyle, Tableau, cellule, celluleDroite } from "@/app/copropriete/ui";

const ONGLETS = [
  { code: "ACCUEIL", label: "🏠 Mon unité" },
  { code: "DOCUMENTS", label: "📁 Documents" },
  { code: "DEMANDES", label: "🛠️ Demandes" },
];

export default function PortailClient({ jeton, coproprietaire, entreprise, proprietes, documents, demandes }) {
  const [onglet, setOnglet] = useState("ACCUEIL");
  const avis = documents.filter((d) => d.categorie === "AVIS").slice(0, 3);
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div className="conteneur-page" style={{ maxWidth: 880, margin: "0 auto" }}>
        <div style={{ borderRadius: 16, padding: "22px 20px", marginBottom: 16, background: "linear-gradient(135deg, #241b0f 0%, var(--accent-ombre) 100%)", color: "#fff" }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>{entreprise.nom} · Espace copropriétaire</div>
          <h1 style={{ fontSize: 21, margin: "4px 0 0" }}>Bonjour {coproprietaire.nom}</h1>
          {(entreprise.telephone || entreprise.courriel) && (
            <div style={{ fontSize: 12.5, opacity: 0.8, marginTop: 6 }}>
              Administration : {[entreprise.telephone, entreprise.courriel].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
        <Onglets options={ONGLETS} valeur={onglet} onChange={setOnglet} />
        {onglet === "ACCUEIL" && <Accueil proprietes={proprietes} avis={avis} jeton={jeton} demandes={demandes} allerA={setOnglet} />}
        {onglet === "DOCUMENTS" && <Documents documents={documents} jeton={jeton} />}
        {onglet === "DEMANDES" && <Demandes demandes={demandes} proprietes={proprietes} jeton={jeton} />}
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", textAlign: "center", margin: "24px 0 8px" }}>Ce lien vous est personnel : ne le partagez pas.</p>
      </div>
    </div>
  );
}

function Accueil({ proprietes, avis, jeton, demandes, allerA }) {
  const ouvertes = demandes.filter((d) => trouver(STATUTS_DEMANDE, d.statut)?.ouverte);
  return (
    <>
      {avis.length > 0 && (
        <Section titre="📣 Derniers avis">
          {avis.map((d) => <LienDocument key={d.id} d={d} jeton={jeton} />)}
        </Section>
      )}
      {proprietes.length === 0 && <Section titre="Mes unités"><Vide>Aucune unité n'est inscrite à votre nom en ce moment.</Vide></Section>}
      {proprietes.map((p) => <Unite key={p.id} p={p} />)}
      {ouvertes.length > 0 && (
        <Section titre="Mes demandes en cours" droite={<button type="button" onClick={() => allerA("DEMANDES")} style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Voir</button>}>
          {ouvertes.map((d) => (
            <div key={d.id} className="ligne-info"><span><strong>{d.numero}</strong> {d.titre}</span><PastilleCode liste={STATUTS_DEMANDE} code={d.statut} /></div>
          ))}
        </Section>
      )}
    </>
  );
}

function Unite({ p }) {
  const [tout, setTout] = useState(false);
  const u = p.unite;
  const solde = soldeUnite(u);
  const releve = releveUnite(u).reverse();
  return (
    <Section titre={`${trouver(TYPES_UNITE, u.type)?.icone || ""} Unité ${u.numero}`} droite={<span style={{ fontSize: 13, fontWeight: 800, color: solde > 0.005 ? "var(--danger)" : "var(--success)" }}>{solde > 0.005 ? `Solde dû : ${argent(solde)}` : solde < -0.005 ? `Crédit : ${argent(-solde)}` : "À jour"}</span>}>
      <div className="ligne-info"><span>Quote-part</span><span>{pourcent(u.quotePart)}{p.partDetenue < 100 && ` (vous en détenez ${pourcent(p.partDetenue, 2)})`}</span></div>
      {u.batiment && <div className="ligne-info"><span>Bâtiment</span><span>{u.batiment.nom}</span></div>}
      {u.espaces.map((e) => (
        <div key={e.id} className="ligne-info"><span>{libelle(TYPES_ESPACE, e.type)}</span><span>{e.numero}{e.emplacement && ` · ${e.emplacement}`}</span></div>
      ))}
      {releve.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", margin: "12px 0 4px" }}>Relevé de compte</div>
          <Tableau entetes={["Date", "Description", "Montant", "Solde"]} alignDroite={[2, 3]}>
            {(tout ? releve : releve.slice(0, 8)).map((l) => (
              <tr key={`${l.genre}-${l.id}`}>
                <td style={{ ...cellule, whiteSpace: "nowrap" }}>{dateLisible(l.date)}</td>
                <td style={cellule}>{l.genre === "paiement" ? "💵 Paiement reçu" : l.libelle}</td>
                <td style={{ ...celluleDroite, color: l.montant < 0 ? "var(--success)" : undefined }}>{argent(l.montant)}</td>
                <td style={celluleDroite}>{argent(l.solde)}</td>
              </tr>
            ))}
          </Tableau>
          {releve.length > 8 && !tout && <button type="button" onClick={() => setTout(true)} style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 700, fontSize: 12, cursor: "pointer", marginTop: 6 }}>Tout le relevé ({releve.length} lignes)</button>}
        </>
      )}
    </Section>
  );
}

function LienDocument({ d, jeton }) {
  return (
    <a href={`/api/portail-copro/${jeton}/documents/${d.id}`} target="_blank" rel="noreferrer" className="ligne-info" style={{ textDecoration: "none", color: "inherit", gap: 8 }}>
      <span style={{ minWidth: 0 }}>
        <span style={{ color: "var(--accent)", fontWeight: 700 }}>{d.titre}</span>
        {d.description && <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>{d.description}</span>}
      </span>
      <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{d.date ? dateLisible(d.date) : dateLisible(d.creeLe)} · {taille(d.taille)}</span>
    </a>
  );
}

function Documents({ documents, jeton }) {
  const [categorie, setCategorie] = useState("");
  const categories = CATEGORIES_DOCUMENTS.map((c) => ({ ...c, docs: documents.filter((d) => d.categorie === c.code) })).filter((c) => c.docs.length > 0);
  if (documents.length === 0) return <Section titre="Documents"><Vide>Aucun document pour le moment.</Vide></Section>;
  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {[{ code: "", label: "Tous", icone: "🗂️" }, ...categories].map((c) => (
          <button key={c.code} type="button" onClick={() => setCategorie(c.code)} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 9, cursor: "pointer", border: "1px solid var(--border)", background: categorie === c.code ? "var(--accent)" : "var(--surface)", color: categorie === c.code ? "#221f18" : "var(--text)", fontWeight: 700 }}>
            {c.icone} {c.label}
          </button>
        ))}
      </div>
      {categories.filter((c) => !categorie || c.code === categorie).map((c) => (
        <Section key={c.code} titre={`${c.icone} ${c.label}`}>
          {c.docs.map((d) => <LienDocument key={d.id} d={d} jeton={jeton} />)}
        </Section>
      ))}
    </>
  );
}

function Demandes({ demandes, proprietes, jeton }) {
  const [formulaire, setFormulaire] = useState(demandes.length === 0);
  const [confirmation, setConfirmation] = useState("");
  return (
    <>
      {confirmation && <div style={{ background: "var(--success-fond)", border: "1px solid var(--success)", borderRadius: 12, padding: "10px 14px", fontSize: 13.5, marginBottom: 12 }}>✅ {confirmation}</div>}
      {formulaire ? (
        <NouvelleDemande proprietes={proprietes} jeton={jeton} onFini={(numero) => { setFormulaire(false); setConfirmation(`Demande ${numero} reçue. Vous serez avisé de sa progression.`); }} onAnnuler={demandes.length > 0 ? () => setFormulaire(false) : null} />
      ) : (
        <button type="button" onClick={() => { setFormulaire(true); setConfirmation(""); }} className="bouton-3d" style={{ ...boutonPrincipal, marginBottom: 14 }}>+ Faire une demande ou signaler un problème</button>
      )}
      {demandes.map((d) => <Demande key={d.id} d={d} jeton={jeton} />)}
    </>
  );
}

function Demande({ d, jeton }) {
  const suivis = d.travaux.flatMap((t) => t.suivis).sort((a, b) => new Date(b.date) - new Date(a.date));
  const planifie = d.travaux.find((t) => t.datePrevue && t.statut !== "TERMINE" && t.statut !== "ANNULE");
  return (
    <Section titre={`${d.numero} — ${d.titre}`} droite={<PastilleCode liste={STATUTS_DEMANDE} code={d.statut} />}>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {[libelle(TYPES_DEMANDE, d.type), d.unite ? `unité ${d.unite.numero}` : d.emplacement || "parties communes", `envoyée le ${dateLisible(d.creeLe)}`].join(" · ")}
      </div>
      {d.description && <p style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: "6px 0 0" }}>{d.description}</p>}
      {d.fichiers.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {d.fichiers.map((f) => (
            <a key={f.id} href={`/api/portail-copro/${jeton}/fichiers/${f.id}`} target="_blank" rel="noreferrer">
              {f.typeMime.startsWith("image/") && !/heic|heif/.test(f.typeMime)
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={`/api/portail-copro/${jeton}/fichiers/${f.id}`} alt={f.nom} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
                : <span style={{ fontSize: 12, color: "var(--accent)" }}>📄 {f.nom}</span>}
            </a>
          ))}
        </div>
      )}
      {planifie && <p style={{ fontSize: 13, margin: "8px 0 0" }}>📅 Travaux prévus le <strong>{dateLisible(planifie.datePrevue)}</strong></p>}
      {d.reponse && (
        <div style={{ background: "var(--surface-alt)", borderRadius: 10, padding: "8px 12px", marginTop: 8, fontSize: 13, whiteSpace: "pre-wrap" }}>
          <strong>Réponse de l'administration :</strong> {d.reponse}
        </div>
      )}
      {suivis.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {suivis.map((s) => (
            <div key={s.id} style={{ borderLeft: "3px solid var(--accent)", padding: "2px 0 2px 10px", marginBottom: 6 }}>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{dateLisible(s.date)}</div>
              <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{s.texte}</div>
            </div>
          ))}
        </div>
      )}
    </Section>
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
    <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 16, padding: 16, marginBottom: 16 }}>
      <ChampsFormulaire champs={champs} valeurs={valeurs} maj={maj} />
      <label style={labelStyle}>Photos (jusqu'à 6)</label>
      <input type="file" accept="image/*,.pdf" multiple onChange={(e) => setFichiers([...(e.target.files || [])].slice(0, 6))} style={{ fontSize: 13, marginBottom: 10 }} />
      {fichiers.length > 0 && <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{fichiers.length} fichier{fichiers.length > 1 ? "s" : ""} choisi{fichiers.length > 1 ? "s" : ""}</div>}
      <Erreur texte={erreur} />
      <button type="button" onClick={envoyer} disabled={enCours} className="bouton-3d" style={boutonPrincipal}>{enCours ? "Envoi…" : "Envoyer la demande"}</button>
      {onAnnuler && <button type="button" onClick={onAnnuler} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12.5, cursor: "pointer", marginTop: 8, width: "100%" }}>Annuler</button>}
    </div>
  );
}
