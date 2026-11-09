"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../../components/BandeauSection";
import BoutonImporterFichier from "../../components/BoutonImporterFichier";
import SelectProvince from "../../components/SelectProvince";
import { ChampAdresse, ChampVille, ChampCodePostal, remplisseurAdresse } from "../../components/ChampsAdresse";
import { useOrdreFiches } from "../../components/NavigationFiches";
import { adresseComplete, PROVINCE_DEFAUT } from "@/lib/adresse";
import { formaterTelephone } from "@/lib/telephone";
import { correspondRecherche } from "@/lib/recherche";
import { argent } from "@/lib/format";
import { Icone, TEINTES, CarteChiffre, GrilleChiffres, BoutonPlein, BoutonAction, GroupeLiens, Panneau, Pastille, TitrePanneau, stylePanneau } from "../../components/StyleSection";

export default function FournisseursClient({ fournisseurs, peutImporter }) {
  const router = useRouter();
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [recherche, setRecherche] = useState("");

  const fournisseursFiltres = fournisseurs.filter((f) => {
    const q = recherche.trim().toLowerCase();
    if (!q) return true;
    const champs = [f.nom, f.telephone, f.courriel, f.adresse, f.ville, f.province, f.codePostal];
    return correspondRecherche(q, champs);
  });
  useOrdreFiches("fournisseurs", fournisseursFiltres.map((f) => f.id));

  const actifs = fournisseurs.filter((f) => f.actif);
  const avecSolde = fournisseurs.filter((f) => f.aPayer > 0.005);
  const totalAPayer = avecSolde.reduce((s, f) => s + f.aPayer, 0);

  return (
    <div className="conteneur-page">
      <BandeauSection icone="🏢" titre="Fournisseurs" sousTitre="Touche un fournisseur pour voir sa fiche complète — coordonnées, historique de dépenses." />

      {/* Formulaire ouvert : il a son propre bouton Annuler */}
      {afficherFormulaire ? (
        <div style={{ marginBottom: 20 }}>
          <FormulaireCreation onCree={() => { setAfficherFormulaire(false); router.refresh(); }} onAnnuler={() => setAfficherFormulaire(false)} />
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <BoutonPlein icone="plus" onClick={() => setAfficherFormulaire(true)}>Nouveau fournisseur</BoutonPlein>
          {peutImporter && <BoutonImporterFichier apiUrl="/api/fournisseurs/importer" libelle="depuis Excel" libellePluriel="fournisseur" />}
        </div>
      )}

      <GrilleChiffres>
        <CarteChiffre
          titre="À payer" montant={argent(totalAPayer)}
          couleur={avecSolde.length > 0 ? "var(--danger)" : "var(--success)"} teinte={avecSolde.length > 0 ? "var(--danger)" : "var(--success)"}
          href="/gerant/comptabilite/comptes-a-payer"
          note={avecSolde.length === 0 ? "Aucune facture fournisseur impayée" : `À ${avecSolde.length} fournisseur${avecSolde.length > 1 ? "s" : ""} · voir les comptes à payer`}
        />
        <CarteChiffre
          titre="Fournisseurs" montant={String(actifs.length)} teinte="var(--bleu)"
          note={fournisseurs.length > actifs.length ? `Actifs · ${fournisseurs.length - actifs.length} désactivé${fournisseurs.length - actifs.length > 1 ? "s" : ""}` : "Actifs"}
        />
      </GrilleChiffres>

      <GroupeLiens
        titre="Au quotidien" teinte={TEINTES.ambre}
        liens={[
          { href: "/gerant/comptabilite/comptes-a-payer", icone: "presse", label: "Comptes à payer", detail: "Saisir et payer les factures fournisseurs" },
        ]}
      />
      <GroupeLiens
        titre="Rapports" teinte={TEINTES.vert}
        liens={[
          { href: "/gerant/comptabilite/rapports/fournisseurs", target: "_blank", icone: "imprimante", label: "Liste des fournisseurs", detail: "PDF, Excel ou imprimer" },
        ]}
      />

      <Panneau titre="Fournisseurs">
        <div style={{ position: "relative", marginBottom: 14 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex" }}>
            <Icone nom="loupe" taille={18} couleur="var(--text-muted)" />
          </span>
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Nom, téléphone, courriel, adresse…"
            style={{ ...champStyle, marginBottom: 0, padding: "11px 12px 11px 40px", fontSize: 14, borderRadius: 12 }}
          />
        </div>

        {fournisseursFiltres.length > 0 && (
          <div style={{ display: "flex", padding: "0 6px 8px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", borderBottom: "2px solid var(--accent)" }}>
            <span style={{ flex: 1 }}>{fournisseursFiltres.length} fournisseur{fournisseursFiltres.length > 1 ? "s" : ""}</span>
            <span>Dépenses</span>
          </div>
        )}
        {fournisseursFiltres.map((f, i) => (
          <Link key={f.id} href={`/gerant/fournisseurs/${f.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 6px", borderTop: i === 0 ? "none" : "1px solid var(--border)", opacity: f.actif ? 1 : 0.55 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: f.aPayer > 0.005 ? "var(--danger-fond)" : TEINTES.bleu.fond,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800,
                color: f.aPayer > 0.005 ? "var(--danger)" : TEINTES.bleu.couleur,
              }}>
                {f.nom.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nom}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.numero && <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>#{f.numero}{" · "}</span>}
                  {[f.telephone, f.courriel, adresseComplete(f)].filter(Boolean).join(" · ") || "Aucune coordonnée"}
                </div>
                {(f.aPayer > 0.005 || !f.actif) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 5 }}>
                    {f.aPayer > 0.005 && <Pastille couleur="var(--danger)" fond="var(--danger-fond)">{argent(f.aPayer)} à payer</Pastille>}
                    {!f.actif && <Pastille couleur="var(--text-muted)" fond="var(--surface-alt)">Désactivé</Pastille>}
                  </div>
                )}
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>
                <Icone nom="presse" taille={14} /> {f._count.depenses}
              </span>
              <Icone nom="chevron" taille={18} couleur="var(--text-muted)" />
            </div>
          </Link>
        ))}
        {fournisseursFiltres.length === 0 && fournisseurs.length > 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>Aucun fournisseur ne correspond à « {recherche} ».</p>
        )}
        {fournisseurs.length === 0 && !afficherFormulaire && (
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>Aucun fournisseur encore — ajoute-en un avec « Nouveau fournisseur ».</p>
        )}
      </Panneau>
    </div>
  );
}

function FormulaireCreation({ onCree, onAnnuler }) {
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [courriel, setCourriel] = useState("");
  const [adresse, setAdresse] = useState("");
  const [ville, setVille] = useState("");
  const [province, setProvince] = useState(PROVINCE_DEFAUT);
  const [codePostal, setCodePostal] = useState("");
  const remplir = remplisseurAdresse({ ville, setAdresse, setVille, setProvince, setCodePostal });
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function creer(e) {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    const res = await fetch("/api/fournisseurs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, telephone, courriel, adresse, ville, province, codePostal }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de la création.");
      return;
    }
    onCree();
  }

  return (
    <form onSubmit={creer}>
      <div style={{ ...stylePanneau, border: "1.5px solid var(--accent)" }}>
        <TitrePanneau icone="immeuble" teinte={TEINTES.ambre} titre="Nouveau fournisseur" sousTitre="Ses coordonnées — tout est modifiable ensuite dans sa fiche." />
        <label style={labelStyle}>Nom du fournisseur *</label>
        <input required value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. : NAPA Québec" style={champStyle} />
        <div className="grille-deux" style={{ gap: "0 12px" }}>
          <div>
            <label style={labelStyle}>Téléphone</label>
            <input value={telephone} type="tel" onChange={(e) => setTelephone(e.target.value)} onBlur={(e) => setTelephone(formaterTelephone(e.target.value))} style={champStyle} />
          </div>
          <div>
            <label style={labelStyle}>Courriel</label>
            <input type="email" value={courriel} onChange={(e) => setCourriel(e.target.value)} style={champStyle} />
          </div>
        </div>
        <label style={labelStyle}>Adresse</label>
        <ChampAdresse valeur={adresse} onChange={setAdresse} onChoisir={remplir.onChoisir} style={champStyle} />
        <label style={labelStyle}>Ville</label>
        <ChampVille valeur={ville} onChange={setVille} codePostal={codePostal} style={champStyle} />
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={labelStyle}>Province</label>
            <SelectProvince valeur={province} onChange={setProvince} style={{ ...champStyle, marginBottom: 0 }} />
          </div>
          <div style={{ width: 120 }}>
            <label style={labelStyle}>Code postal</label>
            <ChampCodePostal valeur={codePostal} onChange={setCodePostal} onSecteur={remplir.onSecteur} style={{ ...champStyle, marginBottom: 0 }} />
          </div>
        </div>
      </div>

      {erreur && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--danger-fond)", border: "1px solid var(--danger)", borderRadius: 12, padding: "10px 14px", fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>
          <Icone nom="alerte" taille={16} couleur="var(--danger)" /> {erreur}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: onAnnuler ? "1fr 1fr" : "1fr", gap: 8 }}>
        <button type="submit" disabled={enCours} className="bouton-3d" style={{ padding: 12, borderRadius: 12, fontWeight: 700, fontSize: 14 }}>
          {enCours ? "Création…" : "Créer le fournisseur"}
        </button>
        {onAnnuler && <BoutonAction icone="bloque" couleur="var(--text-muted)" onClick={onAnnuler}>Annuler</BoutonAction>}
      </div>
    </form>
  );
}

const labelStyle = { display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4, marginTop: 10 };
const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
