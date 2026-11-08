"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icone, TEINTES, CarteChiffre, Pastille, TitrePanneau, BoutonAction, LigneDetail, stylePanneau } from "../../../../components/StyleSection";
import ChampsVehicule from "../../../../components/ChampsVehicule";
import { ChampAdresse, ChampVille, ChampCodePostal, remplisseurAdresse } from "../../../../components/ChampsAdresse";
import SelectProvince from "../../../../components/SelectProvince";
import { PROVINCE_DEFAUT } from "@/lib/adresse";
import SelecteurCompteMode, { compteParDefaut } from "../../../../components/SelecteurCompteMode";
import { ChampsFiche } from "../VehiculesVenteClient";
import { libelleVehicule } from "@/lib/vehicules";
import { LABEL_MODE_PAIEMENT } from "@/lib/modesPaiement";
import { correspondRecherche } from "@/lib/recherche";
import { argent, nombre } from "@/lib/format";

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

  const [formulaire, setFormulaire] = useState(null); // null | "bon" | "vendre"
  const couleurProfil = vente ? "var(--success)" : "var(--accent)";
  const actions = !vente ? [
    peutCreerBon && { cle: "bon", icone: "outils", label: "Nouveau bon de travail" },
    { cle: "vendre", icone: "crochet", label: "Vendre ce véhicule", vert: true },
  ].filter(Boolean) : [];

  return (
    <div className="conteneur-page">
      <Link href="/secretaire/inventaire/vehicules" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour aux véhicules à vendre</Link>

      {/* Carte du véhicule */}
      <div style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: "20px 20px 20px 24px", marginTop: 10, marginBottom: 14 }}>
        <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, background: couleurProfil }} />
        <span style={{ position: "absolute", right: -40, top: -40, width: 150, height: 150, borderRadius: "50%", background: couleurProfil, opacity: 0.08 }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: vente ? TEINTES.vert.fond : TEINTES.ambre.fond, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icone nom="vehicule" taille={28} couleur={vente ? TEINTES.vert.couleur : TEINTES.ambre.couleur} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.01em" }}>{libelleVehicule(vv.vehicule) || "Véhicule"}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2, overflowWrap: "anywhere" }}>
              <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{vv.numero}</span>
              {vv.vehicule.plaque && <> · Plaque {vv.vehicule.plaque}</>}
              {vv.vehicule.niv && <> · NIV {vv.vehicule.niv}</>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {vente
                ? <Pastille couleur="var(--success)" fond="var(--success-fond)">Vendu</Pastille>
                : <Pastille couleur={TEINTES.ambre.couleur} fond={TEINTES.ambre.fond}>En stock</Pastille>}
              {vv.kilometrage != null && <Pastille couleur={TEINTES.bleu.couleur} fond={TEINTES.bleu.fond}>{vv.kilometrage.toLocaleString("fr-CA")} km</Pastille>}
              {bonsOuverts.length > 0 && <Pastille couleur="var(--avertissement)" fond="var(--avertissement-fond)">{bonsOuverts.length} bon{bonsOuverts.length > 1 ? "s" : ""} à facturer</Pastille>}
            </div>
          </div>
        </div>
      </div>

      {erreur && <p style={{ color: "var(--danger)", fontSize: 12.5, fontWeight: 700 }}>{erreur}</p>}
      {avertissement && <p style={{ color: "var(--accent-ombre)", fontSize: 12.5 }}>⚠️ {avertissement}</p>}

      <div className="grille-trois" style={{ marginBottom: 20 }}>
        <CarteChiffre titre={vente ? "Coûtant (figé)" : "Coûtant total"} montant={argent(coutant)} teinte="var(--bleu)" note={`Achat ${argent(vv.coutantAchat)} + ${vv.bons.length} bon${vv.bons.length !== 1 ? "s" : ""}`} />
        <CarteChiffre titre={vente ? "Vendu" : "Prix demandé"} montant={argent(prix)} teinte="var(--accent)" note={vente ? `Facture ${vente.numero}, avant taxes` : "Avant taxes"} />
        <CarteChiffre
          titre={vente ? "Profit réel" : "Profit prévu"} montant={argent(profit)}
          couleur={profit >= 0 ? "var(--success)" : "var(--danger)"} teinte={profit >= 0 ? "var(--success)" : "var(--danger)"}
          note={prix > 0 ? `${nombre(margePct, 0)} % du prix` : "Aucun prix saisi"}
        />
      </div>

      {actions.length > 0 && formulaire === null && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${actions.length}, 1fr)`, gap: 8, marginBottom: 16 }}>
          {actions.map((a) => (
            <BoutonAction
              key={a.cle} icone={a.icone} onClick={() => setFormulaire(a.cle)}
              couleur={a.vert ? "#fff" : "var(--accent-ombre)"} fond={a.vert ? "var(--success)" : "var(--surface)"} bordure={a.vert ? "var(--success)" : "var(--accent)"}
            >
              {a.label}
            </BoutonAction>
          ))}
        </div>
      )}
      {!vente && formulaire === "bon" && <NouveauBon vv={vv} onFermer={() => setFormulaire(null)} />}
      {!vente && formulaire === "vendre" && (
        <Vendre vv={vv} clients={clients} comptesTresorerie={comptesTresorerie} tpsTaux={tpsTaux} tvqTaux={tvqTaux} bonsOuverts={bonsOuverts} setAvertissement={setAvertissement} onFermer={() => setFormulaire(null)} />
      )}

      {vente && <FactureVente vv={vv} comptesTresorerie={comptesTresorerie} estGerant={estGerant} setErreur={setErreur} setAvertissement={setAvertissement} />}

      <div style={stylePanneau}>
        <TitrePanneau icone="calculatrice" teinte={TEINTES.bleu} titre="Coûtant et profit" sousTitre="Chaque bon relié est facturé sans taxes ; sa facture est payée en ajoutant son montant au coûtant du véhicule." />
        <Ligne premiere label={`Coûtant d'achat${vv.dateAchat ? ` (${dateFr(vv.dateAchat)})` : ""}`} valeur={argent(vv.coutantAchat)} />
        {vv.bons.map((b) => (
          <Ligne
            key={b.id}
            label={<Link href={`/bons/${b.id}`} style={{ color: "var(--text)", fontWeight: 700, textDecoration: "none" }}>Bon #{b.numero}{b.problemes[0] ? <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> — {b.problemes[0].description}</span> : ""}</Link>}
            valeur={b.facture ? argent(b.facture.totalFacture) : <Pastille couleur="var(--avertissement)" fond="var(--avertissement-fond)">À facturer</Pastille>}
          />
        ))}
        <Ligne label={vente ? "Coûtant total (figé à la vente)" : "Coûtant total"} valeur={argent(coutant)} gras />
        <Ligne label={vente ? `Vendu (facture ${vente.numero}, avant taxes)` : "Prix demandé"} valeur={argent(prix)} />
        {prix > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: profit >= 0 ? "var(--success-fond)" : "var(--danger-fond)", marginTop: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: profit >= 0 ? "var(--success)" : "var(--danger)" }}>{vente ? "Profit réel" : "Profit prévu"}</span>
            <span style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: profit >= 0 ? "var(--success)" : "var(--danger)" }}>{argent(profit)} · {nombre(margePct, 0)} %</span>
          </div>
        )}
      </div>

      {modeEdition ? (
        <EditionFiche vv={vv} vendu={!!vente} onFermer={() => setModeEdition(false)} />
      ) : (
        <div style={stylePanneau}>
          <TitrePanneau icone="presse" teinte={TEINTES.ambre} titre="Fiche" />
          <LigneDetail label="Kilométrage" valeur={vv.kilometrage != null ? `${vv.kilometrage.toLocaleString("fr-CA")} km` : null} premiere />
          <LigneDetail label="Acheté de" valeur={vv.provenance || null} />
          <LigneDetail label="Date d'achat" valeur={dateFr(vv.dateAchat) || null} />
          {vv.description && <p style={{ fontSize: 13.5, whiteSpace: "pre-wrap", margin: "8px 0 0", padding: "10px 12px", borderRadius: 12, background: "var(--bg)" }}>{vv.description}</p>}
          <div style={{ display: "grid", gridTemplateColumns: !vente && vv.bons.length === 0 ? "1fr 1fr" : "1fr", gap: 8, marginTop: 12 }}>
            <BoutonAction icone="crayon" onClick={() => setModeEdition(true)}>Modifier</BoutonAction>
            {!vente && vv.bons.length === 0 && <BoutonAction icone="poubelle" couleur="var(--danger)" onClick={supprimer}>Supprimer</BoutonAction>}
          </div>
        </div>
      )}
    </div>
  );
}

