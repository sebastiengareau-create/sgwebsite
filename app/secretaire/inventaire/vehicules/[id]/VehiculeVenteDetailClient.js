"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TitreSection, LigneInfo } from "../../../../components/ui";
import ChampsVehicule from "../../../../components/ChampsVehicule";
import SelecteurCompteMode, { compteParDefaut } from "../../../../components/SelecteurCompteMode";
import { ChampsFiche } from "../VehiculesVenteClient";
import { libelleVehicule, descriptionVehicule } from "@/lib/vehicules";
import { LABEL_MODE_PAIEMENT } from "@/lib/modesPaiement";

const argent = (n) => `${(n || 0).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const dateFr = (d) => (d ? new Date(d).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" }) : "");
const versChamp = (n) => (n ? String(n) : "");

async function appeler(url, method, body) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export default function VehiculeVenteDetailClient({ vv, coutant, clients, comptesTresorerie, tpsTaux, tvqTaux, peutCreerBon, estGerant }) {
  const router = useRouter();
  const vente = vv.factureVente;
  const [modeEdition, setModeEdition] = useState(false);
  const [erreur, setErreur] = useState("");
  const [avertissement, setAvertissement] = useState("");

  const prix = vente ? vente.prixVente : vv.prixDemande;
  const profit = prix - coutant;
  const margePct = prix > 0 ? (profit / prix) * 100 : 0;
  const bonsOuverts = vv.bons.filter((b) => !b.facture);

  async function supprimer() {
    if (!window.confirm(`Supprimer la fiche ${vv.numero} ? À faire seulement pour une fiche entrée par erreur.`)) return;
    const { ok, data } = await appeler(`/api/vehicules-a-vendre/${vv.id}`, "DELETE");
    if (!ok) return setErreur(data.erreur || "Erreur.");
    router.push("/secretaire/inventaire/vehicules");
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <Link href="/secretaire/inventaire/vehicules" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Véhicules à vendre</Link>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace" }}>{vv.numero}</span>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, color: "#17150f", background: vente ? "#6FA96B" : "#C9A227" }}>
          {vente ? "Vendu" : "En stock"}
        </span>
      </div>
      <h1 style={{ fontSize: 20, margin: "4px 0 2px" }}>{libelleVehicule(vv.vehicule) || "Véhicule"}</h1>
      {(vv.vehicule.niv || vv.vehicule.plaque) && (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{descriptionVehicule(vv.vehicule)}</div>
      )}
      <div style={{ marginBottom: 14 }} />

      {erreur && <p style={{ color: "var(--danger)", fontSize: 12 }}>{erreur}</p>}
      {avertissement && <p style={{ color: "var(--accent)", fontSize: 12 }}>⚠️ {avertissement}</p>}

      <div className="carte carte-m" style={{ marginBottom: 14 }}>
        <TitreSection>💰 Coûtant et profit</TitreSection>
        <Ligne label={`Coûtant d'achat${vv.dateAchat ? ` (${dateFr(vv.dateAchat)})` : ""}`} valeur={argent(vv.coutantAchat)} />
        {vv.bons.map((b) => (
          <Ligne
            key={b.id}
            label={<Link href={`/bons/${b.id}`} style={{ color: "var(--accent)", textDecoration: "none" }}>Bon #{b.numero}{b.problemes[0] ? ` — ${b.problemes[0].description}` : ""}</Link>}
            valeur={b.facture ? argent(b.facture.totalFacture) : <span style={{ color: "#C9A227" }}>à facturer</span>}
          />
        ))}
        <Ligne label={vente ? "Coûtant total (figé à la vente)" : "Coûtant total"} valeur={argent(coutant)} gras bordure />
        <Ligne label={vente ? `Vendu (facture ${vente.numero}, avant taxes)` : "Prix demandé"} valeur={argent(prix)} />
        {prix > 0 && (
          <Ligne
            label={`${vente ? "Profit réel" : "Profit prévu"} (${margePct.toFixed(0)} % du prix)`}
            valeur={<span style={{ color: profit >= 0 ? "var(--success)" : "var(--danger)" }}>{argent(profit)}</span>}
            gras
          />
        )}
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "8px 0 0" }}>
          Chaque bon relié est facturé sans taxes ; sa facture est payée en ajoutant son montant au coûtant du véhicule.
        </p>
      </div>

      {!vente && peutCreerBon && <NouveauBon vv={vv} />}

      {modeEdition ? (
        <EditionFiche vv={vv} vendu={!!vente} onFermer={() => setModeEdition(false)} />
      ) : (
        <div className="carte carte-m" style={{ marginBottom: 14 }}>
          <TitreSection>📋 Fiche</TitreSection>
          <LigneInfo label="Kilométrage" valeur={vv.kilometrage != null ? `${vv.kilometrage.toLocaleString("fr-CA")} km` : ""} />
          <LigneInfo label="Acheté de" valeur={vv.provenance} />
          <LigneInfo label="Date d'achat" valeur={dateFr(vv.dateAchat)} />
          {vv.description && <p style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{vv.description}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => setModeEdition(true)} className="bouton-3d-sombre" style={{ flex: 1, padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 700 }}>✏️ Modifier</button>
            {!vente && vv.bons.length === 0 && (
              <button onClick={supprimer} style={{ padding: "9px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "var(--danger)", background: "none", border: "1px solid var(--border)", cursor: "pointer" }}>🗑️</button>
            )}
          </div>
        </div>
      )}

      {vente ? (
        <FactureVente vv={vv} comptesTresorerie={comptesTresorerie} estGerant={estGerant} setErreur={setErreur} setAvertissement={setAvertissement} />
      ) : (
        <Vendre vv={vv} clients={clients} comptesTresorerie={comptesTresorerie} tpsTaux={tpsTaux} tvqTaux={tvqTaux} bonsOuverts={bonsOuverts} setAvertissement={setAvertissement} />
      )}
    </div>
  );
}

