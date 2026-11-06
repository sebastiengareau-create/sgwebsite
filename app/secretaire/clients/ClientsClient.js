"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../../components/BandeauSection";
import BoutonImporterFichier from "../../components/BoutonImporterFichier";
import ChampsVehicule, { VEHICULE_VIDE } from "../../components/ChampsVehicule";
import SelectProvince from "../../components/SelectProvince";
import { ChampAdresse, ChampVille, ChampCodePostal, remplisseurAdresse } from "../../components/ChampsAdresse";
import { useOrdreFiches } from "../../components/NavigationFiches";
import { libelleVehicule } from "@/lib/vehicules";
import { ligneVille, PROVINCE_DEFAUT } from "@/lib/adresse";
import { formaterTelephone } from "@/lib/telephone";
import { correspondRecherche } from "@/lib/recherche";
import { argent } from "@/lib/format";
import { Icone, TEINTES, CarteChiffre, GrilleChiffres, BoutonPlein, GroupeLiens, Panneau, Pastille } from "../../components/StyleSection";

// Clients affichés d'un coup, puis par tranche avec « Afficher plus » : des
// milliers de fiches à l'écran alourdissent la page, surtout sur cellulaire.
// La recherche et les filtres portent toujours sur tous les clients.
const TRANCHE = 100;

