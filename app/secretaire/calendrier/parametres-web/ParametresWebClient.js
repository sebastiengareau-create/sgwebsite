"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../../../components/BandeauSection";
import { VOYANTS, iconeVoyant } from "@/lib/symptomesWeb";

const JOURS = [
  ["lun", "Lundi"], ["mar", "Mardi"], ["mer", "Mercredi"], ["jeu", "Jeudi"],
  ["ven", "Vendredi"], ["sam", "Samedi"], ["dim", "Dimanche"],
];

export default function ParametresWebClient({ services, symptomes, reglages, accesParametres }) {
  const router = useRouter();
  const actifs = services.filter((s) => s.actif).length;

  return (
    <div style={{ padding: 16, maxWidth: 560, margin: "0 auto", width: "100%" }}>
      <BandeauSection icone="🌐" titre="Paramètres web" sousTitre="Ce que le site de réservation en ligne offre à vos clients." />

      <Link href="/secretaire/calendrier" style={{ display: "inline-block", fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 14 }}>
        ← Retour au calendrier
      </Link>

      <div style={styleTitre}>Services offerts en ligne</div>
      <p style={styleAide}>
        Le client choisit un de ces services en réservant ; sa durée détermine les cases horaires offertes.
        La description s&apos;affiche sous le nom, en plus petit et en italique. « Dites-nous les symptômes » est toujours offert en dernier.
        {services.length === 0
          ? " Tant qu'aucun service n'est ajouté ici, le site garde sa propre liste."
          : ` ${actifs} service${actifs > 1 ? "s" : ""} affiché${actifs > 1 ? "s" : ""} sur le site.`}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
        {services.map((s) => <LigneService key={s.id} service={s} onChange={() => router.refresh()} />)}
        <CarteSymptomes reglages={symptomes} onChange={() => router.refresh()} />
      </div>
      <FormulaireService onCree={() => router.refresh()} />

      <div style={{ ...styleTitre, marginTop: 26 }}>Disponibilités</div>
      <p style={styleAide}>
        Le site n&apos;offre que les cases libres du calendrier : heures d&apos;ouverture ci-dessous, moins les rendez-vous
        et les périodes indisponibles.
      </p>
      <div style={styleCarte}>
        {JOURS.map(([cle, nom]) => (
          <div key={cle} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
            <span>{nom}</span>
            <span style={{ color: reglages.heures[cle] ? "var(--text)" : "var(--text-muted)" }}>
              {reglages.heures[cle] ? `${reglages.heures[cle].ouverture} – ${reglages.heures[cle].fermeture}` : "Fermé"}
            </span>
          </div>
        ))}
        <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
          Cases aux {reglages.intervalleMinutes} min · {reglages.capacite} rendez-vous simultané{reglages.capacite > 1 ? "s" : ""} maximum
        </div>
      </div>
      <p style={{ ...styleAide, marginTop: 8 }}>
        {accesParametres
          ? <>Pour les modifier : <Link href="/gerant/parametres" style={{ color: "var(--accent)" }}>Paramètres</Link>. </>
          : "Un gérant peut les modifier dans Paramètres. "}
        Pour bloquer des heures précises (congé, férié…), ajoute une indisponibilité au calendrier.
      </p>
    </div>
  );
}

