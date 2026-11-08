"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BandeauSection from "../../components/BandeauSection";
import { BoutonPlein, Pastille } from "../../components/StyleSection";
import { correspondRecherche } from "@/lib/recherche";
import {
  PRIORITES, STATUTS_DEMANDE, STATUTS_TRAVAIL, TYPES_ENTRETIEN, CATEGORIES_TRAVAUX, ENTRETIENS_SUGGERES,
  argent, libelle, trouver, dateLisible, dateCourte, etatEcheance, frequenceLisible, ajouterMois,
} from "@/lib/coproprieteCalculs";
import { champsDemande, champsTravail, champsEntretien } from "./champs";
import {
  NavCopro, Section, Formulaire, Onglets, Recherche, CarteListe, PastilleCode, Vide, BoutonTexte, BoutonSupprimer, valeursDe, aujourdhui, useApi, Erreur, Statistique,
} from "../ui";

const ONGLETS = [
  { code: "DEMANDES", label: "Demandes" },
  { code: "TRAVAUX", label: "Bons de travail" },
  { code: "PREVENTIF", label: "Préventif" },
];

export default function EntretienClient(props) {
  const [onglet, setOnglet] = useState(ONGLETS.some((o) => o.code === props.ongletInitial) ? props.ongletInitial : "DEMANDES");
  return (
    <div className="conteneur-page">
      <BandeauSection icone="🛠️" titre="Entretien et réparations" sousTitre="Demandes des copropriétaires, bons de travail aux fournisseurs, entretien préventif et inspections." />
      <NavCopro actif="/copropriete/entretien" />
      <Onglets options={ONGLETS} valeur={onglet} onChange={setOnglet} />
      {onglet === "DEMANDES" && <Demandes {...props} />}
      {onglet === "TRAVAUX" && <Travaux {...props} />}
      {onglet === "PREVENTIF" && <Preventif {...props} />}
    </div>
  );
}

const rang = (liste, code) => trouver(liste, code)?.rang ?? 9;

// ---------- Demandes ----------

function Demandes({ demandes, unites, batiments, coproprietaires, uniteInitiale, nouvelle }) {
  const router = useRouter();
  const [formulaire, setFormulaire] = useState(Boolean(nouvelle));
  const [filtre, setFiltre] = useState("OUVERTES");
  const [recherche, setRecherche] = useState("");
  const q = recherche.trim().toLowerCase();
  const ouvertes = (d) => trouver(STATUTS_DEMANDE, d.statut)?.ouverte;
  const affichees = demandes
    .filter((d) => (filtre === "OUVERTES" ? ouvertes(d) : filtre === "FERMEES" ? !ouvertes(d) : true))
    .filter((d) => !q || correspondRecherche(q, d.numero, d.titre, d.unite?.numero, d.emplacement, d.coproprietaire?.nom, d.signalePar))
    .sort((a, b) => (filtre === "OUVERTES" ? rang(PRIORITES, a.priorite) - rang(PRIORITES, b.priorite) : 0) || new Date(b.creeLe) - new Date(a.creeLe));
  const uniteChoisie = unites.find((u) => u.id === uniteInitiale);

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <BoutonPlein icone={formulaire ? null : "plus"} onClick={() => setFormulaire((v) => !v)}>{formulaire ? "Annuler" : "Nouvelle demande"}</BoutonPlein>
      </div>
      {formulaire && (
        <Formulaire
          champs={champsDemande({ unites, batiments, coproprietaires })}
          initial={uniteChoisie ? { uniteId: uniteChoisie.id, batimentId: uniteChoisie.batimentId || "" } : {}}
          url="/api/copropriete/demandes" bouton="Enregistrer la demande" onFini={(d) => router.push(`/copropriete/demandes/${d.id}`)}
        />
      )}
      <Onglets options={[{ code: "OUVERTES", label: "À traiter" }, { code: "FERMEES", label: "Fermées" }, { code: "TOUTES", label: "Toutes" }]} valeur={filtre} onChange={setFiltre} />
      <Recherche valeur={recherche} onChange={setRecherche} placeholder="Numéro, problème, unité, demandeur…" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {affichees.map((d) => (
          <CarteListe
            key={d.id} href={`/copropriete/demandes/${d.id}`} couleur={trouver(PRIORITES, d.priorite)?.couleur}
            titre={<>{d.numero} — {d.titre}</>}
            sousTitre={[
              d.unite ? `Unité ${d.unite.numero}` : d.emplacement || "Parties communes",
              d.unite && d.emplacement,
              d.coproprietaire?.nom || d.signalePar,
              d.categorie && libelle(CATEGORIES_TRAVAUX, d.categorie),
              dateLisible(d.creeLe),
            ].filter(Boolean).join(" · ")}
            bas={<>
              <PastilleCode liste={STATUTS_DEMANDE} code={d.statut} />
              <PastilleCode liste={PRIORITES} code={d.priorite} />
              {d.source === "PORTAIL" && <Pastille couleur="var(--bleu)" fond="var(--bleu-fond)">🌐 Portail</Pastille>}
              {d._count.fichiers > 0 && <Pastille couleur="var(--text-muted)" fond="var(--surface-alt)">📷 {d._count.fichiers}</Pastille>}
              {d._count.travaux > 0 && <Pastille couleur="var(--text-muted)" fond="var(--surface-alt)">🧾 {d._count.travaux} bon{d._count.travaux > 1 ? "s" : ""}</Pastille>}
            </>}
          />
        ))}
        {affichees.length === 0 && <Vide>Aucune demande dans cette liste.</Vide>}
      </div>
    </>
  );
}

