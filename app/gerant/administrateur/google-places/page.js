import { redirect } from "next/navigation";
import Link from "next/link";
import { obtenirSession, estGerantOuDev } from "@/lib/auth";
import { lireConfig } from "@/lib/googlePlaces";
import EnTete from "../../../components/EnTete";
import GooglePlacesSection from "./GooglePlacesSection";

// Administrateur → Google Places : clé API pour les suggestions d'adresses.
export default async function GooglePlaces() {
  const session = await obtenirSession();
  if (!estGerantOuDev(session)) redirect("/gerant");

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <div className="conteneur-page-large" style={{ margin: "20px auto 0", padding: "0 16px" }}>
        <Link href="/gerant/administrateur" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à Administrateur</Link>
        <h1 style={{ fontSize: 20, marginTop: 8, marginBottom: 0 }}>📍 Google — adresses</h1>
      </div>
      <GooglePlacesSection configInitiale={await lireConfig()} />
    </div>
  );
}