function Ligne({ label, valeur, gras, premiere }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 13.5, padding: "9px 2px", borderTop: premiere ? "none" : "1px solid var(--border)", fontWeight: gras ? 800 : 400 }}>
      <span style={{ color: gras ? "var(--text)" : "var(--text-muted)", minWidth: 0 }}>{label}</span>
      <span style={{ flexShrink: 0, fontWeight: gras ? 800 : 700, fontVariantNumeric: "tabular-nums" }}>{valeur}</span>
    </div>
  );
}

function NouveauBon({ vv, onFermer }) {
  const router = useRouter();
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

  return (
    <div style={stylePanneau}>
      <TitrePanneau icone="outils" titre="Nouveau bon de travail" sousTitre="Facturé sans taxes ; son montant s'ajoute au coûtant du véhicule." />
      <label style={labelStyle}>Tâches (une par ligne)</label>
      <textarea value={taches} onChange={(e) => setTaches(e.target.value)} rows={4} autoFocus placeholder={"Inspection complète\nRéparer la fuite du toit"} style={{ ...champStyle, resize: "vertical" }} />
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, margin: "0 0 8px" }}>{erreur}</p>}
      <div style={grille2}>
        <button onClick={creer} disabled={enCours || !taches.trim()} className="bouton-3d" style={boutonPrincipal}>{enCours ? "…" : "Créer le bon"}</button>
        <BoutonAction icone="bloque" couleur="var(--text-muted)" onClick={onFermer}>Annuler</BoutonAction>
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
    <div style={stylePanneau}>
      <TitrePanneau icone="crayon" titre="Modifier la fiche" />
      {!vendu && <ChampsVehicule valeur={vehicule} onChange={setVehicule} sansKilometrage />}
      <ChampsFiche fiche={fiche} maj={maj} coutantModifiable={!vendu} />
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, margin: "0 0 8px" }}>{erreur}</p>}
      <div style={grille2}>
        <button onClick={sauvegarder} disabled={enCours} className="bouton-3d" style={boutonPrincipal}>{enCours ? "…" : "Enregistrer"}</button>
        <BoutonAction icone="bloque" couleur="var(--text-muted)" onClick={onFermer}>Annuler</BoutonAction>
      </div>
    </div>
  );
}

