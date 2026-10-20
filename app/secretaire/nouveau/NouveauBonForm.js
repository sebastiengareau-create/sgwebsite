"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import SelecteurDatePrevue from "../../components/SelecteurDatePrevue";
import { valeurDateHeureLocale } from "@/lib/regroupementDates";
import ChampsVehicule, { VEHICULE_VIDE } from "../../components/ChampsVehicule";
import OptionVehicule from "../../components/OptionVehicule";
import { PrisePhotosArrivee } from "../../components/PhotosArrivee";
import { compresserImage } from "@/lib/images";
import { libelleVehicule } from "@/lib/vehicules";
import { CLIENT } from "@/lib/client";
import { messageBonsNonFactures, QUESTION_BON_NON_FACTURE } from "@/lib/bonsNonFactures";

export default function NouveauBon({ clientsExistants, calendrierActif = true }) {
  const router = useRouter();
  const [clientSelectionne, setClientSelectionne] = useState(null);
  const [rechercheClient, setRechercheClient] = useState("");
  const [afficherSuggestions, setAfficherSuggestions] = useState(false);
  const boiteRechercheRef = useRef(null);

  useEffect(() => {
    function surClicExterieur(e) {
      if (boiteRechercheRef.current && !boiteRechercheRef.current.contains(e.target)) {
        setAfficherSuggestions(false);
      }
    }
    document.addEventListener("mousedown", surClicExterieur);
    return () => document.removeEventListener("mousedown", surClicExterieur);
  }, []);

  const [clientNom, setClientNom] = useState("");
  const [clientTelephone, setClientTelephone] = useState("");
  const [clientAdresse, setClientAdresse] = useState("");
  const [clientVille, setClientVille] = useState("");
  const [clientCodePostal, setClientCodePostal] = useState("");

  // Véhicule du bon : un véhicule du dossier du client (son id), "nouveau"
  // (formulaire ci-dessous, ajouté au dossier) ou "" (non précisé)
  const [choixVehicule, setChoixVehicule] = useState("nouveau");
  const [vehicule, setVehicule] = useState(VEHICULE_VIDE);
  // Véhicule du dossier en cours de modification (plaque, NIV…) : son id
  const [vehiculeEdite, setVehiculeEdite] = useState(null);
  const [valeurEditee, setValeurEditee] = useState(VEHICULE_VIDE);
  const [erreurVehicule, setErreurVehicule] = useState("");
  const [enregistrementVehicule, setEnregistrementVehicule] = useState(false);

  // Photos du véhicule à l'arrivée : { position: dataUrl }, envoyées une fois le bon créé
  const [photosArrivee, setPhotosArrivee] = useState({});
  const [problemes, setProblemes] = useState([""]);
  // Photos de chaque ligne de problème (profil photosTachesCreation) : une
  // liste de dataUrl par ligne, jointes à sa tâche une fois le bon créé
  const [photosProblemes, setPhotosProblemes] = useState([[]]);
  const [erreurPhotoProbleme, setErreurPhotoProbleme] = useState("");
  const [datePrevue, setDatePrevue] = useState(() => valeurDateHeureLocale(new Date()));
  // Module Calendrier désactivé : le bon ne s'y inscrit pas (case cachée)
  const [ajouterAuCalendrier, setAjouterAuCalendrier] = useState(calendrierActif);
  const [dureeMinutes, setDureeMinutes] = useState("60");
  const [horsDisponibilite, setHorsDisponibilite] = useState(false);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  // Tous les clients qui correspondent (tous, champ vide), dans une liste
  // déroulante
  const suggestions = useMemo(() => {
    const q = rechercheClient.trim().toLowerCase();
    if (!q) return clientsExistants;
    // Retrouve aussi un client par la plaque ou le NIV d'un de ses véhicules
    const qCompact = q.replace(/[\s-]/g, "");
    const parVehicule = (c) => qCompact.length >= 3 && c.vehicules.some((v) =>
      [v.plaque, v.niv].some((x) => x && x.toLowerCase().replace(/[\s-]/g, "").includes(qCompact)));
    return clientsExistants.filter((c) => c.nom.toLowerCase().includes(q) || parVehicule(c));
  }, [rechercheClient, clientsExistants]);

  async function choisirClient(c) {
    setAfficherSuggestions(false);
    // Profil avertirBonNonFacture : le client (ou un dossier semblable) a
    // déjà un bon pas encore facturé — continuer seulement si on le confirme
    let bons = [];
    if (CLIENT.avertirBonNonFacture) {
      const res = await fetch(`/api/clients/${c.id}/bons-non-factures`).catch(() => null);
      bons = res?.ok ? await res.json() : [];
      if (bons.length && !window.confirm(`${messageBonsNonFactures(c.nom, bons, c.id)}\n\n${QUESTION_BON_NON_FACTURE}`)) return;
    }
    c = { ...c, bons };
    setClientSelectionne(c);
    setRechercheClient(c.nom);
    setAfficherSuggestions(false);
    // Véhicule obligatoire : le premier du dossier est présélectionné
    const parDefaut = c.vehicules.length === 1 || (CLIENT.vehiculeObligatoire && c.vehicules.length) ? c.vehicules[0].id : c.vehicules.length ? "" : "nouveau";
    setChoixVehicule(parDefaut);
    setVehicule(VEHICULE_VIDE);
    setVehiculeEdite(null);
  }

  function modifierVehicule(v) {
    setErreurVehicule("");
    setVehiculeEdite(v.id);
    setValeurEditee({ annee: v.annee ? String(v.annee) : "", marque: v.marque || "", modele: v.modele || "", version: v.version || "", niv: v.niv || "", plaque: v.plaque || "" });
  }

  // Enregistré tout de suite au dossier du client, puis choisi pour le bon
  async function enregistrerVehicule() {
    setErreurVehicule("");
    setEnregistrementVehicule(true);
    const res = await fetch(`/api/vehicules/${vehiculeEdite}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(valeurEditee),
    });
    setEnregistrementVehicule(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErreurVehicule(data.erreur || "Erreur.");
      return;
    }
    setClientSelectionne((c) => ({ ...c, vehicules: c.vehicules.map((v) => (v.id === data.id ? data : v)) }));
    setChoixVehicule(data.id);
    setVehiculeEdite(null);
  }

  function changerClientPourNouveau() {
    setClientSelectionne(null);
    setRechercheClient("");
    setClientNom("");
    setClientTelephone("");
    setClientAdresse("");
    setClientVille("");
    setClientCodePostal("");
    setChoixVehicule("nouveau");
    setVehicule(VEHICULE_VIDE);
    setVehiculeEdite(null);
  }

  function changerProbleme(index, valeur) {
    setProblemes((prev) => prev.map((p, i) => (i === index ? valeur : p)));
  }
  function ajouterLigneProbleme() {
    setProblemes((prev) => [...prev, ""]);
    setPhotosProblemes((prev) => [...prev, []]);
  }
  function supprimerLigneProbleme(index) {
    setProblemes((prev) => prev.filter((_, i) => i !== index));
    setPhotosProblemes((prev) => prev.filter((_, i) => i !== index));
  }
  async function ajouterPhotosProbleme(index, fichiers) {
    setErreurPhotoProbleme("");
    try {
      const images = await Promise.all([...fichiers].map((f) => compresserImage(f, 800, 0.5)));
      setPhotosProblemes((prev) => prev.map((l, i) => (i === index ? [...l, ...images] : l)));
    } catch (e) {
      setErreurPhotoProbleme("Impossible de traiter cette photo : " + e.message);
    }
  }
  function retirerPhotoProbleme(index, k) {
    setPhotosProblemes((prev) => prev.map((l, i) => (i === index ? l.filter((_, j) => j !== k) : l)));
  }

  async function creer(e, forcer = false, confirmerDoublon = false, confirmerBonNonFacture = false) {
    e?.preventDefault();
    setErreur("");
    setHorsDisponibilite(false);

    const lignesValides = problemes.map((p) => p.trim()).filter(Boolean);
    if (lignesValides.length === 0) {
      setErreur("Ajoute au moins une ligne de problème.");
      return;
    }
    if (CLIENT.vehiculeObligatoire && choixVehicule === "nouveau" && !Object.values(vehicule).some((v) => String(v || "").trim())) {
      setErreur("Indique au moins une information sur le véhicule (marque, année, NIV, plaque…), ou choisis-en un du dossier du client.");
      return;
    }
    if (!clientSelectionne && !clientNom.trim()) {
      setErreur("Indique le nom du client, ou choisis-en un existant.");
      return;
    }

    setEnCours(true);
    const res = await fetch("/api/bons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: clientSelectionne?.id,
        clientNom, clientTelephone, clientAdresse, clientVille, clientCodePostal,
        problemes: lignesValides,
        datePrevue, ajouterAuCalendrier, dureeMinutes, forcer, confirmerDoublon,
        vehiculeId: choixVehicule !== "nouveau" ? choixVehicule || null : null,
        vehicule: choixVehicule === "nouveau" ? vehicule : null,
        // Déjà averti en choisissant le client : le serveur ne redemande que
        // pour un bon apparu depuis
        confirmerBonNonFacture: confirmerBonNonFacture || !!clientSelectionne?.bons?.length,
      }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      // Client semblable déjà au dossier : créer quand même si c'est bien
      // une autre personne (homonyme)
      if (data.doublonPossible && window.confirm(`${data.erreur}\n\nCréer quand même un nouveau client ?`)) {
        return creer(e, forcer, true, confirmerBonNonFacture);
      }
      // Le client a déjà un bon non facturé : continuer ou non
      if (data.bonNonFacture) {
        if (window.confirm(`${data.erreur}\n\n${QUESTION_BON_NON_FACTURE}`)) return creer(e, forcer, confirmerDoublon, true);
        setErreur("Création annulée — ce client a déjà un bon non facturé.");
        return;
      }
      setErreur(data.erreur || "Erreur lors de la création.");
      setHorsDisponibilite(!!data.horsDisponibilite);
      return;
    }
    const { id, problemeIds = [] } = await res.json();
    // Les lignes vides ne deviennent pas des tâches : les photos suivent les lignes remplies
    const photosParTache = problemes
      .map((p, i) => ({ rempli: !!p.trim(), photos: photosProblemes[i] || [] }))
      .filter((l) => l.rempli)
      .map((l, k) => ({ problemeId: problemeIds[k], photos: l.photos }));
    // Une photo refusée n'empêche pas d'ouvrir le bon : elle s'y reprend
    setEnCours(true);
    for (const [position, dataUrl] of Object.entries(photosArrivee)) {
      await fetch(`/api/bons/${id}/photos-arrivee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position, dataUrl }),
      }).catch(() => null);
    }
    for (const { problemeId, photos } of photosParTache) {
      if (!problemeId) continue;
      for (const dataUrl of photos) {
        await fetch(`/api/bons/${id}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ problemeId, dataUrl }),
        }).catch(() => null);
      }
    }
    router.push(`/bons/${id}`);
  }

  return (
    <form onSubmit={creer} className="conteneur-page">
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Nouveau bon de travail</h1>

      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginTop: 4, marginBottom: 4 }}>Client</div>

      {clientSelectionne ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 8, padding: 10, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{clientSelectionne.nom}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {[clientSelectionne.telephone, clientSelectionne.ville].filter(Boolean).join(" · ") || "Client existant"}
              {clientSelectionne.garantieProlongee && <> · 🛡️ Garantie #{clientSelectionne.garantieProlongee}</>}
            </div>
            {CLIENT.avertirBonNonFacture && clientSelectionne.bons?.length > 0 && (
              <div style={{ fontSize: 11, color: "#C9A227", marginTop: 3 }}>
                ⚠️ Non facturé{clientSelectionne.bons.length > 1 ? "s" : ""} en cours :{" "}
                {clientSelectionne.bons.map((b, i) => (
                  <span key={b.id}>{i > 0 && ", "}<a href={`/bons/${b.id}`} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>#{b.numero}</a></span>
                ))}
              </div>
            )}
          </div>
          <button type="button" onClick={changerClientPourNouveau} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>
            Changer
          </button>
        </div>
      ) : (
        <div ref={boiteRechercheRef} style={{ position: "relative" }}>
          <label style={labelStyle}>Nom du client</label>
          <input
            required
            value={rechercheClient}
            onChange={(e) => { setRechercheClient(e.target.value); setClientNom(e.target.value); setAfficherSuggestions(true); }}
            onFocus={() => setAfficherSuggestions(true)}
            placeholder="Tape un nom (ou une plaque) pour trouver un client existant, ou en créer un nouveau"
            style={champInput}
          />
          {afficherSuggestions && suggestions.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, zIndex: 10, marginTop: -4, maxHeight: 320, overflowY: "auto" }}>
              <div style={{ padding: "6px 10px", fontSize: 11, color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                {suggestions.length} client{suggestions.length > 1 ? "s" : ""}{rechercheClient.trim() ? "" : " — tape un nom pour filtrer"}
              </div>
              {suggestions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => choisirClient(c)}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", background: "none", border: "none", borderBottom: "1px solid var(--border)", color: "var(--text)", fontSize: 13, cursor: "pointer" }}
                >
                  <div style={{ fontWeight: 600 }}>{c.nom}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {[c.telephone, c.ville].filter(Boolean).join(" · ")}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!clientSelectionne && (
        <>
          <Champ label="Téléphone" value={clientTelephone} onChange={setClientTelephone} />
          <Champ label="Adresse" value={clientAdresse} onChange={setClientAdresse} />
          <div style={{ display: "flex", gap: 8 }}>
            <Champ label="Ville" value={clientVille} onChange={setClientVille} style={{ flex: 1 }} />
            <Champ label="Code postal" value={clientCodePostal} onChange={(v) => setClientCodePostal(v.toUpperCase())} style={{ width: 110 }} />
          </div>
        </>
      )}

      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginTop: 14, marginBottom: 4 }}>Véhicule</div>
      {clientSelectionne && clientSelectionne.vehicules.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 }}>
          {clientSelectionne.vehicules.map((v) => vehiculeEdite === v.id ? (
            // Pas de <form> imbriqué : Entrée enregistre le véhicule au lieu de créer le bon
            <div key={v.id} onKeyDown={(e) => { if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); enregistrerVehicule(); } }}
              style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 8, padding: "4px 10px 10px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>Modifier le véhicule (enregistré au dossier du client)</div>
              <ChampsVehicule valeur={valeurEditee} onChange={setValeurEditee} />
              {erreurVehicule && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{erreurVehicule}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button type="button" onClick={enregistrerVehicule} disabled={enregistrementVehicule} className="bouton-3d" style={{ flex: 1, padding: 9, borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
                  {enregistrementVehicule ? "…" : "Enregistrer"}
                </button>
                <button type="button" onClick={() => setVehiculeEdite(null)} className="bouton-3d-sombre" style={{ flex: 1, padding: 9, borderRadius: 8, fontSize: 13 }}>
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div key={v.id} style={{ display: "flex", gap: 6 }}>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <OptionVehicule actif={choixVehicule === v.id} onClick={() => setChoixVehicule(v.id)}
                  titre={libelleVehicule(v) || "Véhicule sans description"}
                  detail={[v.plaque && `Plaque ${v.plaque}`, v.niv && `NIV ${v.niv}`].filter(Boolean).join(" · ")}
                />
              </div>
              <button type="button" onClick={() => modifierVehicule(v)} disabled={vehiculeEdite !== null} className="bouton-3d-sombre"
                style={{ padding: "0 12px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                ✏️ Modifier
              </button>
            </div>
          ))}
          <OptionVehicule actif={choixVehicule === "nouveau"} onClick={() => setChoixVehicule("nouveau")} titre="+ Autre véhicule (ajouté au dossier du client)" />
          {!CLIENT.vehiculeObligatoire && (
            <OptionVehicule actif={choixVehicule === ""} onClick={() => setChoixVehicule("")} titre="Non précisé" />
          )}
        </div>
      )}
      {choixVehicule === "nouveau" && <ChampsVehicule valeur={vehicule} onChange={setVehicule} />}

      {CLIENT.photosArrivee && (
        <>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginTop: 14, marginBottom: 4 }}>Photos du véhicule à l'arrivée</div>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "0 0 6px" }}>Gardées en référence en haut du bon, jamais imprimées.</p>
          <PrisePhotosArrivee valeurs={photosArrivee} onChange={setPhotosArrivee} />
        </>
      )}

      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginTop: 14, marginBottom: 4 }}>Problèmes signalés</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 }}>
        {problemes.map((valeur, i) => (
          <div key={i}>
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center", width: 14 }}>{i + 1}.</span>
            <input
              required={i === 0}
              value={valeur}
              onChange={(e) => changerProbleme(i, e.target.value)}
              placeholder={i === 0 ? "Ex : Bruit de freinage à l'avant" : "Ajouter un autre problème…"}
              style={{ ...champInput, marginBottom: 0, flex: 1 }}
            />
            {CLIENT.photosTachesCreation && (
              <label title="Photo du problème" style={{ ...boutonTexte, alignSelf: "center", fontSize: 17, padding: "0 2px" }}>
                📷
                <input type="file" accept="image/*" capture="environment" multiple style={{ display: "none" }}
                  onChange={(e) => { if (e.target.files?.length) ajouterPhotosProbleme(i, e.target.files); e.target.value = ""; }} />
              </label>
            )}
            {problemes.length > 1 && (
              <button type="button" onClick={() => supprimerLigneProbleme(i)} style={boutonTexte}>✕</button>
            )}
          </div>
          {(photosProblemes[i] || []).length > 0 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", margin: "4px 0 0 20px" }}>
              {photosProblemes[i].map((src, k) => (
                <div key={k} style={{ position: "relative" }}>
                  <img src={src} alt={`Photo ${k + 1}`} style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)", display: "block" }} />
                  <button type="button" onClick={() => retirerPhotoProbleme(i, k)} aria-label="Retirer la photo"
                    style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: 999, border: "none", background: "var(--danger)", color: "#fff", fontSize: 10, lineHeight: "18px", padding: 0, cursor: "pointer" }}>✕</button>
                </div>
              ))}
            </div>
          )}
          </div>
        ))}
        {erreurPhotoProbleme && <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>{erreurPhotoProbleme}</p>}
      </div>
      <button type="button" onClick={ajouterLigneProbleme} style={boutonAjoutLigne}>
        + Ajouter une autre ligne de problème
      </button>

      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginTop: 18, marginBottom: 6 }}>Date prévue</div>
      <SelecteurDatePrevue valeur={datePrevue} onChange={setDatePrevue} />

      {calendrierActif && <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={ajouterAuCalendrier} onChange={(e) => setAjouterAuCalendrier(e.target.checked)} />
          📅 Inscrire au calendrier
        </label>
        {ajouterAuCalendrier && (
          <select value={dureeMinutes} onChange={(e) => setDureeMinutes(e.target.value)} style={{ ...champInput, width: "auto", marginBottom: 0 }}>
            <option value="30">30 min</option>
            <option value="60">1 heure</option>
            <option value="90">1h30</option>
            <option value="120">2 heures</option>
            <option value="180">3 heures</option>
            <option value="240">4 heures</option>
            <option value="480">Journée (8 h)</option>
          </select>
        )}
      </div>}

      {erreur && <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10, marginTop: 10 }}>{erreur}</p>}
      {horsDisponibilite && (
        <button type="button" onClick={() => creer(null, true)} disabled={enCours} style={{ width: "100%", marginBottom: 6, padding: 10, borderRadius: 8, border: "1px solid var(--danger)", background: "none", color: "var(--danger)", fontWeight: 700, cursor: "pointer" }}>
          Créer et inscrire au calendrier quand même
        </button>
      )}

      <button
        type="submit" disabled={enCours}
        style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: "var(--accent)", color: "#17150f", fontWeight: 700, cursor: "pointer", marginTop: 10 }}
      >
        {enCours ? "Création…" : "Créer le bon de travail"}
      </button>
    </form>
  );
}

function Champ({ label, value, onChange, requis, type = "text", style }) {
  return (
    <div style={style}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type} required={requis} value={value}
        onChange={(e) => onChange(e.target.value)}
        style={champInput}
      />
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4, marginTop: 10 };
const champInput = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--surface)", color: "var(--text)", fontSize: 13, marginBottom: 6, boxSizing: "border-box",
};
const boutonTexte = { background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 };
const boutonAjoutLigne = {
  background: "none", border: "1px dashed var(--border)", color: "var(--accent)", fontSize: 12,
  padding: "6px 10px", borderRadius: 8, cursor: "pointer", width: "100%",
};
