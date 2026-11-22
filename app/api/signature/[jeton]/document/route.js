import { NextResponse } from "next/server";
import { reponseFichier } from "@/lib/immobilier";
import { signatureParJeton, versionDocument } from "@/lib/signatureImmo";

// Le document à signer, ouvert depuis le lien de signature (?version=signee :
// la version signée, une fois toutes les signatures reçues)
export async function GET(request, props) {
  const { jeton } = await props.params;
  const d = await signatureParJeton(jeton);
  if (!d || d.statut === "ANNULE") return NextResponse.json({ erreur: "Ce lien n'est plus valide." }, { status: 404 });
  return reponseFichier(versionDocument(d.document, request), request);
}