// ---------- Bons de travail ----------

function Travaux({ travaux, unites, batiments, fournisseurs }) {
  const router = useRouter();
  const [formulaire, setFormulaire] = useState(false);
  const [filtre, setFiltre] = useState("OUVERTS");
  const [recherche, setRecherche] = useState("");
  const q = recherche.trim().toLowerCase();
  const ouvert = (t) => trouver(STATUTS_TRAVAIL, t.statut)?.ouvert;
  const affiches = travaux
    .filter((t) => (filtre === "OUVERTS" ? ouvert(t) : filtre === "FERMES" ? !ouvert(t) : true))
    .filter((t) => !q || correspondRecherche(q, t.numero, t.titre, t.fournisseur?.nom, t.unite?.numero, t.emplacement));
  const annee = aujourdhui().slice(0, 4);
  const coutAnnee = travaux.filter((t) => t.statut === "TERMINE" && t.dateFin && dateCourte(t.dateFin).startsWith(annee)).reduce((s, t) => s + (t.coutReel || 0), 0);
  const engage = travaux.filter(ouvert).reduce((s, t) => s + (t.coutEstime || 0), 0);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
        <Statistique valeur={travaux.filter(ouvert).length} label="Bons ouverts" teinte="#8C6BC4" />
        <Statistique valeur={argent(engage)} label="Coût estimé des bons ouverts" teinte="var(--accent)" />
        <Statistique valeur={argent(coutAnnee)} label={`Coût des travaux terminés en ${annee}`} teinte="var(--bleu)" />
      </div>
      <div style={{ marginBottom: 14 }}>
        <BoutonPlein icone={formulaire ? null : "plus"} onClick={() => setFormulaire((v) => !v)}>{formulaire ? "Annuler" : "Nouveau bon de travail"}</BoutonPlein>
      </div>
      {formulaire && <Formulaire champs={champsTravail({ unites, batiments, fournisseurs })} url="/api/copropriete/travaux" bouton="Créer le bon de travail" onFini={(d) => router.push(`/copropriete/travaux/${d.id}`)} />}
      <Onglets options={[{ code: "OUVERTS", label: "Ouverts" }, { code: "FERMES", label: "Terminés / annulés" }, { code: "TOUS", label: "Tous" }]} valeur={filtre} onChange={setFiltre} />
      <Recherche valeur={recherche} onChange={setRecherche} placeholder="Numéro, travaux, fournisseur, unité…" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {affiches.map((t) => (
          <CarteListe
            key={t.id} href={`/copropriete/travaux/${t.id}`} couleur={trouver(STATUTS_TRAVAIL, t.statut)?.couleur}
            titre={<>{t.numero} — {t.titre}</>}
            sousTitre={[t.fournisseur?.nom || "Aucun fournisseur", t.unite ? `Unité ${t.unite.numero}` : t.emplacement || "Parties communes", t.entretienId && "🛠️ préventif"].filter(Boolean).join(" · ")}
            bas={<><PastilleCode liste={STATUTS_TRAVAIL} code={t.statut} /><PastilleCode liste={PRIORITES} code={t.priorite} /></>}
            droite={<>
              {t.datePrevue && t.statut !== "TERMINE" && <div style={{ fontWeight: 700 }}>{dateLisible(t.datePrevue)}</div>}
              {t.dateFin && t.statut === "TERMINE" && <div style={{ color: "var(--text-muted)" }}>fini le {dateLisible(t.dateFin)}</div>}
              {t.coutReel != null ? <div style={{ fontWeight: 700 }}>{argent(t.coutReel)}</div> : t.coutEstime != null && <div style={{ color: "var(--text-muted)" }}>≈ {argent(t.coutEstime)}</div>}
            </>}
          />
        ))}
        {affiches.length === 0 && <Vide>Aucun bon de travail dans cette liste.</Vide>}
      </div>
    </>
  );
}

