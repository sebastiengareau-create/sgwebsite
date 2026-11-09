import Image from "next/image";
import { CLIENT, image } from "@/lib/client";

// Logo du client à l'écran. Si son profil a aussi un « logo-sombre.png »
// (logo transparent aux couleurs claires), les deux sont rendus et le CSS
// (globals.css, .logo-clair / .logo-sombre) montre celui du thème en cours.
// Les documents (PDF, impressions, courriels) gardent toujours logo.png.
export default function LogoClient({ alt, width, height, priority = false }) {
  const style = { objectFit: "contain" };
  if (!CLIENT.images.includes("logo-sombre.png")) {
    return <Image src={image("logo.png")} alt={alt} width={width} height={height} priority={priority} style={style} />;
  }
  return (
    <>
      <Image className="logo-clair" src={image("logo.png")} alt={alt} width={width} height={height} priority={priority} style={style} />
      <Image className="logo-sombre" src={image("logo-sombre.png")} alt={alt} width={width} height={height} priority={priority} style={style} />
    </>
  );
}
