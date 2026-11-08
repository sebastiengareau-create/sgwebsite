"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icone, TEINTES, CarteChiffre, Pastille, TitrePanneau, BoutonAction, LigneDetail, stylePanneau } from "../../../components/StyleSection";
import SelectProvince from "../../../components/SelectProvince";
import { ChampAdresse, ChampVille, ChampCodePostal, remplisseurAdresse } from "../../../components/ChampsAdresse";
import { ligneVille } from "@/lib/adresse";
import DossierVehicules from "./DossierVehicules";
import SectionCreditClient from "./SectionCreditClient";
import { libelleVehicule } from "@/lib/vehicules";
import { formaterTelephone } from "@/lib/telephone";
import { argent } from "@/lib/format";

const STATUTS_BON = { EN_ATTENTE: "En attente", EN_COURS: "En cours", TERMINE: "Facturé" };
const ETATS_SOUMISSION = {
  EN_ATTENTE: { texte: "En attente", couleur: "var(--avertissement)", fond: "var(--avertissement-fond)" },
  ACCEPTEE: { texte: "Acceptée → bon", couleur: "var(--success)", fond: "var(--success-fond)" },
  FACTUREE: { texte: "Facturée", couleur: "var(--success)", fond: "var(--success-fond)" },
};
const JOUR_MS = 86400000;

const dateCourte = (d) => new Date(d).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" });

