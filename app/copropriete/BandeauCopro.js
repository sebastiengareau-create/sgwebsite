import BandeauBatiments from "../components/BandeauBatiments";

// Bandeau bleu des écrans de la Copropriété (app/components/BandeauBatiments.js)
export default function BandeauCopro(props) {
  return <BandeauBatiments {...props} variante="copropriete" />;
}