function Vendre({ vv, clients, comptesTresorerie, tpsTaux, tvqTaux, bonsOuverts, setAvertissement, onFermer }) {
  const router = useRouter();
  const [rechercheClient, setRechercheClient] = useState("");
  const [clientId, setClientId] = useState("");
  const [nouveau, setNouveau] = useState({ clientNom: "", clientTelephone: "", clientCourriel: "", clientAdresse: "", clientVille: "", clientProvince: PROVINCE_DEFAUT, clientCodePostal: "" });
  const champNouveau = (champ) => (v) => setNouveau((n) => ({ ...n, [champ]: v }));
  const remplirAdresse = remplisseurAdresse({
    ville: nouveau.clientVille,
    setAdresse: champNouveau("clientAdresse"),
    setVille: champNouveau("clientVille"),
    setProvince: champNouveau("clientProvince"),
    setCodePostal: champNouveau("clientCodePostal"),
  });
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
  const suggestions = q ? clients.filter((c) => correspondRecherche(q, c.nom, c.numero) || c.telephone?.includes(q)).slice(0, 8) : [];
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

  return (
    <div style={{ ...stylePanneau, border: "1.5px solid var(--success)" }}>
      <TitrePanneau icone="crochet" teinte={TEINTES.vert} titre="Facture de vente" sousTitre="Le coûtant du véhicule sera figé à l'émission." />
      {bonsOuverts.length > 0 && (
        <p style={{ fontSize: 12.5, color: "var(--avertissement)", fontWeight: 700, margin: "0 0 10px", padding: "8px 12px", borderRadius: 12, background: "var(--avertissement-fond)" }}>
          ⚠️ {bonsOuverts.length > 1 ? "Des bons ne sont" : "Un bon n'est"} pas encore facturé{bonsOuverts.length > 1 ? "s" : ""} ({bonsOuverts.map((b) => `#${b.numero}`).join(", ")}) : facture-{bonsOuverts.length > 1 ? "les" : "le"} d'abord pour qu'ils comptent dans le coûtant.
        </p>
      )}

      <label style={labelStyle}>Acheteur</label>
      {clientChoisi ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", ...champStyle }}>
          <span>{clientChoisi.nom}{clientChoisi.telephone ? ` · ${clientChoisi.telephone}` : ""}</span>
          <button onClick={() => setClientId("")} aria-label="Changer d'acheteur" title="Changer d'acheteur" style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex" }}><Icone nom="bloque" taille={16} couleur="var(--text-muted)" /></button>
        </div>
      ) : (
        <>
          <input value={rechercheClient} onChange={(e) => setRechercheClient(e.target.value)} placeholder="Client existant (nom, téléphone)…" style={champStyle} />
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
          <ChampAdresse valeur={nouveau.clientAdresse} onChange={champNouveau("clientAdresse")} onChoisir={remplirAdresse.onChoisir} placeholder="Adresse" style={champStyle} />
          <ChampVille valeur={nouveau.clientVille} onChange={champNouveau("clientVille")} codePostal={nouveau.clientCodePostal} placeholder="Ville" style={champStyle} />
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
            <SelectProvince valeur={nouveau.clientProvince} onChange={champNouveau("clientProvince")} style={champStyle} />
            <ChampCodePostal valeur={nouveau.clientCodePostal} onChange={champNouveau("clientCodePostal")} onSecteur={remplirAdresse.onSecteur} placeholder="Code postal" style={champStyle} />
          </div>
        </>
      )}

      <label style={labelStyle}>Prix de vente (avant taxes)</label>
      <input inputMode="decimal" value={prixVente} onChange={(e) => setPrixVente(e.target.value)} style={champStyle} />
      <Ligne premiere label={`TPS (${tpsTaux} %)`} valeur={argent(tps)} />
      <Ligne label={`TVQ (${tvqTaux} %)`} valeur={argent(tvq)} />
      <TotalEncadre label="Total (taxes incluses)" montant={prix + tps + tvq} />

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
      <div style={grille2}>
        <button
          onClick={() => { if (window.confirm(`Émettre la facture de vente de ${argent(prix + tps + tvq)} (taxes incluses) ? Le coûtant du véhicule sera figé.`)) vendre(doublon); }}
          disabled={enCours || prix <= 0 || (!clientId && !nouveau.clientNom.trim())}
          className="bouton-3d" style={boutonPrincipal}
        >
          {enCours ? "…" : doublon ? "Confirmer : autre client" : "Émettre la facture"}
        </button>
        <BoutonAction icone="bloque" couleur="var(--text-muted)" onClick={onFermer}>Annuler</BoutonAction>
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
    <div style={stylePanneau}>
      <TitrePanneau
        icone="document" teinte={TEINTES.vert} titre={`Facture de vente #${vente.numero}`}
        sousTitre={`${dateFr(vente.dateEmission)} · ${vente.client.nom}`}
        droite={vente.statut === "PAYEE"
          ? <Pastille couleur="var(--success)" fond="var(--success-fond)">Payée</Pastille>
          : <Pastille couleur="var(--danger)" fond="var(--danger-fond)">Impayée</Pastille>}
      />
      <Ligne premiere label="Prix de vente" valeur={argent(vente.prixVente)} />
      <Ligne label="TPS" valeur={argent(vente.tpsMontant)} />
      <Ligne label="TVQ" valeur={argent(vente.tvqMontant)} />
      <TotalEncadre label="Total (taxes incluses)" montant={vente.totalAvecTaxes} />
      {vente.statut === "PAYEE" && (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "10px 0 0" }}>
          Payée le {dateFr(vente.datePaiement)}{vente.modePaiement ? ` — ${LABEL_MODE_PAIEMENT[vente.modePaiement] || vente.modePaiement}` : ""}{vente.compteTresorerie ? ` · ${vente.compteTresorerie.nom}` : ""}{vente.referenceVersement ? ` · réf. ${vente.referenceVersement}` : ""}
        </p>
      )}

      {(() => {
        const boutons = [
          <BoutonAction key="imprimer" href={`/secretaire/inventaire/vehicules/${vv.id}/facture`} icone="imprimante" target="_blank" style={{ gridColumn: "1 / -1" }}>Imprimer la facture</BoutonAction>,
          vente.statut === "IMPAYEE"
            ? (!afficherPaiement && <BoutonAction key="payer" icone="crochet" couleur="#fff" fond="var(--success)" bordure="var(--success)" onClick={() => setAfficherPaiement(true)}>Marquer payée</BoutonAction>)
            : <BoutonAction key="impayer" icone="bloque" couleur="var(--text-muted)" onClick={() => changerStatut("IMPAYEE")} disabled={enCours}>Marquer impayée</BoutonAction>,
          estGerant && <BoutonAction key="annuler" icone="poubelle" couleur="var(--danger)" onClick={annuler} disabled={enCours}>Annuler la vente</BoutonAction>,
        ].filter(Boolean);
        // « Imprimer » sur toute la largeur, les autres côte à côte dessous
        return <div style={{ display: "grid", gridTemplateColumns: boutons.length > 1 ? "1fr 1fr" : "1fr", gap: 8, marginTop: 12 }}>{boutons}</div>;
      })()}
      {afficherPaiement && (
        <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <SelecteurCompteMode comptes={comptesTresorerie} compteTresorerieId={compteTresorerieId} setCompteTresorerieId={setCompteTresorerieId} modePaiement={modePaiement} setModePaiement={setModePaiement} />
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="No de chèque ou de transaction (optionnel)" style={{ ...champStyle, marginBottom: 0 }} />
          <div style={grille2}>
            <button onClick={() => changerStatut("PAYEE")} disabled={enCours || !compteTresorerieId} className="bouton-3d" style={boutonPrincipal}>✓ Encaisser</button>
            <BoutonAction icone="bloque" couleur="var(--text-muted)" onClick={() => setAfficherPaiement(false)}>Annuler</BoutonAction>
          </div>
        </div>
      )}
    </div>
  );
}

function TotalEncadre({ label, montant }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 12, background: "rgba(232,163,61,0.16)", marginTop: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-ombre)" }}>{label}</span>
      <span style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{argent(montant)}</span>
    </div>
  );
}

const grille2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };
const boutonPrincipal = { padding: 11, borderRadius: 12, fontSize: 13.5, fontWeight: 700 };
const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
const labelStyle = { display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 };
