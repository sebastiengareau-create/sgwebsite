import { obtenirInfosEntreprise } from "@/lib/config";

// Même raison que layout.js — évite la pré-génération au build
export const dynamic = "force-dynamic";

export default async function manifest() {
  const { nomEntreprise } = await obtenirInfosEntreprise();
  return {
    name: nomEntreprise,
    short_name: nomEntreprise,
    description: "Gestion de garage — bons de travail, horodateur, inventaire, facturation",
    start_url: "/",
    display: "standalone",
    background_color: "#17150f",
    theme_color: "#17150f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
