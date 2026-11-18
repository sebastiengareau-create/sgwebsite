import { prisma } from "@/lib/prisma";
import EnTete from "../../components/EnTete";
import { periodeCourante } from "@/lib/immobilierCalculs";
import { exigerAccesImmo, simple } from "../acces";
import Releve31Client from "./Releve31Client";

// Année proposée : jusqu'à la fin de mars, les relevés de l'année qui vient
// de finir ; ensuite, l'année en cours (pour préparer ceux de février)
function anneeParDefaut() {
  const [a, m] = periodeCourante().split("-").map(Number);
  return m <= 3 ? a - 1 : a;
}

export default async function Releve31Immo(props) {
  const session = await exigerAccesImmo();
  const params = await props.searchParams;
  const defaut = anneeParDefaut();
  const annee = /^\d{4}$/.test(params?.annee || "") ? Number(params.annee) : defaut;
  const debut = new Date(Date.UTC(annee, 11, 31, 23));
  const fin = new Date(Date.UTC(annee, 11, 31));
  const baux = await prisma.bailImmo.findMany({
    where: { dateDebut: { lte: debut }, OR: [{ dateFin: null }, { dateFin: { gte: fin } }], logement: { type: "LOGEMENT" } },
    select: {
      id: true, statut: true, dateDebut: true, dateFin: true, terminaisonLe: true,
      locataires: { select: { id: true, nom: true }, orderBy: { nom: "asc" } },
      logement: { select: { id: true, numero: true, type: true, numeroLogementRq: true, adresseCivique: true, immeuble: { select: { id: true, nom: true, adresse: true, ville: true, codePostal: true } } } },
      releves31: { where: { annee }, select: { produitLe: true, remisLe: true } },
    },
  });
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <Releve31Client {...simple({ baux, annee, defaut })} />
    </div>
  );
}