function Ligne({ label, valeur, gras, bordure }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, padding: "3px 0", fontWeight: gras ? 700 : 400, borderTop: bordure ? "1px solid var(--border)" : "none", marginTop: bordure ? 4 : 0, paddingTop: bordure ? 7 : 3 }}>
      <span style={{ color: gras ? "var(--text)" : "var(--text-muted)", minWidth: 0 }}>{label}</span>
      <span style={{ flexShrink: 0 }}>{valeur}</span>
    </div>
  );
}

function NouveauBon({ vv }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [taches, setTaches] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  async function creer() {
    setErreur("");
    setEnCours(true);
    const { ok, data } = await appeler(`/api/vehicules-a-vendre/${vv.id}/bons`, "POST", { problemes: taches.split("\n") });
    setEnCours(false);
    if (!ok) return setErreur(data.erreur || "Erreur.");
    router.push(`/bons/${data.id}`);
  }

  if (!ouvert) {
    return (
      <button onClick={() => setOuvert(true)} className="bouton-3d" style={{ display: "block", width: "100%", padding: 11, borderRadius: 10, fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
        🔧 Nouveau bon de travail sur ce véhicule
      </button>
    );
  }
  return (
    <div className="carte carte-m" style={{ marginBottom: 14 }}>
      <TitreSection>🔧 Nouveau bon de travail</TitreSection>
      <label style={labelStyle}>Tâches (une par ligne)</label>
      <textarea value={taches} onChange={(e) => setTaches(e.target.value)} rows={4} autoFocus placeholder={"Inspection complète\nRéparer la fuite du toit"} style={{ ...champStyle, resize: "vertical" }} />
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, margin: "0 0 8px" }}>{erreur}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={creer} disabled={enCours || !taches.trim()} className="bouton-3d" style={{ flex: 1, padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 700 }}>{enCours ? "…" : "Créer le bon"}</button>
        <button onClick={() => setOuvert(false)} style={boutonSecondaire}>Annuler</button>
      </div>
    </div>
  );
}