export default function ClientsClient({ clients, peutImporter }) {
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  const [nombreAffiches, setNombreAffiches] = useState(TRANCHE);
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [seulementSolde, setSeulementSolde] = useState(false);
  const [filtre, setFiltre] = useState("TOUS");

  const avecSolde = clients.filter((c) => c.soldeDu > 0.005);
  const totalARecevoir = avecSolde.reduce((s, c) => s + c.soldeDu, 0);

  const clientsFiltres = clients.filter((c) => {
    if (seulementSolde && !(c.soldeDu > 0.005)) return false;
    if (!FILTRES[filtre].garde(c)) return false;
    const q = recherche.trim().toLowerCase();
    if (!q) return true;
    const champs = [
      c.nom, c.telephone, c.courriel, c.adresse, c.ville, c.province, c.codePostal,
      ...c.vehicules.flatMap((v) => [v.plaque, v.niv, libelleVehicule(v)]),
    ];
    return correspondRecherche(q, champs);
  });
  useOrdreFiches("clients", clientsFiltres.map((c) => c.id));

  const avecVehicule = clients.filter((c) => c.vehicules.length > 0).length;
  const avecGarantie = clients.filter((c) => c.garantieProlongee).length;

  return (
    <div className="conteneur-page">
      <BandeauSection icone="🧑‍🤝‍🧑" titre="Clients" sousTitre="Touche un client pour voir sa fiche complète — coordonnées, bons de commande, soumissions." />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <BoutonPlein icone={afficherFormulaire ? null : "utilisateurPlus"} onClick={() => setAfficherFormulaire((v) => !v)}>
          {afficherFormulaire ? "Annuler" : "Nouveau client"}
        </BoutonPlein>
        {peutImporter && <BoutonImporterFichier apiUrl="/api/clients/importer" libelle="depuis Excel" libellePluriel="client" />}
      </div>

      {afficherFormulaire && (
        <div style={{ marginBottom: 14 }}>
          <FormulaireCreation onCree={() => { setAfficherFormulaire(false); router.refresh(); }} />
        </div>
      )}

      <GrilleChiffres>
        <CarteChiffre
          titre="À recevoir" montant={argent(totalARecevoir)}
          couleur={avecSolde.length > 0 ? "var(--danger)" : "var(--success)"} teinte={avecSolde.length > 0 ? "var(--danger)" : "var(--success)"}
          actif={seulementSolde}
          onClick={avecSolde.length > 0 ? () => { setSeulementSolde((v) => !v); setNombreAffiches(TRANCHE); } : undefined}
          note={avecSolde.length === 0
            ? "Aucune facture impayée"
            : `De ${avecSolde.length} client${avecSolde.length > 1 ? "s" : ""} · ${seulementSolde ? "touche pour voir tous les clients" : "touche pour ne voir qu'eux"}`}
        />
        <CarteChiffre
          titre="Clients" montant={String(clients.length)} teinte="var(--bleu)"
          note={`${avecVehicule} avec véhicule${avecGarantie > 0 ? ` · ${avecGarantie} avec garantie prolongée` : ""}`}
        />
      </GrilleChiffres>

      <GroupeLiens
        titre="Rapports" teinte={TEINTES.vert}
        liens={[
          { href: "/gerant/comptabilite/rapports/comptes-clients", target: "_blank", icone: "banque", label: "Comptes à recevoir", detail: "Soldes dus par client et par âge" },
          { href: "/gerant/comptabilite/rapports/clients", target: "_blank", icone: "imprimante", label: "Liste des clients", detail: "PDF, Excel ou imprimer" },
        ]}
      />

      <Panneau titre={seulementSolde ? "Clients avec un solde" : "Clients"}>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex" }}>
            <Icone nom="loupe" taille={18} couleur="var(--text-muted)" />
          </span>
          <input
            value={recherche}
            onChange={(e) => { setRecherche(e.target.value); setNombreAffiches(TRANCHE); }}
            placeholder="Nom, ville, téléphone, courriel, plaque, NIV, véhicule…"
            style={{ ...champStyle, marginBottom: 0, padding: "11px 12px 11px 40px", fontSize: 14, borderRadius: 12 }}
          />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: 4, borderRadius: 12, background: "var(--bg)", marginBottom: 14 }}>
          {Object.entries(FILTRES).map(([cle, f]) => (
            <FiltrePill key={cle} actif={filtre === cle} onClick={() => { setFiltre(cle); setNombreAffiches(TRANCHE); }} label={f.label} nombre={clients.filter(f.garde).length} />
          ))}
        </div>

        {clientsFiltres.length > 0 && (
          <div style={{ display: "flex", padding: "0 6px 8px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", borderBottom: "2px solid var(--accent)" }}>
            <span style={{ flex: 1 }}>{clientsFiltres.length} client{clientsFiltres.length > 1 ? "s" : ""}</span>
            <span>Dossier</span>
          </div>
        )}
        {clientsFiltres.slice(0, nombreAffiches).map((c, i) => (
          <Link key={c.id} href={`/secretaire/clients/${c.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 6px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                background: c.soldeDu > 0.005 ? "var(--danger-fond)" : "rgba(232,163,61,0.16)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800,
                color: c.soldeDu > 0.005 ? "var(--danger)" : "var(--accent-ombre)",
              }}>
                {c.nom.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.nom}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.numero && <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>#{c.numero}{" · "}</span>}
                  {[c.telephone, c.adresse, ligneVille(c)].filter(Boolean).join(" · ") || "Aucune coordonnée"}
                </div>
                {(c.soldeDu > 0.005 || c.garantieProlongee) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 5 }}>
                    {c.soldeDu > 0.005 && <Pastille couleur="var(--danger)" fond="var(--danger-fond)">{argent(c.soldeDu)} dû</Pastille>}
                    {c.garantieProlongee && <Pastille couleur="var(--bleu)" fond="var(--bleu-fond)">Garantie prolongée</Pastille>}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0, fontSize: 12, color: "var(--text-muted)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Icone nom="presse" taille={14} /> {c._count.bons} bon{c._count.bons !== 1 ? "s" : ""}
                </span>
                {c.vehicules.length > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Icone nom="vehicule" taille={14} /> {c.vehicules.length}
                  </span>
                )}
              </div>
              <Icone nom="chevron" taille={18} couleur="var(--text-muted)" />
            </div>
          </Link>
        ))}
        {clientsFiltres.length > nombreAffiches && (
          <button
            onClick={() => setNombreAffiches((n) => n + TRANCHE)}
            style={{ width: "100%", marginTop: 10, padding: 11, borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
          >
            Afficher plus — {clientsFiltres.length - nombreAffiches} autre{clientsFiltres.length - nombreAffiches > 1 ? "s" : ""}
          </button>
        )}
        {clientsFiltres.length === 0 && clients.length > 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>{recherche ? `Aucun client ne correspond à « ${recherche} ».` : "Aucun client pour ce filtre."}</p>
        )}
        {clients.length === 0 && !afficherFormulaire && (
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
            Aucun client encore — ajoute-en un avec « Nouveau client », ou démarre un{" "}
            <Link href="/secretaire/nouveau" style={{ color: "var(--accent-ombre)", fontWeight: 700 }}>nouveau bon de travail</Link>.
          </p>
        )}
      </Panneau>
    </div>
  );
}

// Filtres de la liste : clients qui ont déjà eu des bons, qui ont un
// véhicule au dossier, ou les deux
const FILTRES = {
  TOUS: { label: "Tous", garde: () => true },
  BONS: { label: "Avec bons", garde: (c) => c._count.bons > 0 },
  VEHICULE: { label: "Avec véhicule", garde: (c) => c.vehicules.length > 0 },
  LES_DEUX: { label: "Les deux", garde: (c) => c._count.bons > 0 && c.vehicules.length > 0 },
};

function FiltrePill({ actif, onClick, label, nombre }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: actif ? 700 : 600,
        padding: "8px 14px", borderRadius: 9, whiteSpace: "nowrap", cursor: "pointer", border: "none",
        background: actif ? "var(--surface)" : "transparent", color: actif ? "var(--text)" : "var(--text-muted)",
        boxShadow: actif ? "0 1px 3px rgba(0,0,0,0.10)" : "none",
      }}
    >
      {label}
      <span style={{ fontSize: 11.5, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: actif ? "rgba(232,163,61,0.18)" : "var(--surface-alt)", color: actif ? "var(--accent-ombre)" : "var(--text-muted)" }}>{nombre}</span>
    </button>
  );
}

function FormulaireCreation({ onCree }) {
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [courriel, setCourriel] = useState("");
  const [adresse, setAdresse] = useState("");
  const [ville, setVille] = useState("");
  const [province, setProvince] = useState(PROVINCE_DEFAUT);
  const [codePostal, setCodePostal] = useState("");
  const [garantieProlongee, setGarantieProlongee] = useState("");
  const [vehicule, setVehicule] = useState(VEHICULE_VIDE);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const remplir = remplisseurAdresse({ ville, setAdresse, setVille, setProvince, setCodePostal });

  async function creer(e, confirmerDoublon = false) {
    e?.preventDefault();
    setErreur("");
    setEnCours(true);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, telephone, courriel, adresse, ville, province, codePostal, garantieProlongee, vehicule, confirmerDoublon }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      // Homonyme ou même téléphone/courriel : créer quand même sur confirmation
      if (data.doublonPossible && window.confirm(`${data.erreur}\n\nCréer quand même un nouveau client ?`)) {
        return creer(null, true);
      }
      setErreur(data.erreur || "Erreur lors de la création.");
      return;
    }
    onCree();
  }

  return (
    <form onSubmit={creer} className="carte" style={{ marginBottom: 4 }}>
      <input required placeholder="Nom complet" value={nom} onChange={(e) => setNom(e.target.value)} style={champStyle} />
      <input placeholder="Téléphone" value={telephone} type="tel" onChange={(e) => setTelephone(e.target.value)} onBlur={(e) => setTelephone(formaterTelephone(e.target.value))} style={champStyle} />
      <input placeholder="Courriel" type="email" value={courriel} onChange={(e) => setCourriel(e.target.value)} style={champStyle} />
      <ChampAdresse placeholder="Adresse" valeur={adresse} onChange={setAdresse} onChoisir={remplir.onChoisir} style={champStyle} />
      <ChampVille placeholder="Ville" valeur={ville} onChange={setVille} codePostal={codePostal} style={champStyle} />
      <div style={{ display: "flex", gap: 8 }}>
        <SelectProvince valeur={province} onChange={setProvince} style={{ ...champStyle, flex: 1 }} />
        <ChampCodePostal placeholder="Code postal" valeur={codePostal} onChange={setCodePostal} onSecteur={remplir.onSecteur} style={{ ...champStyle, width: 110 }} />
      </div>
      <input
        placeholder="Garantie prolongée — numéro de contrat (optionnel)"
        value={garantieProlongee}
        onChange={(e) => setGarantieProlongee(e.target.value)}
        style={champStyle}
      />
      <div className="titre-section" style={{ marginTop: 10 }}>🚗 Véhicule (optionnel — d'autres pourront s'ajouter à la fiche)</div>
      <ChampsVehicule valeur={vehicule} onChange={setVehicule} />
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>{erreur}</p>}
      <button type="submit" disabled={enCours} className="bouton-3d" style={{ width: "100%", marginTop: 8, padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
        {enCours ? "Création…" : "Créer le client"}
      </button>
    </form>
  );
}

const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
