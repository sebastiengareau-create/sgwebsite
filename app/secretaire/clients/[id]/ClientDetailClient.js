"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TitreSection, LigneInfo } from "../../../components/ui";
import SelectProvince from "../../../components/SelectProvince";
import { ligneVille } from "@/lib/adresse";
import DossierVehicules from "./DossierVehicules";
import { libelleVehicule } from "@/lib/vehicules";

const STATUTS_BON = { EN_ATTENTE: "En attente", EN_COURS: "En cours", TERMINE: "Facturé" };
const STATUTS_SOUMISSION = { EN_ATTENTE: "En attente", ACCEPTEE: "Acceptée" };
const JOUR_MS = 86400000;

const dateCourte = (d) => new Date(d).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" });

export default function ClientDetailClient({ client }) {
  const router = useRouter();
  const [modeEdition, setModeEdition] = useState(false);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const [nom, setNom] = useState(client.nom);
  const [telephone, setTelephone] = useState(client.telephone || "");
  const [courriel, setCourriel] = useState(client.courriel || "");
  const [adresse, setAdresse] = useState(client.adresse || "");
  const [ville, setVille] = useState(client.ville || "");
  const [province, setProvince] = useState(client.province || "");
  const [codePostal, setCodePostal] = useState(client.codePostal || "");
  const [garantieProlongee, setGarantieProlongee] = useState(client.garantieProlongee || "");

  const facturesImpayees = client.bons
    .filter((b) => b.facture?.statut === "IMPAYEE")
    .map((b) => ({ ...b.facture, bonId: b.id }))
    .sort((a, b) => new Date(a.dateEmission) - new Date(b.dateEmission));
  const soldeDu = facturesImpayees.reduce((s, f) => s + f.totalAvecTaxes, 0);

  async function sauvegarder(e, confirmerDoublon = false) {
    e?.preventDefault();
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, telephone, courriel, adresse, ville, province, codePostal, garantieProlongee, confirmerDoublon }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.doublonPossible && window.confirm(`${data.erreur}\n\nEnregistrer quand même ?`)) {
        return sauvegarder(null, true);
      }
      setErreur(data.erreur || "Erreur.");
      return;
    }
    setModeEdition(false);
    router.refresh();
  }

  async function supprimer() {
    if (!window.confirm(`Supprimer le client "${client.nom}" ? Impossible si des bons de travail lui sont associés.`)) return;
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de la suppression.");
      return;
    }
    router.push("/secretaire/clients");
  }

  return (
    <div className="conteneur-page">
      <Link href="/secretaire/clients" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour aux clients</Link>

      {/* Carte profil */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginTop: 10, marginBottom: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(180deg, var(--accent-clair), var(--accent))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "#17150f", flexShrink: 0 }}>
            {client.nom.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{client.nom}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {client.numero && <span style={{ fontFamily: "monospace", fontWeight: 700, marginRight: 6 }}>#{client.numero}</span>}
              Client depuis {dateCourte(client.creeLe)}
            </div>
          </div>
        </div>
        {(client.telephone || client.courriel) && (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {client.telephone && (
              <a href={`tel:${client.telephone.replace(/[^\d+]/g, "")}`} className="bouton-3d-sombre" style={{ flex: 1, textAlign: "center", padding: 9, borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                📞 Appeler
              </a>
            )}
            {client.courriel && (
              <a href={`mailto:${client.courriel}`} className="bouton-3d-sombre" style={{ flex: 1, textAlign: "center", padding: 9, borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                ✉️ Écrire
              </a>
            )}
          </div>
        )}
        {client.garantieProlongee && (
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            <span className="bouton-3d" style={{ display: "inline-block", padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
              🛡️ Garantie prolongée — #{client.garantieProlongee}
            </span>
          </div>
        )}
      </div>

      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 10 }}>{erreur}</p>}

      {modeEdition ? (
        <div className="carte">
          <TitreSection>Coordonnées</TitreSection>
          <label className="etiquette">Nom</label>
          <input value={nom} onChange={(e) => setNom(e.target.value)} className="champ" />
          <label className="etiquette">Téléphone</label>
          <input value={telephone} onChange={(e) => setTelephone(e.target.value)} className="champ" />
          <label className="etiquette">Courriel</label>
          <input type="email" value={courriel} onChange={(e) => setCourriel(e.target.value)} className="champ" />
          <label className="etiquette">Adresse</label>
          <input value={adresse} onChange={(e) => setAdresse(e.target.value)} className="champ" />
          <label className="etiquette">Ville</label>
          <input value={ville} onChange={(e) => setVille(e.target.value)} className="champ" />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label className="etiquette">Province</label>
              <SelectProvince valeur={province} onChange={setProvince} className="champ" />
            </div>
            <div style={{ width: 110 }}>
              <label className="etiquette">Code postal</label>
              <input value={codePostal} onChange={(e) => setCodePostal(e.target.value.toUpperCase())} maxLength={7} className="champ" />
            </div>
          </div>
          <label className="etiquette">Garantie prolongée — numéro de contrat</label>
          <input value={garantieProlongee} onChange={(e) => setGarantieProlongee(e.target.value)} className="champ" style={{ marginBottom: 12 }} />

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={sauvegarder} disabled={enCours} className="bouton-3d" style={{ flex: 1, padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
              {enCours ? "…" : "Sauvegarder"}
            </button>
            <button onClick={() => setModeEdition(false)} className="bouton-3d-sombre" style={{ flex: 1, padding: 11, borderRadius: 10, fontSize: 13 }}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="carte" style={{ marginBottom: 12 }}>
            <TitreSection>Coordonnées</TitreSection>
            <LigneInfo label="Numéro" valeur={client.numero} />
            <LigneInfo label="Téléphone" valeur={client.telephone && <a href={`tel:${client.telephone.replace(/[^\d+]/g, "")}`} style={{ color: "inherit" }}>{client.telephone}</a>} />
            <LigneInfo label="Courriel" valeur={client.courriel && <a href={`mailto:${client.courriel}`} style={{ color: "inherit" }}>{client.courriel}</a>} />
            <LigneInfo label="Adresse" valeur={client.adresse} />
            <LigneInfo label="Ville" valeur={ligneVille(client) || null} />
          </div>

          <div className="carte" style={{ marginBottom: 12 }}>
            <TitreSection>Solde dû</TitreSection>
            <div style={{ fontSize: 18, fontWeight: 700, color: soldeDu > 0.005 ? "var(--danger)" : "var(--success)" }}>{soldeDu.toFixed(2)} $</div>
            {facturesImpayees.length === 0 ? (
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "2px 0 0" }}>À jour — aucune facture impayée.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                {facturesImpayees.map((f) => {
                  const jours = Math.floor((Date.now() - new Date(f.dateEmission)) / JOUR_MS);
                  return (
                    <Link key={f.id} href={`/bons/${f.bonId}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, textDecoration: "none", color: "var(--text)", padding: "6px 8px", borderRadius: 6, background: "var(--bg)" }}>
                      <span>
                        <strong style={{ fontFamily: "monospace" }}>#{f.numero}</strong>
                        <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>{dateCourte(f.dateEmission)}</span>
                        {jours > 30 && <span style={{ color: "var(--danger)", fontWeight: 700, fontSize: 10.5, marginLeft: 6 }}>{jours} j</span>}
                      </span>
                      <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{f.totalAvecTaxes.toFixed(2)} $ ›</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <DossierVehicules clientId={client.id} vehicules={client.vehicules} />

          <div className="carte" style={{ marginBottom: 12 }}>
            <TitreSection>Bons de commande ({client.bons.length})</TitreSection>
            {client.bons.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucun bon encore.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {client.bons.map((b) => (
                  <Link key={b.id} href={`/bons/${b.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <div style={{ fontSize: 13, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ minWidth: 0 }}>
                        <strong style={{ fontSize: 14, fontFamily: "monospace" }}>#{b.numero}</strong>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>{dateCourte(b.creeLe)}</span>
                        {b.vehicule && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>🚗 {libelleVehicule(b.vehicule) || b.vehicule.plaque}</div>}
                      </span>
                      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
                        {b.facture && <span style={{ fontWeight: 700, fontSize: 12.5 }}>{b.facture.totalAvecTaxes.toFixed(2)} $</span>}
                        <span style={{ fontSize: 11, color: b.facture?.statut === "IMPAYEE" ? "var(--danger)" : "var(--text-muted)" }}>
                          {b.facture?.statut === "IMPAYEE" ? "Facturé — impayé" : b.facture?.statut === "PAYEE" ? "Facturé — payé" : STATUTS_BON[b.statut]}
                        </span>
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {client.soumissions.length > 0 && (
            <div className="carte" style={{ marginBottom: 12 }}>
              <TitreSection>Soumissions ({client.soumissions.length})</TitreSection>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {client.soumissions.map((s) => (
                  <Link key={s.id} href={s.bonId ? `/bons/${s.bonId}` : `/secretaire/operations/soumissions/${s.id}/modifier`} style={{ textDecoration: "none", color: "inherit" }}>
                    <div style={{ fontSize: 13, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span>
                        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace" }}>#{s.numero}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>{dateCourte(s.creeLe)}</span>
                        {s.vehiculeInfo && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>🚗 {s.vehiculeInfo}</div>}
                      </span>
                      <span style={{ color: s.statut === "ACCEPTEE" ? "var(--success)" : "var(--text-muted)", fontSize: 11, fontWeight: s.statut === "ACCEPTEE" ? 700 : 400 }}>
                        {s.statut === "ACCEPTEE" ? "✓ Acceptée → bon" : STATUTS_SOUMISSION[s.statut] || s.statut}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setModeEdition(true)} className="bouton-3d" style={{ flex: 1, padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
              ✏️ Modifier
            </button>
            <button onClick={supprimer} disabled={enCours} className="bouton-3d-sombre" style={{ padding: "11px 14px", borderRadius: 10, fontSize: 13 }}>
              🗑️
            </button>
          </div>
        </>
      )}
    </div>
  );
}