function EditionFiche({ vv, vendu, onFermer }) {
  const router = useRouter();
  const [vehicule, setVehicule] = useState(vv.vehicule);
  const [fiche, setFiche] = useState({
    coutantAchat: versChamp(vv.coutantAchat),
    prixDemande: versChamp(vv.prixDemande),
    dateAchat: vv.dateAchat ? new Date(vv.dateAchat).toISOString().slice(0, 10) : "",
    provenance: vv.provenance || "",
    kilometrage: vv.kilometrage != null ? String(vv.kilometrage) : "",
    description: vv.description || "",
  });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const maj = (champ) => (e) => setFiche((f) => ({ ...f, [champ]: e.target.value }));

  async function sauvegarder() {
    setErreur("");
    setEnCours(true);
    // Vendu : le véhicule et le coûtant sont figés par la facture de vente
    const body = vendu
      ? { prixDemande: fiche.prixDemande, kilometrage: fiche.kilometrage, description: fiche.description }
      : { ...fiche, vehicule };
    const { ok, data } = await appeler(`/api/vehicules-a-vendre/${vv.id}`, "PATCH", body);
    setEnCours(false);
    if (!ok) return setErreur(data.erreur || "Erreur.");
    onFermer();
    router.refresh();
  }

  return (
    <div className="carte carte-m" style={{ marginBottom: 14 }}>
      <TitreSection>✏️ Modifier la fiche</TitreSection>
      {!vendu && <ChampsVehicule valeur={vehicule} onChange={setVehicule} />}
      <ChampsFiche fiche={fiche} maj={maj} coutantModifiable={!vendu} />
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, margin: "0 0 8px" }}>{erreur}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={sauvegarder} disabled={enCours} className="bouton-3d" style={{ flex: 1, padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 700 }}>{enCours ? "…" : "Enregistrer"}</button>
        <button onClick={onFermer} style={boutonSecondaire}>Annuler</button>
      </div>
    </div>
  );
}

