"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { dateAujourdhuiQuebec } from "@/lib/temps";
import { VEHICULE_VIDE } from "../../../components/ChampsVehicule";
import ChoixVehiculeClient from "../../../components/ChoixVehiculeClient";
import { formaterTelephone } from "@/lib/telephone";
import { ChampAdresse, ChampVille, ChampCodePostal, remplisseurAdresse } from "../../../components/ChampsAdresse";
import { correspondRecherche } from "@/lib/recherche";
import BandeauSection from "@/app/components/BandeauSection";
import { Icone, TEINTES, TitrePanneau, BoutonAction, stylePanneau } from "@/app/components/StyleSection";

export default function RendezVousForm({ clientsExistants }) {
  const router = useRouter();
  const [clientSelectionne, setClientSelectionne] = useState(null);
  const [rechercheClient, setRechercheClient] = useState("");
  const [afficherSuggestions, setAfficherSuggestions] = useState(false);
  const boiteRef = useRef(null);

  const [clientNom, setClientNom] = useState("");
  const [clientTelephone, setClientTelephone] = useState("");
  // Nouveau client : coordonnées gardées avec le rendez-vous, copiées dans son
  // dossier à la conversion en bon (la province vient du code postal)
  const [clientCourriel, setClientCourriel] = useState("");
  const [clientAdresse, setClientAdresse] = useState("");
  const [clientVille, setClientVille] = useState("");
  const [clientCodePostal, setClientCodePostal] = useState("");
  const remplirAdresse = remplisseurAdresse({ ville: clientVille, setAdresse: setClientAdresse, setVille: setClientVille, setCodePostal: setClientCodePostal });
  // Véhicule : un véhicule du dossier du client (son id), "nouveau"
  // (formulaire ci-dessous) ou "" (non précisé)
  const [choixVehicule, setChoixVehicule] = useState("nouveau");
  const [vehicule, setVehicule] = useState(VEHICULE_VIDE);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(dateAujourdhuiQuebec());
  const [heure, setHeure] = useState("09:00");
  const [dureeMinutes, setDureeMinutes] = useState("60");
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState("");
  const [horsDisponibilite, setHorsDisponibilite] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [creneaux, setCreneaux] = useState(null); // null = chargement ; { ferme, creneaux } sinon

  // Cases libres pour la date et la durée choisies (heures d'ouverture,
  // périodes indisponibles et autres rendez-vous déjà retirés).
  useEffect(() => {
    let annule = false;
    setCreneaux(null);
    fetch(`/api/rendezvous/disponibilites?debut=${date}&fin=${date}&duree=${dureeMinutes}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!annule) setCreneaux(data?.jours?.[0] || { ferme: false, creneaux: [] }); });
    return () => { annule = true; };
  }, [date, dureeMinutes]);

  useEffect(() => {
    function surClicExterieur(e) {
      if (boiteRef.current && !boiteRef.current.contains(e.target)) setAfficherSuggestions(false);
    }
    document.addEventListener("mousedown", surClicExterieur);
    return () => document.removeEventListener("mousedown", surClicExterieur);
  }, []);

  const suggestions = useMemo(() => {
    const q = rechercheClient.trim().toLowerCase();
    if (!q) return clientsExistants;
    // Retrouve aussi un client par la plaque ou le NIV d'un de ses véhicules
    const qCompact = q.replace(/[\s-]/g, "");
    const parVehicule = (c) => qCompact.length >= 3 && c.vehicules.some((v) =>
      [v.plaque, v.niv].some((x) => x && x.toLowerCase().replace(/[\s-]/g, "").includes(qCompact)));
    return clientsExistants.filter((c) => correspondRecherche(q, c.nom) || parVehicule(c));
  }, [rechercheClient, clientsExistants]);

  function choisirClient(c) {
    setClientSelectionne(c);
    setRechercheClient(c.nom);
    setClientTelephone(c.telephone || "");
    setAfficherSuggestions(false);
    setChoixVehicule(c.vehicules.length === 1 ? c.vehicules[0].id : c.vehicules.length ? "" : "nouveau");
    setVehicule(VEHICULE_VIDE);
  }
  function changerClientPourNouveau() {
    setClientSelectionne(null);
    setRechercheClient("");
    setClientNom("");
    setClientTelephone("");
    setClientCourriel("");
    setClientAdresse("");
    setClientVille("");
    setClientCodePostal("");
    setChoixVehicule("nouveau");
    setVehicule(VEHICULE_VIDE);
  }

  async function creer(e, forcer = false) {
    e?.preventDefault();
    setErreur("");
    setHorsDisponibilite(false);
    const nomFinal = clientSelectionne ? clientSelectionne.nom : clientNom;
    if (!nomFinal.trim() || !motif.trim()) {
      setErreur("Indique le client et le motif du rendez-vous.");
      return;
    }

    setEnCours(true);
    const res = await fetch("/api/rendezvous", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: clientSelectionne?.id,
        clientNom: nomFinal, clientTelephone, note,
        ...(clientSelectionne ? {} : { clientCourriel: clientCourriel.trim(), clientAdresse, clientVille, clientCodePostal }),
        vehiculeId: choixVehicule !== "nouveau" ? choixVehicule || null : null,
        vehicule: choixVehicule === "nouveau" ? vehicule : null,
        date: `${date}T${heure}:00`,
        dureeMinutes, motif, forcer,
      }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de la création.");
      setHorsDisponibilite(!!data.horsDisponibilite);
      return;
    }
    router.push(`/secretaire/calendrier?date=${date}`);
  }

  return (
    <form onSubmit={creer} className="conteneur-page">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.back() : router.push("/secretaire/calendrier"))}
        style={{ background: "none", border: "none", padding: 0, color: "var(--text-muted)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
      >
        ← Retour
      </button>
      <div style={{ marginTop: 8 }}>
        <BandeauSection icone="📅" titre="Nouveau rendez-vous" sousTitre="Le client, son véhicule et le moment choisi — le rendez-vous s'inscrit au calendrier." />
      </div>

      <div style={stylePanneau}>
        <TitrePanneau icone="personne" teinte={TEINTES.bleu} titre="Client" sousTitre={clientSelectionne ? undefined : "Cherche un client existant (nom ou plaque) ou entre un nouveau client."} />
        {clientSelectionne ? (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 12, borderRadius: 12, background: TEINTES.bleu.fond, border: `1px solid ${TEINTES.bleu.couleur}` }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: "var(--surface)", color: TEINTES.bleu.couleur, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800 }}>
              {clientSelectionne.nom.charAt(0).toUpperCase()}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{clientSelectionne.nom}</div>
              <InfoClient icone="telephone" texte={clientSelectionne.telephone} />
              <InfoClient icone="courriel" texte={clientSelectionne.courriel} />
              <InfoClient icone="epingle" texte={[clientSelectionne.adresse, [clientSelectionne.ville, clientSelectionne.province, clientSelectionne.codePostal].filter(Boolean).join(" ")].filter(Boolean).join(", ")} />
              {!clientSelectionne.telephone && !clientSelectionne.courriel && !clientSelectionne.adresse && !clientSelectionne.ville && (
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>Aucune coordonnée au dossier</div>
              )}
            </div>
            <button type="button" onClick={changerClientPourNouveau} style={{ ...boutonLien, whiteSpace: "nowrap", alignSelf: "flex-start" }}>
              Changer
            </button>
          </div>
        ) : (
          <>
            <div ref={boiteRef} style={{ position: "relative" }}>
              <label style={labelStyle}>Nom du client</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: 19, transform: "translateY(-50%)", display: "flex", pointerEvents: "none" }}>
                  <Icone nom="loupe" taille={18} couleur="var(--text-muted)" />
                </span>
                <input
                  required
                  value={rechercheClient}
                  onChange={(e) => { setRechercheClient(e.target.value); setClientNom(e.target.value); setAfficherSuggestions(true); }}
                  onFocus={() => setAfficherSuggestions(true)}
                  placeholder="Nom ou plaque — recherche ou nouveau client"
                  style={{ ...champInput, paddingLeft: 40 }}
                />
              </div>
              {afficherSuggestions && suggestions.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, zIndex: 10, marginTop: -4, maxHeight: 320, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
                  <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                    {suggestions.length} client{suggestions.length > 1 ? "s" : ""}{rechercheClient.trim() ? "" : " — tape un nom pour filtrer"}
                  </div>
                  {suggestions.map((c) => (
                    <button
                      key={c.id} type="button" onClick={() => choisirClient(c)}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", background: "none", border: "none", borderBottom: "1px solid var(--border)", color: "var(--text)", fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      <div style={{ fontWeight: 700 }}>{c.nom}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{[c.telephone, c.ville].filter(Boolean).join(" · ")}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <label style={labelStyle}>Téléphone</label>
            <input value={clientTelephone} type="tel" onChange={(e) => setClientTelephone(e.target.value)} onBlur={(e) => setClientTelephone(formaterTelephone(e.target.value))} style={champInput} />
            <label style={labelStyle}>Courriel</label>
            <input value={clientCourriel} type="email" onChange={(e) => setClientCourriel(e.target.value)} placeholder="Facultatif — pour envoyer le bon et la facture" style={champInput} />
            <label style={labelStyle}>Adresse</label>
            <ChampAdresse valeur={clientAdresse} onChange={setClientAdresse} onChoisir={remplirAdresse.onChoisir} style={champInput} />
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 120px", gap: 8 }}>
              <div>
                <label style={labelStyle}>Ville</label>
                <ChampVille valeur={clientVille} onChange={setClientVille} codePostal={clientCodePostal} style={{ ...champInput, marginBottom: 0 }} />
              </div>
              <div>
                <label style={labelStyle}>Code postal</label>
                <ChampCodePostal valeur={clientCodePostal} onChange={setClientCodePostal} onSecteur={remplirAdresse.onSecteur} style={{ ...champInput, marginBottom: 0 }} />
              </div>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 0 0" }}>Ajouté au dossier des clients quand le rendez-vous devient un bon de travail.</p>
          </>
        )}
      </div>

      <div style={stylePanneau}>
        <TitrePanneau icone="vehicule" teinte={TEINTES.bleu} titre="Véhicule" />
        <ChoixVehiculeClient
          key={clientSelectionne?.id || "nouveau-client"}
          vehicules={clientSelectionne?.vehicules || []}
          choix={choixVehicule} onChoix={setChoixVehicule}
          vehicule={vehicule} onVehicule={setVehicule}
          onVehiculeModifie={(data) => setClientSelectionne((c) => ({ ...c, vehicules: c.vehicules.map((v) => (v.id === data.id ? data : v)) }))}
        />
      </div>

      <div style={stylePanneau}>
        <TitrePanneau icone="calendrier" teinte={TEINTES.vert} titre="Rendez-vous" sousTitre="Choisis une case libre ou entre l'heure toi-même." />
        <label style={{ ...labelStyle, marginTop: 0 }}>Motif</label>
        <input required placeholder="Ex : Changement d'huile" value={motif} onChange={(e) => setMotif(e.target.value)} style={champInput} />
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 130px", gap: 8 }}>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" max="9999-12-31" required value={date} onChange={(e) => setDate(e.target.value)} style={{ ...champInput, marginBottom: 0 }} />
          </div>
          <div>
            <label style={labelStyle}>Heure</label>
            <input type="time" required value={heure} onChange={(e) => setHeure(e.target.value)} style={{ ...champInput, marginBottom: 0 }} />
          </div>
        </div>
        <label style={labelStyle}>Durée</label>
        <select value={dureeMinutes} onChange={(e) => setDureeMinutes(e.target.value)} style={{ ...champInput, marginBottom: 0 }}>
          <option value="30">30 minutes</option>
          <option value="60">1 heure</option>
          <option value="90">1h30</option>
          <option value="120">2 heures</option>
          <option value="180">3 heures</option>
        </select>

        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 12, background: TEINTES.vert.fond }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, marginBottom: creneaux?.creneaux?.length ? 8 : 0 }}>
            <Icone nom="horloge" taille={15} couleur="var(--success)" />
            {creneaux === null ? "Recherche des disponibilités…"
              : creneaux.ferme ? "L'atelier est fermé cette journée-là."
              : creneaux.creneaux.length === 0 ? "Aucune case libre ce jour-là pour cette durée."
              : "Cases libres"}
          </div>
          {creneaux?.creneaux?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {creneaux.creneaux.map((c) => (
                <button
                  key={c} type="button" onClick={() => setHeure(c)}
                  style={{ fontSize: 12.5, fontWeight: 700, padding: "6px 10px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${heure === c ? "var(--success)" : "var(--border)"}`, background: heure === c ? "var(--success)" : "var(--surface)", color: heure === c ? "#fff" : "var(--text)" }}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        <label style={labelStyle}>Note</label>
        <input placeholder="Facultatif — ex : rendez-vous d'affaire, pas lié à un service" value={note} onChange={(e) => setNote(e.target.value)} style={{ ...champInput, marginBottom: 0 }} />
      </div>

      {erreur && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--danger-fond)", border: "1px solid var(--danger)", borderRadius: 12, padding: "10px 14px", fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>
          <Icone nom="alerte" taille={16} couleur="var(--danger)" /> {erreur}
        </div>
      )}
      {horsDisponibilite && (
        <BoutonAction icone="calendrier" couleur="var(--danger)" bordure="var(--danger)" onClick={() => creer(null, true)} disabled={enCours} style={{ width: "100%", marginBottom: 8 }}>
          Créer quand même
        </BoutonAction>
      )}

      <button type="submit" disabled={enCours} className="bouton-3d" style={{ width: "100%", padding: 13, borderRadius: 12, fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
        {enCours ? "Création…" : "Créer le rendez-vous"}
      </button>
    </form>
  );
}

// Une coordonnée du client choisi, avec son icône (rien si vide)
function InfoClient({ icone, texte }) {
  if (!texte) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12.5, color: "var(--text-muted)", marginTop: 3, overflowWrap: "anywhere" }}>
      <span style={{ display: "flex", marginTop: 1, flexShrink: 0 }}><Icone nom={icone} taille={14} couleur="var(--text-muted)" /></span>
      <span style={{ minWidth: 0 }}>{texte}</span>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4, marginTop: 10 };
const champInput = {
  width: "100%", padding: "9px 10px", borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
const boutonLien = { fontSize: 12.5, fontWeight: 700, color: "var(--accent-ombre)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", fontFamily: "inherit" };