// ---------- Entretien préventif et calendrier des inspections ----------

function Preventif({ entretiens, batiments, fournisseurs }) {
  const [formulaire, setFormulaire] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [edition, setEdition] = useState(null);
  const [vue, setVue] = useState("CALENDRIER");
  const champs = champsEntretien({ batiments, fournisseurs });
  const actifs = entretiens.filter((e) => e.actif);
  const inactifs = entretiens.filter((e) => !e.actif);
  const dejaLa = new Set(entretiens.map((e) => e.titre));

  // Calendrier des 12 prochains mois (en retard regroupés en tête)
  const mois = {};
  for (const e of actifs) {
    const etat = etatEcheance(e.prochaineDate);
    const cle = etat.code === "RETARD" ? "0000-00" : dateCourte(e.prochaineDate).slice(0, 7);
    (mois[cle] ||= []).push({ ...e, etat });
  }
  const cles = Object.keys(mois).sort();

  return (
    <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <BoutonPlein icone={formulaire ? null : "plus"} onClick={() => { setFormulaire((v) => !v); setSuggestion(null); }}>{formulaire ? "Annuler" : "Nouvel entretien / inspection"}</BoutonPlein>
      </div>
      {formulaire && (
        <>
          <Section titre="Suggestions courantes en copropriété">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ENTRETIENS_SUGGERES.filter((s) => !dejaLa.has(s.titre)).map((s) => (
                <button key={s.titre} type="button" onClick={() => setSuggestion(s)} style={{ fontSize: 12, padding: "5px 9px", borderRadius: 8, cursor: "pointer", border: `1px solid ${suggestion?.titre === s.titre ? "var(--accent)" : "var(--border)"}`, background: suggestion?.titre === s.titre ? "var(--accent)" : "var(--bg)", color: suggestion?.titre === s.titre ? "#221f18" : "var(--text)" }}>
                  {trouver(TYPES_ENTRETIEN, s.type)?.icone} {s.titre}{s.obligatoire && " ⚖️"}
                </button>
              ))}
            </div>
          </Section>
          <Formulaire
            key={suggestion?.titre || "vide"} champs={champs}
            initial={{ prochaineDate: aujourdhui(), ...(suggestion && { titre: suggestion.titre, type: suggestion.type, categorie: suggestion.categorie, frequenceMois: String(suggestion.frequenceMois), obligatoire: Boolean(suggestion.obligatoire) }) }}
            url="/api/copropriete/entretiens" bouton="Ajouter au calendrier" onFini={() => { setFormulaire(false); setSuggestion(null); }}
          />
        </>
      )}
      {edition && (
        <Section titre={`Modifier — ${edition.titre}`} droite={<BoutonTexte onClick={() => setEdition(null)}>Annuler</BoutonTexte>}>
          <Formulaire key={edition.id} cadre={false} champs={champs} initial={valeursDe(edition, champs)} url={`/api/copropriete/entretiens/${edition.id}`} methode="PATCH" onFini={() => setEdition(null)} />
          <div style={{ marginTop: 10 }}><BoutonSupprimer url={`/api/copropriete/entretiens/${edition.id}`} confirmation={`Supprimer « ${edition.titre} » du calendrier ? Ses bons de travail restent.`} onFini={() => setEdition(null)}>Supprimer</BoutonSupprimer></div>
        </Section>
      )}
      <Onglets options={[{ code: "CALENDRIER", label: "Calendrier" }, { code: "LISTE", label: "Tous les entretiens" }]} valeur={vue} onChange={setVue} />
      {actifs.length === 0 && <Vide>Aucun entretien planifié. Commence par les inspections obligatoires (⚖️) dans les suggestions.</Vide>}
      {vue === "CALENDRIER" && cles.map((cle) => (
        <Section key={cle} titre={cle === "0000-00" ? "⚠️ En retard" : new Intl.DateTimeFormat("fr-CA", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${cle}-15T12:00:00Z`))}>
          {mois[cle].map((e) => <LigneEntretien key={e.id} e={e} onModifier={() => setEdition(e)} />)}
        </Section>
      ))}
      {vue === "LISTE" && (
        <Section titre="Tous les entretiens et inspections">
          {[...actifs, ...inactifs].map((e) => <LigneEntretien key={e.id} e={{ ...e, etat: etatEcheance(e.prochaineDate) }} onModifier={() => setEdition(e)} detail />)}
        </Section>
      )}
    </>
  );
}

function LigneEntretien({ e, onModifier, detail }) {
  const router = useRouter();
  const { appeler, enCours, erreur } = useApi();
  async function creerBon() {
    const r = await appeler("/api/copropriete/travaux", "POST", { titre: e.titre, entretienId: e.id, description: e.description || "" });
    if (r) router.push(`/copropriete/travaux/${r.id}`);
  }
  async function fait() {
    const date = window.prompt(`« ${e.titre} » fait le (AAAA-MM-JJ) :`, aujourdhui());
    if (!date) return;
    await appeler(`/api/copropriete/entretiens/${e.id}`, "PATCH", { derniereDate: date, prochaineDate: dateCourte(ajouterMois(`${date}T12:00:00Z`, e.frequenceMois)) });
  }
  return (
    <div style={{ padding: "9px 0", borderBottom: "1px solid var(--border)", opacity: e.actif ? 1 : 0.6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{trouver(TYPES_ENTRETIEN, e.type)?.icone} {e.titre}{e.obligatoire && <span title="Exigé par la loi, un règlement ou l'assureur"> ⚖️</span>}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: e.actif ? e.etat.couleur : "var(--text-muted)" }}>{dateLisible(e.prochaineDate)}{e.actif ? ` · ${e.etat.label}` : " · inactif"}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
        {[frequenceLisible(e.frequenceMois), e.fournisseur?.nom, e.batiment?.nom, e.emplacement, e.coutEstime != null && `≈ ${argent(e.coutEstime)}`, e.derniereDate && `dernière fois : ${dateLisible(e.derniereDate)}`, detail && e.categorie && libelle(CATEGORIES_TRAVAUX, e.categorie)].filter(Boolean).join(" · ")}
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 6 }}>
        {e.travaux?.length > 0
          ? e.travaux.map((t) => <a key={t.id} href={`/copropriete/travaux/${t.id}`} style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>🧾 {t.numero} en cours</a>)
          : e.actif && <BoutonTexte onClick={creerBon} disabled={enCours}>🧾 Créer le bon de travail</BoutonTexte>}
        {e.actif && <BoutonTexte onClick={fait} disabled={enCours}>✓ Fait</BoutonTexte>}
        <BoutonTexte onClick={onModifier}>Modifier</BoutonTexte>
      </div>
      <Erreur texte={erreur} />
    </div>
  );
}
