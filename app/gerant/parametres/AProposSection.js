import { obtenirInfosEntreprise } from "@/lib/config";
import { versionEnLigne } from "@/lib/version";
import Image from "next/image";
import { NOM_LOGICIEL, SLOGAN, COURRIEL_SOUTIEN, SECTEUR, LOGO_METAL } from "@/lib/marque";
import { LogoKontrolshop } from "../../components/LogoKontrolshop";
import { TEINTES, TitrePanneau, stylePanneau } from "../../components/StyleSection";

// À propos du logiciel : la marque kontrolshop et ses détails, au bas des
// Paramètres (visible par tous ceux qui ont accès aux Paramètres)
export default async function AProposSection() {
  const { nomEntreprise } = await obtenirInfosEntreprise();
  const details = [
    ["Logiciel", `${NOM_LOGICIEL} · ${SECTEUR.libelle}`],
    ["Utilisé par", nomEntreprise],
    ["Version", versionEnLigne().replace(/^Version /, "")],
    ["Soutien", <a key="c" href={`mailto:${COURRIEL_SOUTIEN}`} style={{ color: "inherit" }}>{COURRIEL_SOUTIEN}</a>],
  ];

  return (
    <div className="conteneur-page-large" style={{ margin: "0 auto", padding: "0 16px" }}>
      <div style={stylePanneau}>
        <TitrePanneau icone="reglages" teinte={TEINTES.neutre} titre="À propos" sousTitre="Le logiciel et comment nous joindre" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "10px 0 18px" }}>
          {/* Logo métal du secteur (kontrolshop Premium, Garage…) ; sinon le logo dessiné */}
          {LOGO_METAL
            ? <Image src={LOGO_METAL} alt={`${NOM_LOGICIEL} ${SECTEUR.libelle}`} width={300} height={150} style={{ width: "min(300px, 80%)", height: "auto" }} />
            : <LogoKontrolshop taille={64} />}
          <div style={{ fontSize: 15, fontWeight: 600 }}>{SLOGAN}</div>
        </div>
        <dl style={{ margin: 0, borderTop: "1px solid var(--border)" }}>
          {details.map(([etiquette, valeur]) => (
            <div key={etiquette} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 2px", borderBottom: "1px solid var(--border)", fontSize: 13.5 }}>
              <dt style={{ color: "var(--text-muted)" }}>{etiquette}</dt>
              <dd style={{ margin: 0, fontWeight: 600, textAlign: "right", overflowWrap: "anywhere" }}>{valeur}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
