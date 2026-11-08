import Image from "next/image";
import { obtenirInfosEntreprise } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection, nomAffichageRole } from "@/lib/auth";
import MenuHamburger from "./MenuHamburger";
import { versionEnLigne } from "@/lib/version";
import BarreLaterale from "./BarreLaterale";
import MinuteurInactivite from "./MinuteurInactivite";
import Cloche from "./Cloche";
import AssistantSG from "./AssistantSG";
import { image } from "@/lib/client";
import { STATUTS_ACTIFS } from "@/lib/statutsEnvoi";
import { destinatairesPermis } from "@/lib/documentsServeur";

// Chaque section "empruntable" (configurable dans Administrateur → Rôles et
// accès), avec son lien et son icône — évite de dupliquer cette liste dans
// chaque bloc de rôle séparément.
const SECTIONS_EMPRUNTABLES = [
  { cle: "vue-ensemble", href: "/gerant", label: "Vue d'ensemble", icone: "graphique", groupe: "Accueil" },
  { cle: "operations", href: "/secretaire", label: "Bons de commande / Factures", icone: "outils", groupe: "Opérations" },
  { cle: "calendrier", href: "/secretaire/calendrier", label: "Calendrier", icone: "calendrier", groupe: "Opérations", moduleParam: "module_calendrier" },
  { cle: "clients", href: "/secretaire/clients", label: "Clients", icone: "personne", groupe: "Opérations" },
  { cle: "jobs-deplacement", href: "/gerant/jobs-deplacement", label: "Jobs en déplacement", icone: "vehicule", groupe: "Opérations", moduleParam: "module_jobs_deplacement", moduleActifSeulementSi: "actif" },
  { cle: "horodateur", href: "/mecanicien", label: "Horodateur", icone: "horloge", groupe: "Opérations" },
  { cle: "inventaire", href: "/secretaire/inventaire", label: "Inventaire", icone: "boite", groupe: "Achats et stock" },
  { cle: "fournisseurs", href: "/gerant/fournisseurs", label: "Fournisseurs", icone: "immeuble", groupe: "Achats et stock" },
  { cle: "elevage", href: "/elevage", label: "Élevage", icone: "drapeau", groupe: "Achats et stock", moduleParam: "module_elevage", moduleActifSeulementSi: "actif" },
  { cle: "comptabilite", href: "/gerant/comptabilite", label: "Comptabilité", icone: "banque", groupe: "Finances", moduleParam: "module_comptabilite" },
  { cle: "paie", href: "/gerant/paie", label: "Paie", icone: "calculatrice", groupe: "Finances", moduleParam: "module_paie", moduleActifSeulementSi: "actif" },
  { cle: "employes", href: "/gerant/employes", label: "Employés", icone: "utilisateurs", groupe: "Équipe" },
  { cle: "jobs-temps-reel", href: "/gerant/rapports", label: "Productivité par employés", icone: "tendance", groupe: "Équipe" },
  { cle: "parametres", href: "/gerant/parametres", label: "Paramètres", icone: "reglages", groupe: "Configuration" },
];

export default async function EnTete({ nom, role }) {
  const labelRole = await nomAffichageRole(role);
  const { nomEntreprise } = await obtenirInfosEntreprise();
  const session = await obtenirSession();

  const parametres = await prisma.parametre.findMany({
    where: { cle: { in: ["module_calendrier", "module_comptabilite", "module_paie", "module_jobs_deplacement", "module_notifications", "module_elevage"] } },
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

  // Bons envoyés à cet employé (section « Jobs en déplacement ») — lien
  // offert à tous quand le module est actif, peu importe les sections :
  // c'est là aussi qu'on active les notifications, avant le premier envoi
  if (session?.id && session.role !== "DEVELOPPEUR" && dictModules.module_jobs_deplacement === "actif") {
    const nbMesTaches = await prisma.envoiBon.count({ where: { employeId: session.id, statut: { in: STATUTS_ACTIFS } } });
    liens.push({ href: "/mes-taches", label: "Mes tâches", icone: "presse", groupe: "Accueil", accent: nbMesTaches > 0, badge: nbMesTaches });
  }

  // Sections empruntables — vérifiées une par une via le même système que
  // les pages elles-mêmes utilisent, pour que le menu corresponde toujours
  // exactement à ce que la personne peut vraiment ouvrir
  for (const section of SECTIONS_EMPRUNTABLES) {
    if (!moduleActif(section)) continue;
    if (await aAccesSection(session, section.cle)) {
      liens.push({ href: section.href, label: section.label, icone: section.icone, groupe: section.groupe });
    }
  }

  // Documents (lettres aux employés ou aux clients) : section Documents,
  // avec Employés ou Clients — voir lib/documentsServeur.js
  if ((await destinatairesPermis(session)).length > 0) liens.push({ href: "/gerant/documents", label: "Documents", icone: "document", groupe: "Finances" });

  // Notifications (cloche 🔔) : tout employé, si le module est actif — le
  // développeur n'a pas de fiche employé, donc rien à recevoir
  const notificationsActives = dictModules.module_notifications !== "inactif";
  const estEmploye = notificationsActives && session?.id && session.role !== "DEVELOPPEUR";
  const nbNonLues = estEmploye ? await prisma.notification.count({ where: { employeId: session.id, lue: false } }) : 0;
  if (estEmploye || (notificationsActives && await aAccesSection(session, "notifications"))) liens.push({ href: "/notifications", label: "Notifications", icone: "cloche", groupe: "Accueil", badge: nbNonLues });

  if (estSuperAdmin) liens.push({ href: "/gerant/administrateur", label: "Administrateur", icone: "bouclier", groupe: "Configuration", accent: true });

  return (
    <div style={{ borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 20, background: "var(--bg)" }}>
      <MinuteurInactivite />
      <BarreLaterale liens={liens} nomEntreprise={nomEntreprise} version={versionEnLigne()} nom={nom} role={labelRole} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="cacher-sur-bureau">
            <MenuHamburger liens={liens} version={versionEnLigne()} nomEntreprise={nomEntreprise} nom={nom} role={labelRole} />
          </div>
          <Image src={image("logo.png")} alt={nomEntreprise} width={72} height={48} style={{ objectFit: "contain" }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{nom}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{labelRole}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AssistantSG />
          {estEmploye && <Cloche nonLuesInitial={nbNonLues} />}
        </div>
      </div>
    </div>
  );
}
