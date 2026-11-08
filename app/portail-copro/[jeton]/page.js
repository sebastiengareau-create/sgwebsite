import { prisma } from "@/lib/prisma";
import { obtenirInfosEntreprise } from "@/lib/config";
import { coproprietaireParJeton, filtreDocumentsVisibles } from "@/lib/copropriete";
import PortailClient from "./PortailClient";

// Portail d'un copropriétaire (module Copropriété) : page publique, protégée
// par le lien secret qui lui est propre (Copropriété → sa fiche → Portail).
// Jamais indexée par les moteurs de recherche.
export const metadata = { robots: { index: false, follow: false } };

export default async function PortailCopro(props) {
  const { jeton } = await props.params;
  const entreprise = await obtenirInfosEntreprise();
  const c = await coproprietaireParJeton(jeton);
  if (!c) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "var(--bg)" }}>
        <div className="carte" style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 19, margin: "0 0 10px" }}>{entreprise.nomEntreprise}</h1>
          <p style={{ fontSize: 14, margin: 0 }}>Ce lien n'est plus valide. Demandez un nouveau lien à l'administration{entreprise.telephone ? ` (${entreprise.telephone})` : ""}.</p>
        </div>
      </div>
    );
  }

  // Dernière visite, notée au plus une fois l'heure
  if (!c.dernierAccesPortail || Date.now() - c.dernierAccesPortail.getTime() > 3600000) {
    await prisma.coproprietaireCopro.update({ where: { id: c.id }, data: { dernierAccesPortail: new Date() } });
  }

  const proprietes = await prisma.proprieteCopro.findMany({
    where: { coproprietaireId: c.id, dateFin: null },
    include: {
      unite: {
        select: {
          id: true, numero: true, type: true, quotePart: true, etage: true,
          batiment: { select: { nom: true } },
          espaces: { select: { id: true, type: true, numero: true, emplacement: true } },
          charges: { select: { id: true, date: true, type: true, description: true, montant: true } },
          paiements: { select: { id: true, date: true, montant: true, mode: true, reference: true } },
        },
      },
    },
  });
  const uniteIds = proprietes.map((p) => p.unite.id);
  const [documents, demandes, batiments] = await Promise.all([
    prisma.documentCopro.findMany({
      where: filtreDocumentsVisibles(uniteIds),
      select: { id: true, titre: true, categorie: true, date: true, description: true, visibilite: true, nom: true, taille: true, creeLe: true, unite: { select: { numero: true } } },
      orderBy: [{ date: { sort: "desc", nulls: "last" } }, { creeLe: "desc" }],
    }),
    prisma.demandeCopro.findMany({
      where: { coproprietaireId: c.id },
      select: {
        id: true, numero: true, type: true, titre: true, description: true, statut: true, priorite: true, emplacement: true, reponse: true, creeLe: true,
        unite: { select: { numero: true } },
        fichiers: { select: { id: true, nom: true, typeMime: true, taille: true } },
        travaux: { select: { statut: true, datePrevue: true, suivis: { where: { public: true }, select: { id: true, date: true, texte: true }, orderBy: { date: "desc" } } } },
      },
      orderBy: { creeLe: "desc" },
    }),
    prisma.batimentCopro.count(),
  ]);

  return (
    <PortailClient
      jeton={jeton}
      coproprietaire={{ nom: c.nom }}
      entreprise={{ nom: entreprise.nomEntreprise, telephone: entreprise.telephone, courriel: entreprise.courriel }}
      {...JSON.parse(JSON.stringify({ proprietes, documents, demandes }))}
      plusieursBatiments={batiments > 1}
    />
  );
}
