import EnTete from "../../components/EnTete";
import { lireLocateur } from "@/lib/locateurImmo";
import { exigerAccesImmo } from "../acces";
import LocateurClient from "./LocateurClient";

export default async function LocateurImmo() {
  const session = await exigerAccesImmo();
  const locateur = await lireLocateur();
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <LocateurClient locateur={locateur} />
    </div>
  );
}
