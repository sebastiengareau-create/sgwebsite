import BandeauBatiments from "../components/BandeauBatiments";

// Bandeau vert des écrans de l'Élevage (app/components/BandeauBatiments.js)
export default function BandeauFerme(props) {
  return <BandeauBatiments {...props} variante="ferme" />;
}
