import { prisma } from "@/lib/prisma";
import { obtenirInfosEntreprise } from "@/lib/config";
import { jetonDesabonnementValide } from "@/lib/courrielDocuments";

// Page publique (sans connexion) du lien au bas des courriels de la section
// Documents : le client confirme qu'il ne veut plus de nos promotions.
export default async function Desabonnement(props) {
  const searchParams = await props.searchParams;
  const c = typeof searchParams?.c === "string" ? searchParams.c : "";
  const t = typeof searchParams?.t === "string" ? searchParams.t : "";
  const { nomEntreprise, telephone } = await obtenirInfosEntreprise();
  const client = jetonDesabonnementValide(c, t) ? await prisma.client.findUnique({ where: { id: c }, select: { promotionsRefuseesLe: true } }) : null;

  let contenu;
  if (!client) {
    contenu = <p>Ce lien de désabonnement n'est pas valide. {telephone && <>Appelez-nous au {telephone} et nous vous retirerons de notre liste.</>}</p>;
  } else if (client.promotionsRefuseesLe) {
    contenu = <p>C'est fait : vous ne recevrez plus nos promotions par courriel.</p>;
  } else {
    contenu = (
      <form method="POST" action="/api/desabonnement">
        <input type="hidden" name="c" value={c} />
        <input type="hidden" name="t" value={t} />
        <p>Vous ne souhaitez plus recevoir les promotions de {nomEntreprise} par courriel ?</p>
        <button type="submit" style={{ marginTop: 8, padding: "12px 20px", borderRadius: 10, border: "none", background: "#e8a33d", color: "#17150f", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          Me désabonner
        </button>
      </form>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "#f2f0ea", color: "#17150f", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 420, width: "100%", background: "white", borderRadius: 14, padding: 28, textAlign: "center", fontSize: 15, lineHeight: 1.5 }}>
        <h1 style={{ fontSize: 20, margin: "0 0 12px" }}>{nomEntreprise}</h1>
        {contenu}
      </div>
    </div>
  );
}
