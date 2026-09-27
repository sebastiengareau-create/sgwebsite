"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../../../components/BandeauSection";

const JOURS = [
  ["lun", "Lundi"], ["mar", "Mardi"], ["mer", "Mercredi"], ["jeu", "Jeudi"],
  ["ven", "Vendredi"], ["sam", "Samedi"], ["dim", "Dimanche"],
];

export default function ParametresWebClient({ services, reglages, accesParametres }) {
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
        {services.length === 0
          ? " Tant qu'aucun service n'est ajouté ici, le site garde sa propre liste."
          : ` ${actifs} service${actifs > 1 ? "s" : ""} affiché${actifs > 1 ? "s" : ""} sur le site.`}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
        {services.map((s) => <LigneService key={s.id} service={s} onChange={() => router.refresh()} />)}
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
  const [duree, setDuree] = useState(String(service.dureeMinutes));
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const modifie = nom.trim() !== service.nom || Number(duree) !== service.dureeMinutes;

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
          <button onClick={() => envoyer("PATCH", { nom, dureeMinutes: Number(duree) })} disabled={enCours} className="bouton-3d" style={styleBouton}>
            Enregistrer
          </button>
        )}
      </div>
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

function FormulaireService({ onCree }) {
  const [nom, setNom] = useState("");
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
      body: JSON.stringify({ nom, dureeMinutes: Number(duree) }),
    });
    setEnCours(false);
    if (!res.ok) {
      setErreur((await res.json().catch(() => ({}))).erreur || "Erreur lors de l'enregistrement.");
      return;
    }
    setNom("");
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
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, margin: "6px 0 0" }}>{erreur}</p>}
    </form>
  );
}

const styleTitre = { fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, marginBottom: 4 };
const styleAide = { fontSize: 12, color: "var(--text-muted)", margin: "0 0 10px" };
const styleCarte = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 10 };
const styleBouton = { fontSize: 11, fontWeight: 700, padding: "7px 10px", borderRadius: 8 };
const styleChamp = {
  minWidth: 0, padding: "8px 9px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, boxSizing: "border-box",
};
