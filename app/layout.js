import { obtenirInfosEntreprise } from "@/lib/config";
import { lireParametre, lireParametres } from "@/lib/parametres";
import { obtenirSession, obtenirFicheSession, aAccesSection } from "@/lib/auth";
import BoutonFlottantNouveau from "./components/BoutonFlottantNouveau";
import "./globals.css";
import { image } from "@/lib/client";

// Obligatoire — sinon Next.js essaie de générer cette page (et les
// métadonnées) pendant le build, avant que la base de données soit
// accessible, ce qui fait planter le déploiement.
export const dynamic = "force-dynamic";

const SECTIONS_BOUTON = ["operations", "inventaire", "clients"];

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
        { url: image("icon-192.png"), sizes: "192x192", type: "image/png" },
        { url: image("icon-512.png"), sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: image("apple-touch-icon.png"), sizes: "180x180", type: "image/png" }],
    },
  };
}

// Affichage propre à chaque employé (réglé par un gérant dans sa fiche). Le
// développeur n'a pas de fiche employé (voir lib/auth.js) — son affichage
// vit à part, dans Parametre (réglable dans Administrateur → Affichage).
// La fiche et les réglages sont mémorisés le temps de la requête : rien n'est
// relu entre generateViewport et la mise en page.
async function obtenirPreferencesAffichage(session) {
  if (!session) return { theme: "clair", tailleTexte: "normal" };
  if (session.role === "DEVELOPPEUR") {
    const dict = await lireParametres(["theme_developpeur", "taille_texte_developpeur"]);
    return {
      theme: dict.theme_developpeur === "sombre" ? "sombre" : "clair",
      tailleTexte: dict.taille_texte_developpeur === "grand" ? "grand" : "normal",
    };
  }
  const utilisateur = await obtenirFicheSession(session);
  return {
    theme: utilisateur?.theme === "sombre" ? "sombre" : "clair",
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
  // En parallèle : verrou, affichage et sections du bouton « + »
  const [verrou, { theme, tailleTexte }, acces] = await Promise.all([
    session && session.role !== "DEVELOPPEUR" ? lireParametre("compte_verrouille") : undefined,
    obtenirPreferencesAffichage(session),
    // Sections permises pour le bouton « + » (soumission, bon, pièce, client)
    session ? Promise.all(SECTIONS_BOUTON.map((section) => aAccesSection(session, section))) : [],
  ]);
  const verrouille = verrou === "actif";
  const sectionsBouton = verrouille ? [] : SECTIONS_BOUTON.filter((_, i) => acces[i]);

  return (
    <html lang="fr" data-theme={theme === "clair" ? "light" : "dark"} data-taille={tailleTexte === "grand" ? "grand" : "normal"}>
      <body>
        {verrouille ? <EcranVerrouille /> : children}
        {!verrouille && session && <BoutonFlottantNouveau sections={sectionsBouton} />}
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