function Vendre({ vv, clients, comptesTresorerie, tpsTaux, tvqTaux, bonsOuverts, setAvertissement }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [rechercheClient, setRechercheClient] = useState("");
  const [clientId, setClientId] = useState("");
  const [nouveau, setNouveau] = useState({ clientNom: "", clientTelephone: "", clientCourriel: "", clientAdresse: "", clientVille: "", clientCodePostal: "" });
  const [prixVente, setPrixVente] = useState(versChamp(vv.prixDemande));
  const [note, setNote] = useState("");
  const [payee, setPayee] = useState(true);
  const [compteTresorerieId, setCompteTresorerieId] = useState(compteParDefaut(comptesTresorerie));
  const [modePaiement, setModePaiement] = useState("CHEQUE");
  const [reference, setReference] = useState("");
  const [doublon, setDoublon] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const prix = Number(prixVente.replace(",", ".").replace(/\s/g, "")) || 0;
  const tps = Math.round(prix * tpsTaux) / 100;
  const tvq = Math.round(prix * tvqTaux) / 100;
  const q = rechercheClient.trim().toLowerCase();
  const suggestions = q ? clients.filter((c) => c.nom.toLowerCase().includes(q) || c.telephone?.includes(q) || c.numero?.toLowerCase().includes(q)).slice(0, 8) : [];
  const clientChoisi = clients.find((c) => c.id === clientId);

  async function vendre(confirmerDoublon = false) {
    setErreur("");
    setEnCours(true);
    const { ok, data } = await appeler(`/api/vehicules-a-vendre/${vv.id}/vente`, "POST", {
      prixVente, note, confirmerDoublon,
      ...(clientId ? { clientId } : nouveau),
      ...(payee && { payee: true, compteTresorerieId, modePaiement, reference }),
    });
    setEnCours(false);
    if (!ok) {
      setDoublon(!!data.doublonPossible);
      return setErreur(data.erreur || "Erreur.");
    }
    if (data.avertissementComptable) setAvertissement(`Vente enregistrée, mais aucune écriture comptable créée : ${data.avertissementComptable}.`);
    router.refresh();
  }

  if (!ouvert) {
    return (
      <button onClick={() => setOuvert(true)} className="bouton-3d" style={{ display: "block", width: "100%", padding: 11, borderRadius: 10, fontSize: 13, fontWeight: 700, background: "var(--success)", color: "#17150f", border: "none" }}>
        🤝 Vendre ce véhicule
      </button>
    );
  }
  return (
    <div className="carte carte-m" style={{ marginBottom: 14 }}>
      <TitreSection>🤝 Facture de vente</TitreSection>
      {bonsOuverts.length > 0 && (
        <p style={{ fontSize: 12, color: "#C9A227", margin: "0 0 10px" }}>
          ⚠️ {bonsOuverts.length > 1 ? "Des bons ne sont" : "Un bon n'est"} pas encore facturé{bonsOuverts.length > 1 ? "s" : ""} ({bonsOuverts.map((b) => `#${b.numero}`).join(", ")}) : facture-{bonsOuverts.length > 1 ? "les" : "le"} d'abord pour qu'ils comptent dans le coûtant.
        </p>
      )}

      <label style={labelStyle}>Acheteur</label>
      {clientChoisi ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", ...champStyle }}>
          <span>{clientChoisi.nom}{clientChoisi.telephone ? ` · ${clientChoisi.telephone}` : ""}</span>
          <button onClick={() => setClientId("")} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>✕</button>
        </div>
      ) : (
        <>
          <input value={rechercheClient} onChange={(e) => setRechercheClient(e.target.value)} placeholder="🔍 Client existant (nom, téléphone)…" style={champStyle} />
          {suggestions.length > 0 && (
            <div style={{ border: "1px solid var(--border)", borderRadius: 8, marginTop: -4, marginBottom: 8 }}>
              {suggestions.map((c) => (
                <button key={c.id} onClick={() => { setClientId(c.id); setRechercheClient(""); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", background: "none", border: "none", borderBottom: "1px solid var(--border)", color: "var(--text)", fontSize: 12.5, cursor: "pointer" }}>
                  {c.nom}{c.telephone ? ` · ${c.telephone}` : ""}
                </button>
              ))}
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 6px" }}>… ou un nouveau client :</div>
          <input value={nouveau.clientNom} onChange={(e) => setNouveau((n) => ({ ...n, clientNom: e.target.value }))} placeholder="Nom" style={champStyle} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input value={nouveau.clientTelephone} onChange={(e) => setNouveau((n) => ({ ...n, clientTelephone: e.target.value }))} placeholder="Téléphone" style={champStyle} />
            <input value={nouveau.clientCourriel} onChange={(e) => setNouveau((n) => ({ ...n, clientCourriel: e.target.value }))} placeholder="Courriel" style={champStyle} />
          </div>
          <input value={nouveau.clientAdresse} onChange={(e) => setNouveau((n) => ({ ...n, clientAdresse: e.target.value }))} placeholder="Adresse" style={champStyle} />
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
            <input value={nouveau.clientVille} onChange={(e) => setNouveau((n) => ({ ...n, clientVille: e.target.value }))} placeholder="Ville" style={champStyle} />
            <input value={nouveau.clientCodePostal} onChange={(e) => setNouveau((n) => ({ ...n, clientCodePostal: e.target.value }))} placeholder="Code postal" style={champStyle} />
          </div>
        </>
      )}

      <label style={labelStyle}>Prix de vente (avant taxes)</label>
      <input inputMode="decimal" value={prixVente} onChange={(e) => setPrixVente(e.target.value)} style={champStyle} />
      <Ligne label={`TPS (${tpsTaux} %)`} valeur={argent(tps)} />
      <Ligne label={`TVQ (${tvqTaux} %)`} valeur={argent(tvq)} />
      <Ligne label="Total (taxes incluses)" valeur={argent(prix + tps + tvq)} gras bordure />

      <label style={{ ...labelStyle, marginTop: 10 }}>Note sur la facture (garantie, conditions…)</label>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} style={{ ...champStyle, resize: "vertical" }} />

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, margin: "4px 0 8px" }}>
        <input type="checkbox" checked={payee} onChange={(e) => setPayee(e.target.checked)} /> Payée maintenant
      </label>
      {payee && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          <SelecteurCompteMode comptes={comptesTresorerie} compteTresorerieId={compteTresorerieId} setCompteTresorerieId={setCompteTresorerieId} modePaiement={modePaiement} setModePaiement={setModePaiement} />
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="No de chèque ou de transaction (optionnel)" style={{ ...champStyle, marginBottom: 0 }} />
        </div>
      )}

      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, margin: "0 0 8px" }}>{erreur}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => { if (window.confirm(`Émettre la facture de vente de ${argent(prix + tps + tvq)} (taxes incluses) ? Le coûtant du véhicule sera figé.`)) vendre(doublon); }}
          disabled={enCours || prix <= 0 || (!clientId && !nouveau.clientNom.trim())}
          className="bouton-3d" style={{ flex: 1, padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 700 }}
        >
          {enCours ? "…" : doublon ? "Confirmer : c'est un autre client" : "Émettre la facture de vente"}
        </button>
        <button onClick={() => setOuvert(false)} style={boutonSecondaire}>Annuler</button>
      </div>
    </div>
  );
}

