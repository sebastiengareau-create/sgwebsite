"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { VEHICULE_VIDE } from "../../../../components/ChampsVehicule";
import ChoixVehiculeClient from "../../../../components/ChoixVehiculeClient";
import { valeursFormulaireVehicule } from "@/lib/vehicules";
import { formaterTelephone } from "@/lib/telephone";
import { ChampAdresse, ChampVille, ChampCodePostal, remplisseurAdresse } from "../../../../components/ChampsAdresse";
import SelectProvince from "../../../../components/SelectProvince";
import { PROVINCE_DEFAUT } from "@/lib/adresse";
import { CLIENT } from "@/lib/client";
import { correspondRecherche } from "@/lib/recherche";
import { pieceCorrespond } from "@/lib/codesBarres";
import BoutonEnvoiCourriel from "@/app/components/BoutonEnvoiCourriel";

// Profil piecesEnHautDuBon : comme sur le bon, une seule section « Pièces »
// en haut, avant les tâches. Les pièces restent enregistrées sur une tâche
// (la première), comme celles du bon.
const PIECES_EN_HAUT = CLIENT.piecesEnHautDuBon;

function nouvelleTache() {
  return { id: Math.random().toString(36).slice(2), description: "", tempsEstime: "", pieces: [] };
}
function nouvellePiece() {
  return { id: Math.random().toString(36).slice(2), nom: "", prixEstime: "", qte: "1", pieceId: null };
}
// Pièce choisie dans l'inventaire : nom et prix de vente de la fiche (le prix
// reste modifiable). Rien ne sort du stock ici — seulement quand la
// soumission devient un bon ou une facture.
function pieceDeLInventaire(piece) {
  return { id: Math.random().toString(36).slice(2), nom: piece.nom, prixEstime: String(piece.prix ?? ""), qte: "1", pieceId: piece.id };
}
// Ajoute une pièce de l'inventaire à une liste : déjà là, sa quantité monte
function ajouterDeLInventaire(liste, piece) {
  const existante = liste.find((p) => p.pieceId === piece.id);
  if (!existante) return [...liste, pieceDeLInventaire(piece)];
  return liste.map((p) => (p === existante ? { ...p, qte: String((parseInt(p.qte) || 0) + 1) } : p));
}
const ligneDuFormulaire = (p) => ({ id: p.id, nom: p.nom, prixEstime: String(p.prixEstime), qte: String(p.qte), pieceId: p.pieceId || null });

