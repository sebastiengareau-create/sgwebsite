import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import EnTete from "../../../components/EnTete";
import BandeauSection from "../../../components/BandeauSection";
import { Icone, TEINTES, TitrePanneau, stylePanneau, BoutonContour, TitreGroupe, Pastille } from "../../../components/StyleSection";

const ETAPES = [
  {
    numero: 1,
    titre: "Écritures supplémentaires",
    obligatoire: false,
    description: "Ajoute toute écriture manquante pour que tes livres reflètent exactement ce qui apparaît sur ton relevé de banque — frais bancaires, intérêts, corrections, dépenses oubliées, etc.",
    lien: { href: "/gerant/comptabilite/ecriture-manuelle", label: "✍️ Écriture supplémentaire" },
  },
  {
    numero: 2,
    titre: "Rapprochement bancaire",
    obligatoire: false,
    description: "Coche chaque écriture du compte Banque qui apparaît sur ton relevé, puis entre le solde du relevé. Ça révèle ce qui est vraiment passé en banque par rapport à ce qui reste « en circulation » (chèque ou dépôt pas encore traité par la banque). Le plus rapide : importe d'abord le fichier de ta banque dans 📥 Transactions bancaires — tout ce qui y est relié arrive coché.",
    lien: { href: "/gerant/comptabilite/rapprochement", label: "🏦 Rapprochement bancaire" },
  },
  {
    numero: 3,
    titre: "Amortissement du mois",
    obligatoire: true,
    obligatoireSi: "seulement si tu as des immobilisations actives",
    description: "Si tu as de l'équipement immobilisé, comptabilise l'amortissement du mois. Le logiciel bloque la fermeture du mois tant que ce n'est pas fait, dès qu'une immobilisation active existe.",
    lien: { href: "/gerant/comptabilite/immobilisations", label: "🏗️ Immobilisations" },
  },
  {
    numero: 4,
    titre: "Paie complétée",
    obligatoire: true,
    description: "Assure-toi qu'aucun lot de paie du mois n'est encore en brouillon. Le logiciel bloque la fermeture du mois tant qu'il reste un brouillon.",
    lien: { href: "/gerant/paie", label: "🧾 Paie" },
  },
  {
    numero: 5,
    titre: "Remises gouvernementales",
    obligatoire: false,
    description: "Comptabilise le paiement de la TPS/TVQ et des DAS (impôts, RRQ, RQAP, AE) dus pour le mois. Pas vérifié par le logiciel pour fermer, mais garde tes comptes à jour et évite les surprises au mois suivant.",
    lien: { href: "/gerant/comptabilite/remise-gouvernementale", label: "🏛️ Remise gouvernementale" },
  },
  {
    numero: 6,
    titre: "Vérifier et fermer le mois",
    obligatoire: false,
    description: "Ouvre l'assistant de fermeture du mois concerné : il affiche la checklist (obligatoires + informatifs) et un résumé (revenus, dépenses, bénéfice net, TPS/TVQ à remettre, comptes clients/fournisseurs, solde bancaire). Une fois la checklist à 100 %, verrouille (optionnel, réversible) ou ferme le mois.",
    lien: { href: "/gerant/comptabilite/fermeture", label: "🔒 Fermeture de période" },
  },
];

export default async function ProcedureFermeture() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const moduleComptabilite = await prisma.parametre.findUnique({ where: { cle: "module_comptabilite" } });
  if (moduleComptabilite?.valeur === "inactif") redirect("/gerant");

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <div className="conteneur-page">
        <Link href="/gerant/comptabilite" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à la comptabilité</Link>
        <div style={{ marginTop: 8 }}>
          <BandeauSection icone="📋" titre="Procédure de fermeture" sousTitre="L'ordre recommandé pour fermer un mois comptable proprement." />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          <BoutonContour href="/gerant/comptabilite/fermeture" icone="cadenas" style={{ flex: "1 1 200px", justifyContent: "center" }}>Fermeture de période</BoutonContour>
        </div>

        <div style={{ ...stylePanneau, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <Pastille couleur="var(--danger)" fond="var(--danger-fond)">Obligatoire</Pastille>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Vérifiée automatiquement : le mois ne se ferme pas tant qu'elle n'est pas faite.</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <Pastille couleur="var(--accent-ombre)" fond="rgba(232,163,61,0.14)">Recommandée</Pastille>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Fortement conseillée, mais pas imposée.</span>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "4px 0 0", fontStyle: "italic" }}>
            Rien n'empêche un autre ordre — celui-ci évite les allers-retours (ex : rapprocher la banque avant d'avoir ajouté les
            écritures manquantes veut souvent dire recommencer).
          </p>
        </div>

        <TitreGroupe couleur="var(--accent)">{`${ETAPES.length} étapes`}</TitreGroupe>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {ETAPES.map((e) => {
            const couleur = e.obligatoire ? "var(--danger)" : "var(--accent)";
            return (
              <div key={e.numero} style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "14px 16px 14px 20px" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: couleur }} />
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: e.obligatoire ? "var(--danger-fond)" : "rgba(232,163,61,0.16)",
                    color: e.obligatoire ? "var(--danger)" : "var(--accent-ombre)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800,
                  }}>
                    {e.numero}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{e.titre}</span>
                      {e.obligatoire
                        ? <Pastille couleur="var(--danger)" fond="var(--danger-fond)">Obligatoire</Pastille>
                        : <Pastille couleur="var(--accent-ombre)" fond="rgba(232,163,61,0.14)">Recommandée</Pastille>}
                    </div>
                    {e.obligatoire && e.obligatoireSi && (
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--danger)", marginBottom: 4 }}>{e.obligatoireSi.charAt(0).toUpperCase() + e.obligatoireSi.slice(1)}</div>
                    )}
                    <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "0 0 10px" }}>{e.description}</p>
                    <Link
                      href={e.lien.href}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: "none", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
                    >
                      {e.lien.label} <Icone nom="chevron" taille={15} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={stylePanneau}>
          <TitrePanneau icone="cadenas" teinte={TEINTES.bleu} titre="Après la fermeture" />
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: 0 }}>
            « 🟡 Verrouiller » empêche de modifier les écritures existantes du mois, mais accepte encore de nouvelles
            écritures datées dans ce mois — utile pour un premier arrêt pendant que tu termines le reste. « 🔴 Fermer »
            bloque tout, définitivement, sauf réouverture. Une réouverture reste possible en tout temps (gérant
            seulement), avec un motif obligatoire, consigné dans l'historique — voir « Fermeture de période → Historique ».
          </p>
        </div>
      </div>
    </div>
  );
}
