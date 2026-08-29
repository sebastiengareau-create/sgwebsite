import { redirect } from "next/navigation";
import { obtenirSession } from "@/lib/auth";

export default async function Accueil() {
  const session = await obtenirSession();
  if (!session) redirect("/login");
  const destination = session.role === "DEVELOPPEUR" ? "gerant" : session.role.toLowerCase();
  redirect(`/${destination}`);
}