export default function SoumissionForm({ clientsExistants, inventaire = [], tauxHoraireClient, tpsTaux, tvqTaux, tpsNumero = "", tvqNumero = "", soumissionExistante, vientDEtreCreee }) {
  const router = useRouter();
  const clientDejaLie = soumissionExistante?.client
    ? clientsExistants.find((c) => c.id === soumissionExistante.client.id) || soumissionExistante.client
    : null;

  const [clientSelectionne, setClientSelectionne] = useState(clientDejaLie);
  // Nom du client sur cette soumission seulement (corrigé au besoin) — le
  // dossier, le véhicule et le reste ne changent pas
  const [nomSurSoumission, setNomSurSoumission] = useState(clientDejaLie ? (soumissionExistante.clientNom || clientDejaLie.nom) : "");
  const [editionNom, setEditionNom] = useState(false);
  const [nomEnEdition, setNomEnEdition] = useState("");
  const [rechercheClient, setRechercheClient] = useState(soumissionExistante?.clientNom || "");
  const [afficherSuggestions, setAfficherSuggestions] = useState(false);
  const boiteRef = useRef(null);

  const [clientNom, setClientNom] = useState(soumissionExistante?.clientNom || "");
  const [clientTelephone, setClientTelephone] = useState(soumissionExistante?.clientTelephone || "");
  // Adresse complète d'un nouveau client, comme sur un bon (versée à son
  // dossier si la soumission devient un bon)
  const [clientAdresse, setClientAdresse] = useState(soumissionExistante?.clientAdresse || "");
  const [clientVille, setClientVille] = useState(soumissionExistante?.clientVille || "");
  const [clientProvince, setClientProvince] = useState(soumissionExistante?.clientProvince || PROVINCE_DEFAUT);
  const [clientCodePostal, setClientCodePostal] = useState(soumissionExistante?.clientCodePostal || "");
  const remplirAdresse = remplisseurAdresse({ ville: clientVille, setAdresse: setClientAdresse, setVille: setClientVille, setProvince: setClientProvince, setCodePostal: setClientCodePostal });
  // Véhicule, comme sur un bon : un véhicule du dossier du client (son id),
  // "nouveau" (formulaire, versé au dossier si la soumission devient un bon)
  // ou "" (non précisé)
  const [choixVehicule, setChoixVehicule] = useState(() => {
    if (!soumissionExistante) return "nouveau";
    if (soumissionExistante.vehiculeId && clientDejaLie?.vehicules?.some((v) => v.id === soumissionExistante.vehiculeId)) return soumissionExistante.vehiculeId;
    return soumissionExistante.vehiculeDetails || !clientDejaLie?.vehicules?.length ? "nouveau" : "";
  });
  const [vehicule, setVehicule] = useState(() =>
    soumissionExistante?.vehiculeDetails ? valeursFormulaireVehicule(soumissionExistante.vehiculeDetails) : VEHICULE_VIDE);
  const [taches, setTaches] = useState(
    soumissionExistante
      ? soumissionExistante.taches.map((t) => ({
          id: t.id,
          description: t.description,
          tempsEstime: String(t.tempsEstime),
          pieces: t.pieces.map(ligneDuFormulaire),
        }))
      : [nouvelleTache()]
  );
  // Pièces de la section du haut (PIECES_EN_HAUT) : toutes celles de la soumission
  const [piecesHaut, setPiecesHaut] = useState(() =>
    (soumissionExistante?.taches || []).flatMap((t) => t.pieces.map(ligneDuFormulaire)));
  const [erreur, setErreur] = useState("");
  const [confirmation, setConfirmation] = useState(vientDEtreCreee ? "✓ Soumission créée." : "");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    function surClicExterieur(e) {
      if (boiteRef.current && !boiteRef.current.contains(e.target)) setAfficherSuggestions(false);
    }
    document.addEventListener("mousedown", surClicExterieur);
    return () => document.removeEventListener("mousedown", surClicExterieur);
  }, []);

  const suggestions = useMemo(() => {
    const q = rechercheClient.trim().toLowerCase();
    if (!q) return [];
    return clientsExistants.filter((c) => correspondRecherche(q, c.nom)).slice(0, 6);
  }, [rechercheClient, clientsExistants]);

  function validerNom() {
    const nouveau = nomEnEdition.trim() || clientSelectionne.nom;
    if (nouveau !== nomSurSoumission) {
      const message = nouveau !== clientSelectionne.nom
        ? `Êtes-vous certain de changer le nom du client pour « ${nouveau} » ?\n\nSeulement sur cette soumission (et sa facture) : le dossier du client (${clientSelectionne.nom}), le véhicule et le reste ne changent pas.`
        : `Êtes-vous certain de remettre le nom du dossier (« ${clientSelectionne.nom} ») ?`;
      if (!window.confirm(message)) return;
      setNomSurSoumission(nouveau);
    }
    setEditionNom(false);
  }

  function choisirClient(c) {
    setClientSelectionne(c);
    setNomSurSoumission(c.nom);
    setEditionNom(false);
    setRechercheClient(c.nom);
    setClientTelephone(c.telephone || "");
    setAfficherSuggestions(false);
    const vehicules = c.vehicules || [];
    setChoixVehicule(vehicules.length === 1 ? vehicules[0].id : vehicules.length ? "" : "nouveau");
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

  function majTache(id, champ, valeur) {
    setTaches((prev) => prev.map((t) => (t.id === id ? { ...t, [champ]: valeur } : t)));
  }
  function ajouterTache() {
    setTaches((prev) => [...prev, nouvelleTache()]);
  }
  function supprimerTache(id) {
    setTaches((prev) => prev.filter((t) => t.id !== id));
  }
  function majPieceHaut(pieceId, champ, valeur) {
    setPiecesHaut((prev) => prev.map((p) => (p.id === pieceId ? { ...p, [champ]: valeur } : p)));
  }
  function ajouterPiece(tacheId) {
    setTaches((prev) => prev.map((t) => (t.id === tacheId ? { ...t, pieces: [...t.pieces, nouvellePiece()] } : t)));
  }
  function ajouterPieceInventaire(tacheId, piece) {
    setTaches((prev) => prev.map((t) => (t.id === tacheId ? { ...t, pieces: ajouterDeLInventaire(t.pieces, piece) } : t)));
  }
  function majPiece(tacheId, pieceId, champ, valeur) {
    setTaches((prev) => prev.map((t) =>
      t.id !== tacheId ? t : { ...t, pieces: t.pieces.map((p) => (p.id === pieceId ? { ...p, [champ]: valeur } : p)) }
    ));
  }
  function supprimerPiece(tacheId, pieceId) {
    setTaches((prev) => prev.map((t) =>
      t.id !== tacheId ? t : { ...t, pieces: t.pieces.filter((p) => p.id !== pieceId) }
    ));
  }

  const totalTemps = taches.reduce((s, t) => s + (Number(t.tempsEstime) || 0), 0);
  const totalMainOeuvre = totalTemps * tauxHoraireClient;
  const montantPieces = (liste) => liste.reduce((s, p) => s + (Number(p.prixEstime) || 0) * (Number(p.qte) || 0), 0);
  const totalPieces = PIECES_EN_HAUT ? montantPieces(piecesHaut) : taches.reduce((s, t) => s + montantPieces(t.pieces), 0);
  const totalEstime = totalMainOeuvre + totalPieces;
  // Taxes comme sur une facture
  const tpsMontant = totalEstime * (tpsTaux / 100);
  const tvqMontant = totalEstime * (tvqTaux / 100);
  const totalAvecTaxes = totalEstime + tpsMontant + tvqMontant;

  async function creer(e) {
    e.preventDefault();
    setErreur("");
    setConfirmation("");

    const tachesValides = taches.filter((t) => t.description.trim());
    const nomFinal = clientSelectionne ? (nomSurSoumission.trim() || clientSelectionne.nom) : clientNom;
    if (!nomFinal.trim() || tachesValides.length === 0) {
      setErreur("Indique le nom du client et au moins une tâche.");
      return;
    }

    setEnCours(true);
    const url = soumissionExistante ? `/api/soumissions/${soumissionExistante.id}` : "/api/soumissions";
    const method = soumissionExistante ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: clientSelectionne?.id,
        clientNom: nomFinal, clientTelephone,
        clientAdresse, clientVille, clientProvince, clientCodePostal,
        vehiculeId: choixVehicule !== "nouveau" ? choixVehicule || null : null,
        vehicule: choixVehicule === "nouveau" ? vehicule : null,
        taches: tachesValides.map((t, i) => ({
          description: t.description,
          tempsEstime: t.tempsEstime,
          // Pièces du haut : rattachées à la première tâche, comme sur le bon
          pieces: (PIECES_EN_HAUT ? (i === 0 ? piecesHaut : []) : t.pieces)
            .filter((p) => p.nom.trim()).map((p) => ({ nom: p.nom, prixEstime: p.prixEstime, qte: p.qte, pieceId: p.pieceId || null })),
        })),
      }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de l'enregistrement.");
      return;
    }
    // On reste sur la soumission (l'impression se fait avec son bouton)
    if (soumissionExistante) {
      setConfirmation("✓ Modifications enregistrées.");
      router.refresh();
    } else {
      router.replace(`/secretaire/operations/soumissions/${(await res.json()).id}/modifier?creee=1`);
    }
  }

  return (
    <form onSubmit={creer} className="conteneur-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Link href="/secretaire/operations/soumissions" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour aux soumissions</Link>
        {soumissionExistante && (
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <BoutonEnvoiCourriel url={`/api/soumissions/${soumissionExistante.id}/envoyer`} courrielDefaut={soumissionExistante.client?.courriel} libelle="📧 Envoyer par courriel" style={{ fontSize: 12, border: "none", padding: 0, color: "var(--accent)" }} />
            <Link href={`/secretaire/operations/soumissions/${soumissionExistante.id}/imprimer`} target="_blank" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>🖨️ Imprimer</Link>
          </div>
        )}
      </div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{soumissionExistante ? "Modifier la soumission" : "Nouvelle soumission"}</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
        {soumissionExistante ? `#${soumissionExistante.numero}` : "Un estimé à donner au client avant de commencer les travaux."}
      </p>

      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>Client</div>

      {clientSelectionne ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 8, padding: 10, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editionNom ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  value={nomEnEdition} onChange={(e) => setNomEnEdition(e.target.value)} autoFocus placeholder={clientSelectionne.nom}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); validerNom(); } if (e.key === "Escape") setEditionNom(false); }}
                  style={{ ...champInput, marginBottom: 0, flex: 1, minWidth: 140, fontWeight: 600 }}
                />
                <button type="button" onClick={validerNom} style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>OK</button>
                <button type="button" onClick={() => setEditionNom(false)} style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>Annuler</button>
              </div>
            ) : (
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {nomSurSoumission || clientSelectionne.nom}
                <button type="button" onClick={() => { setNomEnEdition(nomSurSoumission || clientSelectionne.nom); setEditionNom(true); }} style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  ✏️ Modifier le nom
                </button>
              </div>
            )}
            {nomSurSoumission && nomSurSoumission !== clientSelectionne.nom && !editionNom && (
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Nom sur cette soumission seulement — dossier : {clientSelectionne.nom}</div>
            )}
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {[clientSelectionne.telephone, clientSelectionne.ville].filter(Boolean).join(" · ") || "Client existant"}
              {clientSelectionne.garantieProlongee && <> · 🛡️ Garantie #{clientSelectionne.garantieProlongee}</>}
            </div>
          </div>
          <button type="button" onClick={changerClientPourNouveau} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
            Changer de client
          </button>
        </div>
      ) : (
        <div ref={boiteRef} style={{ position: "relative" }}>
          <label style={labelStyle}>Nom du client</label>
          <input
            required
            value={rechercheClient}
            onChange={(e) => { setRechercheClient(e.target.value); setClientNom(e.target.value); setAfficherSuggestions(true); }}
            onFocus={() => setAfficherSuggestions(true)}
            placeholder="Nom du client — recherche ou nouveau"
            style={champInput}
          />
          {afficherSuggestions && suggestions.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, zIndex: 10, marginTop: -4, overflow: "hidden" }}>
              {suggestions.map((c) => (
                <button
                  key={c.id} type="button" onClick={() => choisirClient(c)}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", background: "none", border: "none", borderBottom: "1px solid var(--border)", color: "var(--text)", fontSize: 13, cursor: "pointer" }}
                >
                  <div style={{ fontWeight: 600 }}>{c.nom}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{[c.telephone, c.ville].filter(Boolean).join(" · ")}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!clientSelectionne && (
        <>
          <label style={labelStyle}>Téléphone</label>
          <input value={clientTelephone} type="tel" onChange={(e) => setClientTelephone(e.target.value)} onBlur={(e) => setClientTelephone(formaterTelephone(e.target.value))} style={champInput} />
          <label style={labelStyle}>Adresse</label>
          <ChampAdresse valeur={clientAdresse} onChange={setClientAdresse} onChoisir={remplirAdresse.onChoisir} style={champInput} />
          <label style={labelStyle}>Ville</label>
          <ChampVille valeur={clientVille} onChange={setClientVille} codePostal={clientCodePostal} style={champInput} />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Province</label>
              <SelectProvince valeur={clientProvince} onChange={setClientProvince} style={champInput} />
            </div>
            <div style={{ width: 110 }}>
              <label style={labelStyle}>Code postal</label>
              <ChampCodePostal valeur={clientCodePostal} onChange={setClientCodePostal} onSecteur={remplirAdresse.onSecteur} style={champInput} />
            </div>
          </div>
        </>
      )}

      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginTop: 14, marginBottom: 4 }}>Véhicule</div>
      <ChoixVehiculeClient
        key={clientSelectionne?.id || "nouveau-client"}
        vehicules={clientSelectionne?.vehicules || []}
        choix={choixVehicule} onChoix={setChoixVehicule}
        vehicule={vehicule} onVehicule={setVehicule}
        onVehiculeModifie={(data) => setClientSelectionne((c) => ({ ...c, vehicules: c.vehicules.map((v) => (v.id === data.id ? data : v)) }))}
        libelleNouveau="+ Autre véhicule (ajouté au dossier du client si la soumission est acceptée)"
      />
      {PIECES_EN_HAUT && (
        <>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginTop: 16, marginBottom: 8 }}>Pièces de la soumission</div>
          <div className="carte carte-s">
            {piecesHaut.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 }}>
                {piecesHaut.map((p) => (
                  <LignePiece key={p.id} piece={p} inventaire={inventaire} onChange={(champ, valeur) => majPieceHaut(p.id, champ, valeur)} onSupprimer={() => setPiecesHaut((prev) => prev.filter((x) => x.id !== p.id))} />
                ))}
              </div>
            )}
            <AjoutPieces
              inventaire={inventaire}
              onAjouterLibre={() => setPiecesHaut((prev) => [...prev, nouvellePiece()])}
              onAjouterInventaire={(piece) => setPiecesHaut((prev) => ajouterDeLInventaire(prev, piece))}
            />
          </div>
        </>
      )}

      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginTop: 16, marginBottom: 8 }}>Tâches estimées</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {taches.map((t, idx) => (
          <div key={t.id} className="carte carte-s">
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input
                placeholder={`Tâche ${idx + 1} — ex : Remplacement plaquettes de frein`}
                value={t.description}
                onChange={(e) => majTache(t.id, "description", e.target.value)}
                style={{ ...champInput, marginBottom: 0, flex: 1 }}
              />
              {taches.length > 1 && (
                <button type="button" onClick={() => supprimerTache(t.id)} style={boutonTexte}>✕</button>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Temps estimé :</span>
              <input
                type="number" min={0} step="0.25"
                value={t.tempsEstime}
                onChange={(e) => majTache(t.id, "tempsEstime", e.target.value)}
                style={{ ...champInput, marginBottom: 0, width: 70, textAlign: "center" }}
              />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                h {t.tempsEstime ? `≈ ${(Number(t.tempsEstime) * tauxHoraireClient).toFixed(2)} $` : ""}
              </span>
            </div>

            {!PIECES_EN_HAUT && (
              <>
                {t.pieces.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 }}>
                    {t.pieces.map((p) => (
                      <LignePiece key={p.id} piece={p} inventaire={inventaire} onChange={(champ, valeur) => majPiece(t.id, p.id, champ, valeur)} onSupprimer={() => supprimerPiece(t.id, p.id)} />
                    ))}
                  </div>
                )}
                <AjoutPieces
                  inventaire={inventaire}
                  onAjouterLibre={() => ajouterPiece(t.id)}
                  onAjouterInventaire={(piece) => ajouterPieceInventaire(t.id, piece)}
                />
              </>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={ajouterTache} style={{ ...boutonAjoutLigne, marginTop: 10 }}>
        + Ajouter une autre tâche
      </button>

      <div style={{ marginTop: 16, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span style={{ color: "var(--text-muted)" }}>Main-d'œuvre ({totalTemps}h × {tauxHoraireClient.toFixed(2)} $)</span>
          <span style={{ fontWeight: 600 }}>{totalMainOeuvre.toFixed(2)} $</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span style={{ color: "var(--text-muted)" }}>Pièces estimées</span>
          <span style={{ fontWeight: 600 }}>{totalPieces.toFixed(2)} $</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border)" }}>
          <span>Sous-total</span>
          <span>{totalEstime.toFixed(2)} $</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ color: "var(--text-muted)" }}>TPS ({tpsTaux}%){tpsNumero && <span style={{ fontSize: 10 }}> · n° {tpsNumero}</span>}</span>
          <span>{tpsMontant.toFixed(2)} $</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ color: "var(--text-muted)" }}>TVQ ({tvqTaux}%){tvqNumero && <span style={{ fontSize: 10 }}> · n° {tvqNumero}</span>}</span>
          <span>{tvqMontant.toFixed(2)} $</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border)" }}>
          <span>Total estimé (taxes incl.)</span>
          <span style={{ color: "var(--accent)" }}>{totalAvecTaxes.toFixed(2)} $</span>
        </div>
      </div>

      {erreur && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{erreur}</p>}
      {confirmation && <p style={{ color: "var(--success)", fontSize: 13, marginTop: 10 }}>{confirmation}</p>}

      <button
        type="submit" disabled={enCours}
        style={{ width: "100%", marginTop: 16, padding: 12, borderRadius: 8, border: "none", background: "var(--accent)", color: "#17150f", fontWeight: 700, cursor: "pointer" }}
      >
        {enCours ? "Enregistrement…" : soumissionExistante ? "Sauvegarder les modifications" : "Créer la soumission"}
      </button>
    </form>
  );
}

