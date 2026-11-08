"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BandeauSection from "../../components/BandeauSection";
import { BoutonPlein, Pastille } from "../../components/StyleSection";
import { correspondRecherche } from "@/lib/recherche";
import { pourcent } from "@/lib/coproprieteCalculs";
import { NavCopro, Formulaire, Recherche, CarteListe, Vide } from "../ui";

export const champsCoproprietaire = [
  { nom: "nom", label: "Nom (ou raison sociale)" },
  { nom: "courriel", label: "Courriel", typeHtml: "email" },
  { nom: "telephone", label: "Téléphone", typeHtml: "tel" },
  { nom: "telephone2", label: "Autre téléphone", typeHtml: "tel" },
  { nom: "adressePostale", label: "Adresse postale (si n'habite pas l'unité)", pleineLargeur: true },
  { nom: "avisCourriel", label: "Reçoit par courriel le suivi de ses demandes", type: "case", defaut: true },
  { nom: "notes", label: "Notes", type: "long", lignes: 2 },
];

// Quote-part détenue : celle de chaque unité, selon sa part (indivision)
export const quotePartDetenue = (proprietes) => proprietes.reduce((s, p) => s + (p.unite.quotePart || 0) * (p.partDetenue / 100), 0);

export default function CoproprietairesClient({ coproprietaires }) {
  const router = useRouter();
  const [formulaire, setFormulaire] = useState(false);
  const [recherche, setRecherche] = useState("");
  const q = recherche.trim().toLowerCase();
  const affiches = coproprietaires.filter((c) => !q || correspondRecherche(q, c.nom, c.courriel, c.telephone, ...c.proprietes.map((p) => p.unite.numero)));
  return (
    <div className="conteneur-page">
      <BandeauSection icone="👥" titre="Copropriétaires" sousTitre="Coordonnées, fractions détenues, quote-part et accès au portail." />
      <NavCopro actif="/copropriete/coproprietaires" />
      <div style={{ marginBottom: 14 }}>
        <BoutonPlein icone={formulaire ? null : "plus"} onClick={() => setFormulaire((v) => !v)}>{formulaire ? "Annuler" : "Nouveau copropriétaire"}</BoutonPlein>
      </div>
      {formulaire && <Formulaire champs={champsCoproprietaire} initial={{ avisCourriel: true }} url="/api/copropriete/coproprietaires" bouton="Ajouter" onFini={(d) => router.push(`/copropriete/coproprietaires/${d.id}`)} />}
      <Recherche valeur={recherche} onChange={setRecherche} placeholder="Nom, courriel, téléphone, unité…" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {affiches.map((c) => {
          const actif = c.proprietes.length > 0;
          return (
            <CarteListe
              key={c.id} href={`/copropriete/coproprietaires/${c.id}`} couleur={actif ? "var(--success)" : "var(--border)"}
              titre={c.nom}
              sousTitre={[c.telephone, c.courriel].filter(Boolean).join(" · ") || "Aucune coordonnée"}
              bas={<>
                {c.proprietes.map((p) => <Pastille key={p.unite.id} couleur="var(--bleu)" fond="var(--bleu-fond)">Unité {p.unite.numero}{p.partDetenue < 100 ? ` (${pourcent(p.partDetenue, 0)})` : ""}</Pastille>)}
                {!actif && <Pastille couleur="var(--text-muted)" fond="var(--surface-alt)">Ancien copropriétaire</Pastille>}
                {c.portail && <Pastille couleur="var(--success)" fond="var(--success-fond)">🌐 Portail</Pastille>}
              </>}
              droite={actif && <>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{pourcent(quotePartDetenue(c.proprietes))}</div>
                <div style={{ color: "var(--text-muted)" }}>{c.proprietes.length} fraction{c.proprietes.length > 1 ? "s" : ""}</div>
              </>}
            />
          );
        })}
        {affiches.length === 0 && <Vide>Aucun copropriétaire.</Vide>}
      </div>
    </div>
  );
}
