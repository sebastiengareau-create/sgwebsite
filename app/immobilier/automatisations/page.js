import EnTete from "../../components/EnTete";
import { lireReglagesImmoAuto, dernierResultatImmoAuto } from "@/lib/immobilierAuto";
import { notificationsActives } from "@/lib/notifications";
import { exigerAccesImmo } from "../acces";
import AutomatisationsClient from "./AutomatisationsClient";

export default async function AutomatisationsImmo() {
  const session = await exigerAccesImmo();
  const [reglages, dernier, notifications] = await Promise.all([lireReglagesImmoAuto(), dernierResultatImmoAuto(), notificationsActives()]);
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <AutomatisationsClient reglages={reglages} dernier={dernier} courriel={Boolean(process.env.RESEND_API_KEY)} notifications={notifications} />
    </div>
  );
}
