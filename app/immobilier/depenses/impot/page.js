import EnTete from "../../../components/EnTete";
import { donneesImpot } from "@/lib/immobilierImpot";
import { periodeCourante } from "@/lib/immobilierCalculs";
import { exigerAccesImmo, simple } from "../../acces";
import ImpotClient from "./ImpotClient";

// Revenus de location pour l'impôt (T776 et TP-128). Année proposée : celle
// qui vient de finir jusqu'à la fin d'avril (saison des impôts), sinon l'année en cours.
export default async function ImpotImmo(props) {
  const session = await exigerAccesImmo();
  const params = await props.searchParams;
  const [a, m] = periodeCourante().split("-").map(Number);
  const defaut = m <= 4 ? a - 1 : a;
  const annee = /^\d{4}$/.test(params?.annee || "") ? Number(params.annee) : defaut;
  const { etat } = await donneesImpot(annee);
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <ImpotClient {...simple({ etat, annee, courante: a })} />
    </div>
  );
}
