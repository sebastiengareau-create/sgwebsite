"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import SelecteurDatePrevue from "../../components/SelecteurDatePrevue";
import { valeurDateHeureLocale } from "@/lib/regroupementDates";
import { VEHICULE_VIDE } from "../../components/ChampsVehicule";
import ChoixVehiculeClient from "../../components/ChoixVehiculeClient";
import { ChampAdresse, ChampVille, ChampCodePostal, remplisseurAdresse } from "../../components/ChampsAdresse";
import SelectProvince from "../../components/SelectProvince";
import { PROVINCE_DEFAUT } from "@/lib/adresse";
import { PrisePhotosArrivee } from "../../components/PhotosArrivee";
import { compresserImage } from "@/lib/images";
import { useChoixPhoto } from "../../components/ChoixPhoto";
import { CLIENT } from "@/lib/client";
import { messageBonsNonFactures, QUESTION_BON_NON_FACTURE } from "@/lib/bonsNonFactures";
import { formaterTelephone } from "@/lib/telephone";
import { correspondRecherche } from "@/lib/recherche";
import BandeauSection from "@/app/components/BandeauSection";
import { Icone, TEINTES, Pastille, TitrePanneau, BoutonAction, stylePanneau } from "@/app/components/StyleSection";

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
  const [clientProvince, setClientProvince] = useState(PROVINCE_DEFAUT);
  const [clientCodePostal, setClientCodePostal] = useState("");
  const remplirAdresse = remplisseurAdresse({ ville: clientVille, setAdresse: setClientAdresse, setVille: setClientVille, setProvince: setClientProvince, setCodePostal: setClientCodePostal });

  // Véhicule du bon : un véhicule du dossier du client (son id), "nouveau"
  // (formulaire ci-dessous, ajouté au dossier) ou "" (non précisé)
  const [choixVehicule, setChoixVehicule] = useState("nouveau");
  const [vehicule, setVehicule] = useState(VEHICULE_VIDE);

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
    return clientsExistants.filter((c) => correspondRecherche(q, c.nom) || parVehicule(c));
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
  }

  function changerClientPourNouveau() {
    setClientSelectionne(null);
    setRechercheClient("");
    setClientNom("");
    setClientTelephone("");
    setClientAdresse("");
    setClientVille("");
    setClientProvince(PROVINCE_DEFAUT);
    setClientCodePostal("");
    setChoixVehicule("nouveau");
    setVehicule(VEHICULE_VIDE);
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
        clientNom, clientTelephone, clientAdresse, clientVille, clientProvince, clientCodePostal,
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
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.back() : router.push("/secretaire"))}
        style={{ background: "none", border: "none", padding: 0, color: "var(--text-muted)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
      >
        ← Retour
      </button>
      <div style={{ marginTop: 8 }}>
        <BandeauSection icone="🔧" titre="Nouveau bon de travail" sousTitre="Le client, son véhicule et les problèmes à régler — le bon s'ouvre ensuite pour l'équipe." />
      </div>

      <div style={stylePanneau}>
        <TitrePanneau icone="personne" teinte={TEINTES.bleu} titre="Client" sousTitre={clientSelectionne ? undefined : "Cherche un client existant (nom ou plaque) ou entre un nouveau client."} />
        {clientSelectionne ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, background: TEINTES.bleu.fond, border: `1px solid ${TEINTES.bleu.couleur}` }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: "var(--surface)", color: TEINTES.bleu.couleur, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800 }}>
              {clientSelectionne.nom.charAt(0).toUpperCase()}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{clientSelectionne.nom}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                {[clientSelectionne.telephone, clientSelectionne.ville].filter(Boolean).join(" · ") || "Client existant"}
              </div>
              {(clientSelectionne.garantieProlongee || (CLIENT.avertirBonNonFacture && clientSelectionne.bons?.length > 0)) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {clientSelectionne.garantieProlongee && <Pastille couleur={TEINTES.bleu.couleur} fond="var(--surface)">Garantie prolongée #{clientSelectionne.garantieProlongee}</Pastille>}
                  {CLIENT.avertirBonNonFacture && clientSelectionne.bons?.length > 0 && (
                    <Pastille couleur="var(--accent-ombre)" fond={TEINTES.ambre.fond}>
                      Non facturé{clientSelectionne.bons.length > 1 ? "s" : ""} :{" "}
                      {clientSelectionne.bons.map((b, i) => (
                        <span key={b.id}>{i > 0 && ", "}<a href={`/bons/${b.id}`} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>#{b.numero}</a></span>
                      ))}
                    </Pastille>
                  )}
                </div>
              )}
            </div>
            <button type="button" onClick={changerClientPourNouveau} style={{ ...boutonLien, whiteSpace: "nowrap", alignSelf: "flex-start" }}>
              Changer
            </button>
          </div>
        ) : (
          <>
            <div ref={boiteRechercheRef} style={{ position: "relative" }}>
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
            <label style={labelStyle}>Adresse</label>
            <ChampAdresse valeur={clientAdresse} onChange={setClientAdresse} onChoisir={remplirAdresse.onChoisir} style={champInput} />
            <label style={labelStyle}>Ville</label>
            <ChampVille valeur={clientVille} onChange={setClientVille} codePostal={clientCodePostal} style={champInput} />
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Province</label>
                <SelectProvince valeur={clientProvince} onChange={setClientProvince} style={{ ...champInput, marginBottom: 0 }} />
              </div>
              <div style={{ width: 120 }}>
                <label style={labelStyle}>Code postal</label>
                <ChampCodePostal valeur={clientCodePostal} onChange={setClientCodePostal} onSecteur={remplirAdresse.onSecteur} style={{ ...champInput, marginBottom: 0 }} />
              </div>
            </div>
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
          permettreNonPrecise={!CLIENT.vehiculeObligatoire}
        />
      </div>

      {CLIENT.photosArrivee && (
        <div style={stylePanneau}>
          <TitrePanneau icone="camera" teinte={TEINTES.neutre} titre="Photos à l'arrivée" sousTitre="Gardées en référence en haut du bon, jamais imprimées." />
          <PrisePhotosArrivee valeurs={photosArrivee} onChange={setPhotosArrivee} />
        </div>
      )}

      <div style={stylePanneau}>
        <TitrePanneau icone="outils" teinte={TEINTES.ambre} titre="Problèmes signalés" sousTitre="Chaque ligne devient une tâche du bon." />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          {problemes.map((valeur, i) => (
            <div key={i}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: TEINTES.ambre.fond, color: "var(--accent-ombre)", fontSize: 12.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                <input
                  required={i === 0}
                  value={valeur}
                  onChange={(e) => changerProbleme(i, e.target.value)}
                  placeholder={i === 0 ? "Ex : Bruit de freinage à l'avant" : "Ajouter un autre problème…"}
                  style={{ ...champInput, marginBottom: 0, flex: 1, minWidth: 0 }}
                />
                {CLIENT.photosTachesCreation && (
                  <BoutonPhotoProbleme onFichiers={(f) => ajouterPhotosProbleme(i, f)} />
                )}
                {problemes.length > 1 && (
                  <button type="button" onClick={() => supprimerLigneProbleme(i)} aria-label="Retirer la ligne" style={boutonIcone}>
                    <Icone nom="poubelle" taille={16} couleur="var(--danger)" />
                  </button>
                )}
              </div>
              {(photosProblemes[i] || []).length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0 0 34px" }}>
                  {photosProblemes[i].map((src, k) => (
                    <div key={k} style={{ position: "relative" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Photo ${k + 1}`} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border)", display: "block" }} />
                      <button type="button" onClick={() => retirerPhotoProbleme(i, k)} aria-label="Retirer la photo"
                        style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: 999, border: "none", background: "var(--danger)", color: "#fff", fontSize: 10, lineHeight: "18px", padding: 0, cursor: "pointer" }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {erreurPhotoProbleme && <p style={{ color: "var(--danger)", fontSize: 12.5, fontWeight: 700, margin: 0 }}>{erreurPhotoProbleme}</p>}
        </div>
        <button type="button" onClick={ajouterLigneProbleme} style={boutonPointille}>
          + Ajouter une autre ligne de problème
        </button>
      </div>

      <div style={stylePanneau}>
        <TitrePanneau icone="calendrier" teinte={TEINTES.vert} titre="Date prévue" />
        <SelecteurDatePrevue valeur={datePrevue} onChange={setDatePrevue} />
        {calendrierActif && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginTop: 12, padding: "10px 12px", borderRadius: 12, background: ajouterAuCalendrier ? TEINTES.vert.fond : "var(--bg)" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              <input type="checkbox" checked={ajouterAuCalendrier} onChange={(e) => setAjouterAuCalendrier(e.target.checked)} style={{ width: 17, height: 17, accentColor: "var(--success)" }} />
              Inscrire au calendrier
            </label>
            {ajouterAuCalendrier && (
              <select value={dureeMinutes} onChange={(e) => setDureeMinutes(e.target.value)} style={{ ...champInput, width: 118, marginBottom: 0, background: "var(--surface)" }}>
                <option value="30">30 min</option>
                <option value="60">1 heure</option>
                <option value="90">1h30</option>
                <option value="120">2 heures</option>
                <option value="180">3 heures</option>
                <option value="240">4 heures</option>
                <option value="480">Journée (8 h)</option>
              </select>
            )}
          </div>
        )}
      </div>

      {erreur && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--danger-fond)", border: "1px solid var(--danger)", borderRadius: 12, padding: "10px 14px", fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>
          <Icone nom="alerte" taille={16} couleur="var(--danger)" /> {erreur}
        </div>
      )}
      {horsDisponibilite && (
        <BoutonAction icone="calendrier" couleur="var(--danger)" bordure="var(--danger)" onClick={() => creer(null, true)} disabled={enCours} style={{ width: "100%", marginBottom: 8 }}>
          Créer et inscrire au calendrier quand même
        </BoutonAction>
      )}

      <button type="submit" disabled={enCours} className="bouton-3d" style={{ width: "100%", padding: 13, borderRadius: 12, fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
        {enCours ? "Création…" : "Créer le bon de travail"}
      </button>
    </form>
  );
}

function BoutonPhotoProbleme({ onFichiers }) {
  const photo = useChoixPhoto(onFichiers, { multiple: true });
  return (
    <>
      <button type="button" title="Photo du problème" aria-label="Photo du problème" onClick={photo.ouvrir} style={boutonIcone}>
        <Icone nom="camera" taille={17} couleur="var(--accent-ombre)" />
      </button>
      {photo.element}
    </>
  );
}

const labelStyle = { display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4, marginTop: 10 };
const champInput = {
  width: "100%", padding: "9px 10px", borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
const boutonLien = { fontSize: 12.5, fontWeight: 700, color: "var(--accent-ombre)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", fontFamily: "inherit" };
const boutonIcone = {
  width: 38, height: 38, flexShrink: 0, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)",
  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0,
};
const boutonPointille = {
  width: "100%", padding: "10px 8px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  color: "var(--accent-ombre)", background: "none", border: "1.5px dashed var(--accent)",
};
