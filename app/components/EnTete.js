import Image from "next/image";
import { obtenirInfosEntreprise } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection, nomAffichageRole } from "@/lib/auth";
import MenuHamburger from "./MenuHamburger";

// Chaque section "empruntable" (configurable dans Administrateur → Rôles et
// accès), avec son lien et son icône — évite de dupliquer cette liste dans
// chaque bloc de rôle séparément.
const SECTIONS_EMPRUNTABLES = [
  { cle: "operations", href: "/secretaire", label: "Bons de commande / Factures", icone: "🔧" },
  { cle: "calendrier", href: "/secretaire/calendrier", label: "Calendrier", icone: "📅", moduleParam: "module_calendrier" },
  { cle: "clients", href: "/secretaire/clients", label: "Clients", icone: "🧑‍🤝‍🧑" },
  { cle: "inventaire", href: "/secretaire/inventaire", label: "Inventaire", icone: "📦" },
  { cle: "comptabilite", href: "/gerant/comptabilite", label: "Comptabilité", icone: "💰", moduleParam: "module_comptabilite" },
  { cle: "paie", href: "/gerant/paie", label: "Paie", icone: "🧾", moduleParam: "module_paie", moduleActifSeulementSi: "actif" },
];

export default async function EnTete({ nom, role }) {
  const labelRole = await nomAffichageRole(role);
  const { nomEntreprise } = await obtenirInfosEntreprise();
  const session = await obtenirSession();

  const parametres = await prisma.parametre.findMany({
    where: { cle: { in: ["module_calendrier", "module_comptabilite", "module_paie"] } },
  });
  const dictModules = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));

  function moduleActif(section) {
    if (!section.moduleParam) return true;
    if (section.moduleActifSeulementSi) return dictModules[section.moduleParam] === section.moduleActifSeulementSi;
    return dictModules[section.moduleParam] !== "inactif";
  }

  let estSuperAdmin = role === "DEVELOPPEUR";
  if (!estSuperAdmin && session?.id) {
    const utilisateur = await prisma.user.findUnique({ where: { id: session.id }, select: { estSuperAdmin: true } });
    estSuperAdmin = utilisateur?.estSuperAdmin || false;
  }

  const liens = [];
  if (estGerantOuDev(session)) {
    liens.push({ href: "/gerant", label: "Vue d'ensemble", icone: "📊" });
    liens.push({ href: "/gerant/employes", label: "Employés", icone: "👥" });
  }
  if (role === "MECANICIEN" || estGerantOuDev(session)) {
    liens.push({ href: "/mecanicien", label: "Horodateur", icone: "⏱️" });
  }

  // Sections empruntables — vérifiées une par une via le même système que
  // les pages elles-mêmes utilisent, pour que le menu corresponde toujours
  // exactement à ce que la personne peut vraiment ouvrir
  for (const section of SECTIONS_EMPRUNTABLES) {
    if (!moduleActif(section)) continue;
    if (await aAccesSection(session, section.cle)) {
      liens.push({ href: section.href, label: section.label, icone: section.icone });
    }
  }

  if (estGerantOuDev(session)) {
    liens.push({ href: "/gerant/rapports", label: "Rapports", icone: "📈" });
    liens.push({ href: "/gerant/parametres", label: "Paramètres", icone: "⚙️" });
  }
  if (estSuperAdmin) liens.push({ href: "/gerant/administrateur", label: "Administrateur", icone: "🛡️", accent: true });

  return (
    <div style={{ borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 20, background: "var(--bg)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <MenuHamburger liens={liens} />
          <Image src="/logo.png" alt={nomEntreprise} width={34} height={34} style={{ objectFit: "contain" }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{nom}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{labelRole}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