function FactureVente({ vv, comptesTresorerie, estGerant, setErreur, setAvertissement }) {
  const router = useRouter();
  const vente = vv.factureVente;
  const [afficherPaiement, setAfficherPaiement] = useState(false);
  const [compteTresorerieId, setCompteTresorerieId] = useState(compteParDefaut(comptesTresorerie));
  const [modePaiement, setModePaiement] = useState("CHEQUE");
  const [reference, setReference] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function changerStatut(statut) {
    setErreur("");
    setEnCours(true);
    const { ok, data } = await appeler(`/api/vehicules-a-vendre/${vv.id}/vente`, "PATCH", { statut, compteTresorerieId, modePaiement, reference });
    setEnCours(false);
    if (!ok) return setErreur(data.erreur || "Erreur.");
    if (data.avertissementComptable) setAvertissement(`Statut mis à jour, mais l'écriture comptable n'a pas suivi : ${data.avertissementComptable}.`);
    setAfficherPaiement(false);
    router.refresh();
  }

  async function annuler() {
    if (!window.confirm(`Annuler la vente ${vente.numero} ? La facture et ses écritures comptables sont retirées définitivement, et le véhicule revient en stock.`)) return;
    setEnCours(true);
    const { ok, data } = await appeler(`/api/vehicules-a-vendre/${vv.id}/vente`, "DELETE");
    setEnCours(false);
    if (!ok) return setErreur(data.erreur || "Erreur.");
    router.refresh();
  }

  return (
    <div className="carte carte-m" style={{ marginBottom: 14 }}>
      <TitreSection>🧾 Facture de vente</TitreSection>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <div style={{ fontFamily: "monospace", fontWeight: 700 }}>#{vente.numero}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{dateFr(vente.dateEmission)} · {vente.client.nom}</div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: vente.statut === "PAYEE" ? "#6FA96B" : "#C9A227" }}>{vente.statut === "PAYEE" ? "Payée" : "Impayée"}</span>
      </div>
      <Ligne label="Prix de vente" valeur={argent(vente.prixVente)} />
      <Ligne label="TPS" valeur={argent(vente.tpsMontant)} />
      <Ligne label="TVQ" valeur={argent(vente.tvqMontant)} />
      <Ligne label="Total (taxes incluses)" valeur={argent(vente.totalAvecTaxes)} gras bordure />
      {vente.statut === "PAYEE" && (
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "6px 0 0" }}>
          Payée le {dateFr(vente.datePaiement)}{vente.modePaiement ? ` — ${LABEL_MODE_PAIEMENT[vente.modePaiement] || vente.modePaiement}` : ""}{vente.compteTresorerie ? ` · ${vente.compteTresorerie.nom}` : ""}{vente.referenceVersement ? ` · réf. ${vente.referenceVersement}` : ""}
        </p>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Link href={`/secretaire/inventaire/vehicules/${vv.id}/facture`} target="_blank" className="bouton-3d-sombre" style={{ flex: 1, textAlign: "center", padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
          🖨️ Imprimer
        </Link>
        {vente.statut === "IMPAYEE" ? (
          !afficherPaiement && <button onClick={() => setAfficherPaiement(true)} style={{ flex: 1, padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 700, background: "var(--success)", color: "#17150f", border: "none", cursor: "pointer" }}>Marquer payée</button>
        ) : (
          <button onClick={() => changerStatut("IMPAYEE")} disabled={enCours} style={{ ...boutonSecondaire, flex: 1 }}>Marquer impayée</button>
        )}
      </div>
      {afficherPaiement && (
        <div style={{ background: "var(--bg)", borderRadius: 8, padding: 10, marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <SelecteurCompteMode comptes={comptesTresorerie} compteTresorerieId={compteTresorerieId} setCompteTresorerieId={setCompteTresorerieId} modePaiement={modePaiement} setModePaiement={setModePaiement} />
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="No de chèque ou de transaction (optionnel)" style={{ ...champStyle, marginBottom: 0 }} />
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => changerStatut("PAYEE")} disabled={enCours || !compteTresorerieId} className="bouton-3d" style={{ flex: 1, padding: 8, borderRadius: 6, fontSize: 12, fontWeight: 700 }}>✓ Confirmer l'encaissement</button>
            <button onClick={() => setAfficherPaiement(false)} style={{ ...boutonSecondaire, flex: 1 }}>Annuler</button>
          </div>
        </div>
      )}
      {estGerant && (
        <button onClick={annuler} disabled={enCours} style={{ width: "100%", marginTop: 10, padding: 9, borderRadius: 8, border: "none", background: "var(--danger)", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
          ↩️ Annuler la vente (le véhicule revient en stock)
        </button>
      )}
    </div>
  );
}

const champStyle = {
  width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
const labelStyle = { display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 3 };
const boutonSecondaire = { padding: "9px 14px", borderRadius: 8, fontSize: 12, background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" };
