import { redirect } from "next/navigation";

// Généralisée par compte de trésorerie et déplacée sous Caisse & Banque —
// gardé ici seulement pour ne pas casser un lien existant.
export default function Rapprochement() {
  redirect("/gerant/comptabilite/caisse-banque/rapprochement");
}
