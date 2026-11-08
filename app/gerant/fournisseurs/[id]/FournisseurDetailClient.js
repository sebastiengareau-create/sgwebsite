"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icone, TEINTES, CarteChiffre, CarteLien, TitreGroupe, Pastille, TitrePanneau, BoutonAction, LigneDetail, stylePanneau } from "../../../components/StyleSection";
import SelectProvince from "../../../components/SelectProvince";
import { ChampAdresse, ChampVille, ChampCodePostal, remplisseurAdresse } from "../../../components/ChampsAdresse";
import { ligneVille } from "@/lib/adresse";
import { etatEcheance } from "@/lib/echeance";
import { formaterTelephone } from "@/lib/telephone";
import { argent } from "@/lib/format";

const dateCourte = (d) => new Date(d).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" });

export default function FournisseurDetailClient({ fournisseur, soldeDu, nbImpayees, enRetard = 0, nbEnRetard = 0, achatsAnnee = 0, nbAchatsAnnee = 0 }) {
  const router = useRouter();
  const [modeEdition, setModeEdition] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const [nom, setNom] = useState(fournisseur.nom);
  const [telephone, setTelephone] = useState(fournisseur.telephone || "");
  const [courriel, setCourriel] = useState(fournisseur.courriel || "");
  const [adresse, setAdresse] = useState(fournisseur.adresse || "");
  const [ville, setVille] = useState(fournisseur.ville || "");
  const [province, setProvince] = useState(fournisseur.province || "");
  const [codePostal, setCodePostal] = useState(fournisseur.codePostal || "");
  const remplir = remplisseurAdresse({ ville, setAdresse, setVille, setProvince, setCodePostal });

  async function sauvegarder() {
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/fournisseurs/${fournisseur.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, telephone, courriel, adresse, ville, province, codePostal }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    setModeEdition(false);
    router.refresh();
  }

  async function toggleActif() {
    setEnCours(true);
    await fetch(`/api/fournisseurs/${fournisseur.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: !fournisseur.actif }),
    });
    setEnCours(false);
    router.refresh();
  }

  async function supprimer() {
    if (!window.confirm(`Supprimer définitivement le fournisseur "${fournisseur.nom}" ? Irréversible.`)) return;
    setEnCours(true);
    const res = await fetch(`/api/fournisseurs/${fournisseur.id}`, { method: "DELETE" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    router.push("/gerant/fournisseurs");
  }

  const contacts = [
    fournisseur.telephone && { href: `tel:${fournisseur.telephone.replace(/[^\d+]/g, "")}`, icone: "telephone", label: "Appeler" },
    fournisseur.courriel && { href: `mailto:${fournisseur.courriel}`, icone: "courriel", label: "Écrire" },
  ].filter(Boolean);
  const couleurProfil = fournisseur.actif ? "var(--bleu)" : "var(--text-muted)";

  return (
    <div className="conteneur-page">
      <Link href="/gerant/fournisseurs" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour aux fournisseurs</Link>

      {/* Carte profil */}
      <div style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: "20px 20px 20px 24px", marginTop: 10, marginBottom: 14 }}>
        <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, background: couleurProfil }} />
        <span style={{ position: "absolute", right: -40, top: -40, width: 150, height: 150, borderRadius: "50%", background: couleurProfil, opacity: 0.08 }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: TEINTES.bleu.fond, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: TEINTES.bleu.couleur, flexShrink: 0 }}>
            {fournisseur.nom.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.01em" }}>{fournisseur.nom}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
              {fournisseur.numero && <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", marginRight: 6 }}>#{fournisseur.numero}</span>}
              Fournisseur depuis le {dateCourte(fournisseur.creeLe)}
            </div>
            {!fournisseur.actif && (
              <div style={{ marginTop: 6 }}>
                <Pastille couleur="var(--danger)" fond="var(--danger-fond)">Désactivé</Pastille>
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
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label className="etiquette">Province</label>
              <SelectProvince valeur={province} onChange={setProvince} className="champ" style={{ marginBottom: 0 }} />
            </div>
            <div style={{ width: 110 }}>
              <label className="etiquette">Code postal</label>
              <ChampCodePostal valeur={codePostal} onChange={setCodePostal} onSecteur={remplir.onSecteur} className="champ" style={{ marginBottom: 0 }} />
            </div>
          </div>

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
              href={`/gerant/comptabilite/comptes-a-payer?fournisseur=${fournisseur.id}`}
              note={nbImpayees > 0 ? `${nbImpayees} facture${nbImpayees > 1 ? "s" : ""} impayée${nbImpayees > 1 ? "s" : ""}` : "À jour — aucune facture impayée"}
            />
            <CarteChiffre
              titre="En retard" montant={argent(enRetard)}
              couleur={nbEnRetard > 0 ? "var(--danger)" : "var(--text)"} teinte={nbEnRetard > 0 ? "var(--danger)" : "var(--avertissement)"}
              note={nbEnRetard > 0 ? `${nbEnRetard} facture${nbEnRetard > 1 ? "s" : ""} passée${nbEnRetard > 1 ? "s" : ""} d'échéance` : "Aucune facture en retard"}
            />
            <CarteChiffre
              titre="Achats cette année" montant={argent(achatsAnnee)} teinte="var(--bleu)"
              note={`${nbAchatsAnnee} facture${nbAchatsAnnee !== 1 ? "s" : ""} depuis le 1er janvier`}
            />
          </div>

          <section style={{ marginBottom: 24 }}>
            <TitreGroupe couleur={TEINTES.ambre.couleur}>Actions</TitreGroupe>
            <div className="grille-trois" style={{ gap: 10 }}>
              <CarteLien href={`/gerant/comptabilite/comptes-a-payer?fournisseur=${fournisseur.id}`} icone="presse" label="Comptes à payer" detail="Saisir et payer ses factures" />
              <CarteLien href={`/secretaire/inventaire/commandes?fournisseur=${fournisseur.id}`} icone="panier" label="Commander" detail="Commander des pièces" />
              <CarteLien href={`/gerant/comptabilite/rapports/inventaire-fournisseurs?fournisseur=${fournisseur.id}`} target="_blank" icone="imprimante" label="Inventaire" detail="Ses pièces en stock (PDF)" />
            </div>
          </section>

          <div style={stylePanneau}>
            <TitrePanneau icone="immeuble" teinte={TEINTES.bleu} titre="Coordonnées" />
            <LigneDetail label="Numéro" valeur={fournisseur.numero} premiere />
            <LigneDetail label="Téléphone" valeur={fournisseur.telephone && <a href={`tel:${fournisseur.telephone.replace(/[^\d+]/g, "")}`} style={{ color: "inherit" }}>{fournisseur.telephone}</a>} />
            <LigneDetail label="Courriel" valeur={fournisseur.courriel && <a href={`mailto:${fournisseur.courriel}`} style={{ color: "inherit" }}>{fournisseur.courriel}</a>} />
            <LigneDetail label="Adresse" valeur={fournisseur.adresse} />
            <LigneDetail label="Ville" valeur={ligneVille(fournisseur) || null} />
          </div>

          <div style={stylePanneau}>
            <TitrePanneau
              icone="presse" teinte={TEINTES.ambre} titre="Factures récentes"
              sousTitre={fournisseur.depenses.length === 0 ? "Aucune facture encore." : `Les ${fournisseur.depenses.length} plus récentes`}
            />
            {fournisseur.depenses.map((d, i) => {
              const payee = d.statut === "PAYEE";
              const etat = etatEcheance(d);
              const couleur = payee ? "var(--success)" : etat?.enRetard ? "var(--danger)" : "var(--avertissement)";
              const fond = payee ? "var(--success-fond)" : etat?.enRetard ? "var(--danger-fond)" : "var(--avertissement-fond)";
              return (
                <Link key={d.id} href={`/gerant/comptabilite/comptes-a-payer/${d.id}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--text)", padding: "10px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.description}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 3 }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Facture du {dateCourte(d.dateFacture)}</span>
                      <Pastille couleur={couleur} fond={fond}>{payee ? "Payée" : (etat?.texte || "Impayée")}</Pastille>
                    </div>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{argent(d.montant)}</span>
                  <Icone nom="chevron" taille={18} couleur="var(--text-muted)" />
                </Link>
              );
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
            <BoutonAction icone="crayon" onClick={() => setModeEdition(true)}>Modifier</BoutonAction>
            <BoutonAction icone={fournisseur.actif ? "bloque" : "crochet"} couleur={fournisseur.actif ? "var(--avertissement)" : "var(--success)"} onClick={toggleActif} disabled={enCours}>
              {fournisseur.actif ? "Désactiver" : "Réactiver"}
            </BoutonAction>
            <BoutonAction icone="poubelle" couleur="var(--danger)" onClick={supprimer} disabled={enCours}>Supprimer</BoutonAction>
          </div>
        </>
      )}
    </div>
  );
}
