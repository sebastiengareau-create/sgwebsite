import BandeauBatiments from "../components/BandeauBatiments";

// Bandeau violet des écrans de l'Immobilier (app/components/BandeauBatiments.js)
export default function BandeauImmo(props) {
  return <BandeauBatiments {...props} variante="immobilier" />;
}
