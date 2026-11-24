import { notFound } from "next/navigation";
import EnTete from "../../../components/EnTete";
import { etatLieuxComplet } from "@/lib/etatsLieux";
import { exigerAccesImmo, simple } from "../../acces";
import EtatLieuxClient from "./EtatLieuxClient";

// État des lieux numérique d'un bail (lib/etatsLieux.js), à remplir sur place
export default async function EtatLieux(props) {
  const { id } = await props.params;
  const session = await exigerAccesImmo();
  const donnees = await etatLieuxComplet(id);
  if (!donnees) notFound();
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <EtatLieuxClient {...simple(donnees)} courriel={Boolean(process.env.RESEND_API_KEY)} />
    </div>
  );
}
