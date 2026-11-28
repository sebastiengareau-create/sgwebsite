// Bandeau d'en-tête réutilisé en haut de chaque section principale du menu
// (Paie, Calendrier, Bons de commande, Clients, Fournisseurs, Inventaire,
// Comptabilité, Employés, Rapports) — aux couleurs et à la silhouette de la
// déclinaison de l'installation (secteurMarque du profil) : atelier orange
// du garage, VR dorés du Premium, grange de la Ferme, plex de l'Immobilier,
// tours de la Copropriété (app/components/BandeauBatiments.js).
import { CLIENT } from "@/lib/client";
import BandeauBatiments from "./BandeauBatiments";

const VARIANTES = { garage: "garage", premium: "premium", ferme: "ferme", immobilier: "immobilier", copropriete: "copropriete" };

export default function BandeauSection(props) {
  return <BandeauBatiments {...props} variante={VARIANTES[CLIENT.secteurMarque] || "garage"} />;
}