function LigneService({ service, onChange }) {
  const [nom, setNom] = useState(service.nom);
  const [description, setDescription] = useState(service.description || "");
  const [duree, setDuree] = useState(String(service.dureeMinutes));
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const modifie = nom.trim() !== service.nom || description.trim() !== (service.description || "") || Number(duree) !== service.dureeMinutes;

  async function envoyer(methode, corps) {
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/rendezvous/services/${service.id}`, {
      method: methode,
      headers: { "Content-Type": "application/json" },
      body: corps ? JSON.stringify(corps) : undefined,
    });
    setEnCours(false);
    if (!res.ok) {
      setErreur((await res.json().catch(() => ({}))).erreur || "Erreur lors de l'enregistrement.");
      return;
    }
    onChange();
  }

  function supprimer() {
    if (!window.confirm(`Supprimer « ${service.nom} » ? Pour seulement le retirer du site, désactive-le plutôt.`)) return;
    envoyer("DELETE");
  }

  return (
    <div style={{ ...styleCarte, opacity: service.actif ? 1 : 0.55 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <input value={nom} onChange={(e) => setNom(e.target.value)} aria-label="Nom du service" style={{ ...styleChamp, flex: "2 1 160px" }} />
        <input type="number" min={15} max={600} step={5} value={duree} onChange={(e) => setDuree(e.target.value)} aria-label="Durée en minutes" style={{ ...styleChamp, flex: "0 0 74px" }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>min</span>
        {modifie && (
          <button onClick={() => envoyer("PATCH", { nom, description, dureeMinutes: Number(duree) })} disabled={enCours} className="bouton-3d" style={styleBouton}>
            Enregistrer
          </button>
        )}
      </div>
      <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder="Description (facultatif)" aria-label="Description du service" style={styleDescription} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: service.actif ? "var(--success)" : "var(--text-muted)", flex: 1 }}>
          {service.actif ? "● Affiché sur le site" : "○ Désactivé — absent du site"}
        </span>
        <button onClick={() => envoyer("PATCH", { actif: !service.actif })} disabled={enCours} className="bouton-3d-sombre" style={styleBouton}>
          {service.actif ? "Désactiver" : "Réactiver"}
        </button>
        <button onClick={supprimer} disabled={enCours} title="Supprimer" style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 13, cursor: "pointer" }}>🗑️</button>
      </div>
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, margin: "6px 0 0" }}>{erreur}</p>}
    </div>
  );
}

// Option « Dites-nous les symptômes » — toujours la dernière du site
function CarteSymptomes({ reglages, onChange }) {
  const [nom, setNom] = useState(reglages.nom);
  const [description, setDescription] = useState(reglages.description || "");
  const [duree, setDuree] = useState(String(reglages.dureeMinutes));
  const [nouveau, setNouveau] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const modifie = nom.trim() !== reglages.nom || description.trim() !== (reglages.description || "") || Number(duree) !== reglages.dureeMinutes;

  async function envoyer(corps) {
    setErreur("");
    setEnCours(true);
    const res = await fetch("/api/rendezvous/services/symptomes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    });
    setEnCours(false);
    if (!res.ok) {
      setErreur((await res.json().catch(() => ({}))).erreur || "Erreur lors de l'enregistrement.");
      return false;
    }
    onChange();
    return true;
  }

  function basculerVoyant(id) {
    const voyants = reglages.voyants.includes(id) ? reglages.voyants.filter((v) => v !== id) : [...reglages.voyants, id];
    envoyer({ voyants });
  }

  async function ajouterSymptome(e) {
    e.preventDefault();
    if (!nouveau.trim()) return;
    if (await envoyer({ symptomes: [...reglages.symptomes, nouveau] })) setNouveau("");
  }

  return (
    <div style={{ ...styleCarte, opacity: reglages.actif ? 1 : 0.55 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span aria-hidden style={{ fontSize: 16 }}>🩺</span>
        <input value={nom} onChange={(e) => setNom(e.target.value)} aria-label="Titre de l'option" style={{ ...styleChamp, flex: "2 1 140px", fontWeight: 700 }} />
        <input type="number" min={15} max={600} step={5} value={duree} onChange={(e) => setDuree(e.target.value)} aria-label="Durée en minutes" style={{ ...styleChamp, flex: "0 0 74px" }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>min</span>
        {modifie && (
          <button onClick={() => envoyer({ nom, description, dureeMinutes: Number(duree) })} disabled={enCours} className="bouton-3d" style={styleBouton}>
            Enregistrer
          </button>
        )}
      </div>
      <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder="Description (facultatif)" aria-label="Description de l'option" style={styleDescription} />

      <div style={{ ...styleSousTitre, marginTop: 10 }}>Mes lumières sont allumées</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {VOYANTS.map((v) => {
          const offert = reglages.voyants.includes(v.id);
          return (
            <button key={v.id} type="button" onClick={() => basculerVoyant(v.id)} disabled={enCours} title={`${v.nom} — ${offert ? "offert (cliquer pour retirer)" : "retiré (cliquer pour offrir)"}`}
              style={{ ...stylePastille, opacity: offert ? 1 : 0.3, borderColor: offert ? "var(--accent)" : "var(--border)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={iconeVoyant(v.id)} alt={v.nom} width={30} height={30} style={{ background: "#fff", borderRadius: 4 }} />
            </button>
          );
        })}
      </div>

      <div style={{ ...styleSousTitre, marginTop: 10 }}>Symptômes de ma voiture</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {reglages.symptomes.map((s) => (
          <span key={s} style={styleEtiquette}>
            {s}
            <button type="button" onClick={() => envoyer({ symptomes: reglages.symptomes.filter((x) => x !== s) })} disabled={enCours} aria-label={`Retirer ${s}`}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0, fontSize: 12 }}>✕</button>
          </span>
        ))}
      </div>
      <form onSubmit={ajouterSymptome} style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <input placeholder="Autre symptôme (ex : Surchauffe)" maxLength={40} value={nouveau} onChange={(e) => setNouveau(e.target.value)} style={{ ...styleChamp, flex: 1 }} />
        <button type="submit" disabled={enCours || !nouveau.trim()} className="bouton-3d-sombre" style={styleBouton}>+ Ajouter</button>
      </form>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: reglages.actif ? "var(--success)" : "var(--text-muted)", flex: 1 }}>
          {reglages.actif ? "● Affiché sur le site, en dernier" : "○ Désactivé — absent du site"}
        </span>
        <button onClick={() => envoyer({ actif: !reglages.actif })} disabled={enCours} className={reglages.actif ? "bouton-3d-sombre" : "bouton-3d"} style={styleBouton}>
          {reglages.actif ? "Désactiver" : "Activer"}
        </button>
      </div>
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, margin: "6px 0 0" }}>{erreur}</p>}
    </div>
  );
}

function FormulaireService({ onCree }) {
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [duree, setDuree] = useState("60");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  async function ajouter(e) {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    const res = await fetch("/api/rendezvous/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, description, dureeMinutes: Number(duree) }),
    });
    setEnCours(false);
    if (!res.ok) {
      setErreur((await res.json().catch(() => ({}))).erreur || "Erreur lors de l'enregistrement.");
      return;
    }
    setNom("");
    setDescription("");
    setDuree("60");
    onCree();
  }

  return (
    <form onSubmit={ajouter} style={{ ...styleCarte, borderStyle: "dashed" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <input required placeholder="Nouveau service (ex : Vidange d'huile)" value={nom} onChange={(e) => setNom(e.target.value)} style={{ ...styleChamp, flex: "2 1 160px" }} />
        <input required type="number" min={15} max={600} step={5} value={duree} onChange={(e) => setDuree(e.target.value)} aria-label="Durée en minutes" style={{ ...styleChamp, flex: "0 0 74px" }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>min</span>
        <button type="submit" disabled={enCours} className="bouton-3d" style={styleBouton}>
          {enCours ? "Ajout…" : "+ Ajouter"}
        </button>
      </div>
      <input placeholder="Description (facultatif, ex : Inclut la vérification des freins)" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Description du service" style={styleDescription} />
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, margin: "6px 0 0" }}>{erreur}</p>}
    </form>
  );
}

const styleTitre = { fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, marginBottom: 4 };
const styleAide = { fontSize: 12, color: "var(--text-muted)", margin: "0 0 10px" };
const styleCarte = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 10 };
const styleBouton = { fontSize: 11, fontWeight: 700, padding: "7px 10px", borderRadius: 8 };
const styleSousTitre = { fontSize: 12, fontWeight: 700, marginBottom: 5 };
const stylePastille = { display: "flex", padding: 3, border: "2px solid", borderRadius: 8, background: "none", cursor: "pointer" };
const styleEtiquette = {
  display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, padding: "3px 8px",
  border: "1px solid var(--border)", borderRadius: 999, background: "var(--bg)",
};
const styleChamp = {
  minWidth: 0, padding: "8px 9px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, boxSizing: "border-box",
};
// Ligne de description : texte plus petit et en italique, comme sur le site
const styleDescription = { ...styleChamp, width: "100%", marginTop: 6, fontSize: 12, fontStyle: "italic", padding: "6px 9px" };
