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

export const viewport = {
  themeColor: "#17150f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

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

  return (
    <html lang="fr">
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
