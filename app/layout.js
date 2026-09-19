import { obtenirInfosEntreprise } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import AssistantSG from "./components/AssistantSG";
import "./globals.css";

// Obligatoire — sinon Next.js essaie de générer cette page (et les
// métadonnées) pendant le build, avant que la base de données soit
// accessible, ce qui fait planter le déploiement.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { nomEntreprise, descriptionCourte } = await obtenirInfosEntreprise();
  return {
    title: nomEntreprise,
    description: descriptionCourte,
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: nomEntreprise,
    },
    icons: {
      icon: [
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
  };
}

// Affichage propre à chaque employé (réglé par un gérant dans sa fiche). Le
// développeur n'a pas de fiche employé (voir lib/auth.js) — son affichage
// vit à part, dans Parametre (réglable dans Administrateur → Affichage).
async function obtenirPreferencesAffichage(session) {
  const defaut = { theme: "sombre", tailleTexte: "normal" };
  if (!session) return defaut;
  if (session.role === "DEVELOPPEUR") {
    const parametres = await prisma.parametre.findMany({ where: { cle: { in: ["theme_developpeur", "taille_texte_developpeur"] } } });
    const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
    return {
      theme: dict.theme_developpeur === "clair" ? "clair" : "sombre",
      tailleTexte: dict.taille_texte_developpeur === "grand" ? "grand" : "normal",
    };
  }
  const utilisateur = await prisma.user.findUnique({ where: { id: session.id }, select: { theme: true, tailleTexte: true } });
  return {
    theme: utilisateur?.theme === "clair" ? "clair" : "sombre",
    tailleTexte: utilisateur?.tailleTexte === "grand" ? "grand" : "normal",
  };
}

export async function generateViewport() {
  const session = await obtenirSession();
  const { theme } = await obtenirPreferencesAffichage(session);
  return {
    themeColor: theme === "clair" ? "#f6f4ee" : "#17150f",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  };
}

export default async function RootLayout({ children }) {
  // Vérifié à cet endroit unique — couvre absolument toutes les pages d'un
  // coup, sans avoir à toucher chaque route individuellement. Le rôle
  // DEVELOPPEUR n'est jamais bloqué (sinon personne ne pourrait débloquer).
  const session = await obtenirSession();
  let verrouille = false;
  if (session && session.role !== "DEVELOPPEUR") {
    const parametre = await prisma.parametre.findUnique({ where: { cle: "compte_verrouille" } });
    verrouille = parametre?.valeur === "actif";
  }

  const { theme, tailleTexte } = await obtenirPreferencesAffichage(session);

  return (
    <html lang="fr" data-theme={theme === "clair" ? "light" : "dark"} data-taille={tailleTexte === "grand" ? "grand" : "normal"}>
      <body>
        {verrouille ? <EcranVerrouille /> : children}
        {!verrouille && session && <AssistantSG />}
      </body>
    </html>
  );
}

function EcranVerrouille() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "var(--bg)" }}>
      <div style={{ maxWidth: 340, width: "100%", background: "var(--surface)", border: "1px solid var(--danger)", borderRadius: 16, padding: 28, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <h1 style={{ fontSize: 18, marginBottom: 10, color: "var(--text)" }}>Accès suspendu</h1>
        <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 18 }}>
          L'accès à ce logiciel a été temporairement suspendu. Merci de contacter :
        </p>
        <a
          href="mailto:info@sgwebsite.online"
          style={{ display: "inline-block", padding: "12px 20px", borderRadius: 10, background: "var(--accent)", color: "#17150f", fontWeight: 700, fontSize: 14, textDecoration: "none" }}
        >
          info@sgwebsite.online
        </a>
      </div>
    </div>
  );
}
