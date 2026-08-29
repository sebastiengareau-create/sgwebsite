import { redirect } from "next/navigation";
import { obtenirSession, estGerantOuDev } from "@/lib/auth";
import { obtenirInfosEntreprise } from "@/lib/config";
import EnTete from "../../../components/EnTete";
import InfosEntrepriseClient from "./InfosEntrepriseClient";

export default async function InfosEntreprise() {
  const session = await obtenirSession();
  if (!estGerantOuDev(session)) redirect("/gerant");

  const infos = await obtenirInfosEntreprise();

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <InfosEntrepriseClient infosInit={infos} />
    </div>
  );
}