// « 3 en stock », ou pour un kit : combien le stock permet d'en faire
function libelleStock(p) {
  if (!p.estKit) return `${p.qte} en stock`;
  return p.qte >= 999 ? "kit" : `kit · ${p.qte} possible${p.qte > 1 ? "s" : ""}`;
}

function LignePiece({ piece: p, inventaire, onChange, onSupprimer }) {
  // Pièce de l'inventaire : son nom vient de la fiche ; le stock affiché
  // n'est qu'indicatif — rien n'est réservé ni déduit avant le transfert
  const fiche = p.pieceId ? inventaire.find((x) => x.id === p.pieceId) : null;
  const qte = parseInt(p.qte) || 0;
  const manque = fiche && !CLIENT.stockNegatifBons && qte > fiche.qte;
  return (
    <div>
      <div style={{ display: "flex", gap: 6 }}>
        {p.pieceId ? (
          <div title="Pièce de l'inventaire — déduite du stock seulement quand la soumission devient un bon ou une facture" style={{ ...champInput, marginBottom: 0, flex: 1, fontSize: 12, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            📦 {p.nom}
          </div>
        ) : (
          <input placeholder="Pièce" value={p.nom} onChange={(e) => onChange("nom", e.target.value)} style={{ ...champInput, marginBottom: 0, flex: 1, fontSize: 12 }} />
        )}
        <input type="number" min={0} placeholder="Qté" value={p.qte} onChange={(e) => onChange("qte", e.target.value)} style={{ ...champInput, marginBottom: 0, width: 50, fontSize: 12, textAlign: "center" }} />
        <input type="number" min={0} step="0.01" placeholder="Prix $" value={p.prixEstime} onChange={(e) => onChange("prixEstime", e.target.value)} style={{ ...champInput, marginBottom: 0, width: 70, fontSize: 12 }} />
        <button type="button" onClick={onSupprimer} style={boutonTexte}>✕</button>
      </div>
      {p.pieceId && (
        <div style={{ fontSize: 10.5, color: manque ? "#D9822B" : "var(--text-muted)", margin: "2px 0 0 4px" }}>
          {fiche
            ? <>Inventaire{fiche.numero ? ` · #${fiche.numero}` : ""} · {libelleStock(fiche)}{manque ? " — pas assez pour transférer en ce moment" : ""} · déduite au transfert en bon ou en facture</>
            : "Inventaire · pièce désactivée ou retirée — elle ne pourra pas sortir du stock"}
        </div>
      )}
    </div>
  );
}

// Pièces les plus listées d'un coup dans le choix : l'inventaire peut en
// compter des milliers, la recherche trouve les autres
const MAX_SUGGESTIONS_PIECES = 50;

// Boutons d'ajout d'une pièce : estimée en texte libre, ou choisie dans
// l'inventaire (recherche par nom, numéro ou code-barres)
function AjoutPieces({ inventaire, onAjouterLibre, onAjouterInventaire }) {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const boiteRef = useRef(null);

  useEffect(() => {
    if (!ouvert) return;
    function surClicExterieur(e) {
      if (boiteRef.current && !boiteRef.current.contains(e.target)) setOuvert(false);
    }
    document.addEventListener("mousedown", surClicExterieur);
    return () => document.removeEventListener("mousedown", surClicExterieur);
  }, [ouvert]);

  const suggestions = useMemo(() => {
    const q = recherche.trim();
    return q ? inventaire.filter((p) => pieceCorrespond(p, q)) : inventaire;
  }, [recherche, inventaire]);

  function choisir(piece) {
    onAjouterInventaire(piece);
    setOuvert(false);
    setRecherche("");
  }

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <button type="button" onClick={onAjouterLibre} style={{ ...boutonAjoutLigne, padding: "5px 8px", fontSize: 11, flex: 1 }}>
        + Ajouter une pièce estimée
      </button>
      {inventaire.length > 0 && (
        <div ref={boiteRef} style={{ position: "relative", flex: 1 }}>
          <button type="button" onClick={() => { setOuvert((v) => !v); setRecherche(""); }} style={{ ...boutonAjoutLigne, padding: "5px 8px", fontSize: 11 }}>
            📦 Pièce de l'inventaire
          </button>
          {ouvert && (
            <div style={{ position: "absolute", top: "100%", right: 0, width: "min(340px, calc(100vw - 32px))", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, zIndex: 10, marginTop: 2, overflow: "hidden" }}>
              <div style={{ padding: 6, borderBottom: "1px solid var(--border)" }}>
                <input
                  autoFocus
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setOuvert(false);
                    if (e.key === "Enter") { e.preventDefault(); if (suggestions.length > 0) choisir(suggestions[0]); }
                  }}
                  placeholder="🔍 Rechercher (nom ou numéro)…"
                  style={{ ...champInput, marginBottom: 0, fontSize: 12, padding: "6px 8px" }}
                />
                <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 4 }}>
                  Le stock n'est pas touché : la pièce sera déduite quand la soumission deviendra un bon ou une facture.
                </div>
              </div>
              <div style={{ maxHeight: 260, overflowY: "auto" }}>
                {suggestions.length === 0 ? (
                  <div style={{ padding: "8px 10px", fontSize: 12, color: "var(--text-muted)" }}>Aucune pièce trouvée</div>
                ) : suggestions.slice(0, MAX_SUGGESTIONS_PIECES).map((p) => (
                  <button
                    key={p.id} type="button" onClick={() => choisir(p)}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", background: "none", border: "none", borderBottom: "1px solid var(--border)", color: "var(--text)", fontSize: 12, cursor: "pointer" }}
                  >
                    {p.nom} — <span style={p.qte <= 0 ? { color: "#D9822B" } : undefined}>{libelleStock(p)}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.numero ? ` · #${p.numero}` : ""} · {Number(p.prix || 0).toFixed(2)} $</span>
                  </button>
                ))}
                {suggestions.length > MAX_SUGGESTIONS_PIECES && (
                  <div style={{ padding: "8px 10px", fontSize: 11.5, color: "var(--text-muted)" }}>
                    … et {suggestions.length - MAX_SUGGESTIONS_PIECES} autres — tape un nom ou un numéro pour préciser.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4, marginTop: 10 };
const champInput = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
const boutonTexte = { background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 };
const boutonAjoutLigne = {
  background: "none", border: "1px dashed var(--border)", color: "var(--accent)", fontSize: 12,
  padding: "6px 10px", borderRadius: 8, cursor: "pointer", width: "100%",
};