export default function ClientDetailClient({ client, peutRedigerLettre, comptesTresorerie = [], peutModifierCredit = false, peutAccorderGeste = false }) {
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
  const remplir = remplisseurAdresse({ ville, setAdresse, setVille, setProvince, setCodePostal });
  const [garantieProlongee, setGarantieProlongee] = useState(client.garantieProlongee || "");

  const facturesImpayees = client.bons
    .filter((b) => b.facture?.statut === "IMPAYEE" && b.facture.totalAvecTaxes > 0) // un retour (négatif) n'est pas dû
    .map((b) => ({ ...b.facture, bonId: b.id }))
    .sort((a, b) => new Date(a.dateEmission) - new Date(b.dateEmission));
  const soldeDu = facturesImpayees.reduce((s, f) => s + f.totalAvecTaxes - f.montantPaye, 0);

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

  const soldeCredit = Math.round(client.credits.reduce((s, c) => s + c.montant, 0) * 100) / 100;
  const facturesClient = client.bons.filter((b) => b.facture);
  const totalFacture = facturesClient.reduce((s, b) => s + (b.facture.totalAvecTaxes || 0), 0);
  const contacts = [
    client.telephone && { href: `tel:${client.telephone.replace(/[^\d+]/g, "")}`, icone: "telephone", label: "Appeler" },
    client.courriel && { href: `mailto:${client.courriel}`, icone: "courriel", label: "Écrire" },
    peutRedigerLettre && { href: `/gerant/documents?destinataire=CLIENT&pour=${client.id}`, icone: "document", label: "Lettre" },
  ].filter(Boolean);

  return (
    <div className="conteneur-page">
      <Link href="/secretaire/clients" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour aux clients</Link>

      {/* Carte profil */}
      <div style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: "20px 20px 20px 24px", marginTop: 10, marginBottom: 14 }}>
        <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, background: "var(--accent)" }} />
        <span style={{ position: "absolute", right: -40, top: -40, width: 150, height: 150, borderRadius: "50%", background: "var(--accent)", opacity: 0.08 }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: TEINTES.ambre.fond, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: TEINTES.ambre.couleur, flexShrink: 0 }}>
            {client.nom.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.01em" }}>{client.nom}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
              {client.numero && <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", marginRight: 6 }}>#{client.numero}</span>}
              Client depuis le {dateCourte(client.creeLe)}
            </div>
            {client.garantieProlongee && (
              <div style={{ marginTop: 6 }}>
                <Pastille couleur={TEINTES.bleu.couleur} fond={TEINTES.bleu.fond}>Garantie prolongée #{client.garantieProlongee}</Pastille>
              </div>
            )}
          </div>
        </div>
        {contacts.length > 0 && (
          <div style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${contacts.length}, 1fr)`, gap: 8, marginTop: 16 }}>
            {contacts.map((c) => <BoutonAction key={c.label} href={c.href} icone={c.icone}>{c.label}</BoutonAction>)}
          </div>
        )}
      </div>

      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 10 }}>{erreur}</p>}

      {modeEdition ? (
        <div style={stylePanneau}>
          <TitrePanneau icone="crayon" titre="Modifier les coordonnées" />
          <label className="etiquette">Nom</label>
          <input value={nom} onChange={(e) => setNom(e.target.value)} className="champ" />
          <label className="etiquette">Téléphone</label>
          <input value={telephone} type="tel" onChange={(e) => setTelephone(e.target.value)} onBlur={(e) => setTelephone(formaterTelephone(e.target.value))} className="champ" />
          <label className="etiquette">Courriel</label>
          <input type="email" value={courriel} onChange={(e) => setCourriel(e.target.value)} className="champ" />
          <label className="etiquette">Adresse</label>
          <ChampAdresse valeur={adresse} onChange={setAdresse} onChoisir={remplir.onChoisir} className="champ" />
          <label className="etiquette">Ville</label>
          <ChampVille valeur={ville} onChange={setVille} codePostal={codePostal} className="champ" />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label className="etiquette">Province</label>
              <SelectProvince valeur={province} onChange={setProvince} className="champ" />
            </div>
            <div style={{ width: 110 }}>
              <label className="etiquette">Code postal</label>
              <ChampCodePostal valeur={codePostal} onChange={setCodePostal} onSecteur={remplir.onSecteur} className="champ" />
            </div>
          </div>
          <label className="etiquette">Garantie prolongée — numéro de contrat</label>
          <input value={garantieProlongee} onChange={(e) => setGarantieProlongee(e.target.value)} className="champ" style={{ marginBottom: 14 }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={sauvegarder} disabled={enCours} className="bouton-3d" style={{ padding: 12, borderRadius: 12, fontWeight: 700, fontSize: 14 }}>
              {enCours ? "…" : "Sauvegarder"}
            </button>
            <BoutonAction icone="bloque" couleur="var(--text-muted)" onClick={() => setModeEdition(false)}>Annuler</BoutonAction>
          </div>
        </div>
      ) : (
        <>
          <div className="grille-trois" style={{ marginBottom: 24 }}>
            <CarteChiffre
              titre="Solde dû" montant={argent(soldeDu)}
              couleur={soldeDu > 0.005 ? "var(--danger)" : "var(--success)"} teinte={soldeDu > 0.005 ? "var(--danger)" : "var(--success)"}
              note={facturesImpayees.length > 0 ? `${facturesImpayees.length} facture${facturesImpayees.length > 1 ? "s" : ""} impayée${facturesImpayees.length > 1 ? "s" : ""}` : "À jour — aucune facture impayée"}
            />
            <CarteChiffre
              titre="Crédit client" montant={argent(soldeCredit)} teinte="var(--bleu)"
              couleur={soldeCredit > 0.005 ? "var(--bleu)" : "var(--text)"}
              note={soldeCredit > 0.005 ? "À appliquer ou rembourser" : "Aucun crédit disponible"}
            />
            <CarteChiffre
              titre="Facturé" montant={argent(totalFacture)} teinte="var(--accent)"
              note={`${client.bons.length} bon${client.bons.length !== 1 ? "s" : ""} · ${client.vehicules.length} véhicule${client.vehicules.length !== 1 ? "s" : ""}`}
            />
          </div>

          <div style={stylePanneau}>
            <TitrePanneau icone="personne" teinte={TEINTES.bleu} titre="Coordonnées" />
            <LigneDetail label="Numéro" valeur={client.numero} premiere />
            <LigneDetail label="Téléphone" valeur={client.telephone && <a href={`tel:${client.telephone.replace(/[^\d+]/g, "")}`} style={{ color: "inherit" }}>{client.telephone}</a>} />
            <LigneDetail label="Courriel" valeur={client.courriel && <a href={`mailto:${client.courriel}`} style={{ color: "inherit" }}>{client.courriel}</a>} />
            <LigneDetail label="Adresse" valeur={client.adresse} />
            <LigneDetail label="Ville" valeur={ligneVille(client) || null} />
          </div>

          {facturesImpayees.length > 0 && (
            <div style={stylePanneau}>
              <TitrePanneau icone="alerte" teinte={TEINTES.rouge} titre="Factures impayées" sousTitre="Touche une facture pour ouvrir son bon." />
              {facturesImpayees.map((f, i) => {
                const jours = Math.floor((Date.now() - new Date(f.dateEmission)) / JOUR_MS);
                return (
                  <Link key={f.id} href={`/bons/${f.bonId}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--text)", padding: "10px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>Facture #{f.numero}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 3 }}>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Émise le {dateCourte(f.dateEmission)}</span>
                        {jours > 30
                          ? <Pastille couleur="var(--danger)" fond="var(--danger-fond)">Depuis {jours} j</Pastille>
                          : <Pastille couleur="var(--avertissement)" fond="var(--avertissement-fond)">Depuis {jours} j</Pastille>}
                      </div>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{argent(f.totalAvecTaxes - f.montantPaye)}</span>
                    <Icone nom="chevron" taille={18} couleur="var(--text-muted)" />
                  </Link>
                );
              })}
            </div>
          )}

          <SectionCreditClient clientId={client.id} credits={client.credits} comptesTresorerie={comptesTresorerie} peutModifier={peutModifierCredit} peutAccorderGeste={peutAccorderGeste} />

          <DossierVehicules clientId={client.id} vehicules={client.vehicules} />

          <div style={stylePanneau}>
            <TitrePanneau icone="outils" teinte={TEINTES.ambre} titre="Bons de travail" sousTitre={client.bons.length === 0 ? "Aucun bon encore." : `${client.bons.length} bon${client.bons.length !== 1 ? "s" : ""}, le plus récent en haut`} />
            {client.bons.map((b, i) => {
              const etat = etatBon(b);
              return (
                <Link key={b.id} href={`/bons/${b.id}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--text)", padding: "10px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>Bon #{b.numero}</span>
                      <Pastille couleur={etat.couleur} fond={etat.fond}>{etat.texte}</Pastille>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {dateCourte(b.creeLe)}{b.vehicule && ` · ${libelleVehicule(b.vehicule) || b.vehicule.plaque}`}
                    </div>
                  </div>
                  {b.facture && <span style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{argent(b.facture.totalAvecTaxes)}</span>}
                  <Icone nom="chevron" taille={18} couleur="var(--text-muted)" />
                </Link>
              );
            })}
          </div>

          {client.soumissions.length > 0 && (
            <div style={stylePanneau}>
              <TitrePanneau icone="document" teinte={TEINTES.vert} titre="Soumissions" sousTitre={`${client.soumissions.length} soumission${client.soumissions.length !== 1 ? "s" : ""}`} />
              {client.soumissions.map((s, i) => {
                const etat = ETATS_SOUMISSION[s.statut] || { texte: s.statut, couleur: "var(--text-muted)", fond: "var(--surface-alt)" };
                return (
                  <Link key={s.id} href={s.bonId ? `/bons/${s.bonId}` : `/secretaire/operations/soumissions/${s.id}/modifier`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--text)", padding: "10px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>Soumission #{s.numero}</span>
                        <Pastille couleur={etat.couleur} fond={etat.fond}>{etat.texte}</Pastille>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {dateCourte(s.creeLe)}{s.vehiculeInfo && ` · ${s.vehiculeInfo}`}
                      </div>
                    </div>
                    <Icone nom="chevron" taille={18} couleur="var(--text-muted)" />
                  </Link>
                );
              })}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            <BoutonAction icone="crayon" onClick={() => setModeEdition(true)}>Modifier</BoutonAction>
            <BoutonAction icone="poubelle" couleur="var(--danger)" onClick={supprimer} disabled={enCours}>Supprimer</BoutonAction>
          </div>
        </>
      )}
    </div>
  );
}

// État d'un bon : facture payée / impayée, sinon statut du travail
function etatBon(b) {
  if (b.facture?.statut === "IMPAYEE") return { texte: "Facturé — impayé", couleur: "var(--danger)", fond: "var(--danger-fond)" };
  if (b.facture?.statut === "PAYEE") return { texte: "Facturé — payé", couleur: "var(--success)", fond: "var(--success-fond)" };
  if (b.statut === "EN_COURS") return { texte: "En cours", couleur: "var(--bleu)", fond: "var(--bleu-fond)" };
  if (b.statut === "EN_ATTENTE") return { texte: "En attente", couleur: "var(--avertissement)", fond: "var(--avertissement-fond)" };
  return { texte: STATUTS_BON[b.statut] || b.statut, couleur: "var(--text-muted)", fond: "var(--surface-alt)" };
}
