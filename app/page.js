import { redirect } from "next/navigation";
import { obtenirSession } from "@/lib/auth";
import { accueilDuRole } from "@/lib/client";

export default async function Accueil() {
  const session = await obtenirSession();
  if (!session) redirect("/login");
  redirect(accueilDuRole(session.role));
}
