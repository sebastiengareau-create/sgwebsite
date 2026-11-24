"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BandeauSection from "../../components/BandeauSection";
import { BoutonPlein } from "../../components/StyleSection";
import { correspondRecherche } from "@/lib/recherche";
import { argent, additionnerComptes } from "@/lib/immobilierCalculs";
import { NavImmo, Formulaire, Recherche, CarteListe, Vide, Onglets, champsLocataire, nomLogement, Solde } from "../ui";

const ONGLETS = [{ code: "ACTUELS", label: "Locataires actuels" }, { code: "ANCIENS", label: "Anciens" }, { code: "TOUS", label: "Tous" }];

export default function LocatairesClient({ locataires, comptes }) {
  const router = useRouter();
  const [formulaire, setFormulaire] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [onglet, setOnglet] = useState("ACTUELS");
  const q = recherche.trim().toLowerCase();
  const avecEtat = locataires.map((l) => {
    const actifs = l.baux.filter((b) => b.statut === "ACTIF");
    const compte = additionnerComptes(l.baux.map((b) => comptes[b.id]));
    return { ...l, actifs, compte, solde: compte.solde };
  });
  const affiches = avecEtat
    .filter((l) => onglet === "TOUS" || (onglet === "ACTUELS" ? l.actifs.length > 0 || l.baux.length === 0 : l.actifs.length === 0 && l.baux.length > 0))
    .filter((l) => !q || correspondRecherche(q, l.nom, l.courriel, l.telephone, ...l.baux.map((b) => `${b.logement.immeuble.nom} ${b.logement.numero}`)));
  return (
    <div className="conteneur-page">
      <BandeauSection icone="👥" titre="Locataires" sousTitre="Coordonnées, baux et compte de chaque locataire." />
      <NavImmo actif="/immobilier/locataires" />
      <div style={{ marginBottom: 14 }}>
        <BoutonPlein icone={formulaire ? null : "plus"} onClick={() => setFormulaire((v) => !v)}>{formulaire ? "Annuler" : "Nouveau locataire"}</BoutonPlein>
      </div>
      {formulaire && <Formulaire champs={champsLocataire} url="/api/immobilier/locataires" bouton="Ajouter le locataire" onFini={(d) => router.push(`/immobilier/locataires/${d.id}`)} />}
      <Onglets options={ONGLETS} valeur={onglet} onChange={setOnglet} />
      <Recherche valeur={recherche} onChange={setRecherche} placeholder="Nom, téléphone, immeuble…" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {affiches.map((l) => (
          <CarteListe
            key={l.id} href={`/immobilier/locataires/${l.id}`}
            couleur={l.compte.enRetard > 0.005 ? "var(--danger)" : l.actifs.length > 0 ? "var(--success)" : "var(--border)"}
            titre={l.nom}
            sousTitre={[
              l.actifs.map((b) => `${b.logement.immeuble.nom} · ${nomLogement(b.logement)}`).join(" ; ") || (l.baux.length ? "Ancien locataire" : "Aucun bail"),
              l.telephone,
            ].filter(Boolean).join(" · ")}
            droite={<>
              {l.actifs.length > 0 && <div style={{ fontSize: 15, fontWeight: 800 }}>{argent(l.actifs.reduce((s, b) => s + b.loyer, 0))}</div>}
              {Math.abs(l.solde) > 0.005 && <div><Solde solde={l.solde} compte={l.compte} /></div>}
            </>}
          />
        ))}
        {affiches.length === 0 && <Vide>Aucun locataire.</Vide>}
      </div>
    </div>
  );
}
