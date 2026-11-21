import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirInfosEntreprise, lignesEnteteEntreprise } from "@/lib/config";
import { clientParJeton, donneesPortail } from "@/lib/portailClient";
import LogoClient from "../../components/LogoClient";
import PortailVue from "./PortailVue";

// Portail du client (lib/portailClient.js) : son dossier, protégé par son
// lien secret ; jamais indexé
export const metadata = { title: "Mon dossier", robots: { index: false, follow: false } };

export default async function PortailClient(props) {
  const { jeton } = await props.params;
  const [entreprise, client] = await Promise.all([obtenirInfosEntreprise(), clientParJeton(jeton)]);

  if (!client) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "var(--bg)" }}>
        <div style={{ maxWidth: 420, textAlign: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 24 }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>🔒</div>
          <h1 style={{ fontSize: 20, margin: "0 0 10px" }}>{entreprise.nomEntreprise}</h1>
          <p style={{ fontSize: 14, margin: 0, color: "var(--text-muted)" }}>
            Ce lien n&apos;est plus valide. Communiquez avec nous pour en recevoir un nouveau{entreprise.telephone ? ` (${entreprise.telephone})` : ""}.
          </p>
        </div>
      </div>
    );
  }

  const donnees = await donneesPortail(client);
  // Dernière visite, notée après l'affichage
  after(() => prisma.client.update({ where: { id: client.id }, data: { portailVuLe: new Date() } }).catch(() => {}));

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "20px 16px 48px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 14, marginBottom: 16, borderBottom: "2px solid var(--text)" }}>
          <LogoClient alt={entreprise.nomEntreprise} width={84} height={56} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{entreprise.nomEntreprise}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.45 }}>
              {lignesEnteteEntreprise(entreprise).map((l) => <div key={l}>{l}</div>)}
            </div>
          </div>
        </header>
        <PortailVue jeton={jeton} donnees={donnees} telephone={entreprise.telephone} lienRendezVous={(await prisma.parametre.findUnique({ where: { cle: "rappel_entretien_lien" } }))?.valeur || ""} />
      </div>
    </div>
  );
}
