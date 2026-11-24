import { notFound } from "next/navigation";
import EnTete from "../../../../components/EnTete";
import { donneesHausses } from "@/lib/immobilierHausses";
import { periodeCourante } from "@/lib/immobilierCalculs";
import { exigerAccesImmo, simple } from "../../../acces";
import HaussesClient from "./HaussesClient";

// Hausses de loyer d'un immeuble selon la méthode du TAL
export default async function HaussesImmeuble(props) {
  const { id } = await props.params;
  const params = await props.searchParams;
  const session = await exigerAccesImmo();
  const donnees = await donneesHausses(id);
  if (!donnees) notFound();
  // Année des avis : d'octobre à décembre, ceux de l'hiver qui vient
  const [a, m] = periodeCourante().split("-").map(Number);
  const annee = m >= 10 ? a + 1 : a;
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <HaussesClient {...simple({ ...donnees, annee, bailVise: params?.bail || null })} />
    </div>
  );
}
