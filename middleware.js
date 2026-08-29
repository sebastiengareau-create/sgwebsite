import { NextResponse } from "next/server";
import { verifierJeton, COOKIE_NAME } from "./lib/auth";

// Vérifie seulement que la personne est bien connectée — la décision de QUI
// a accès à quelle section se fait maintenant dans chaque page elle-même
// (via aAccesSection, configurable dans Administrateur → Rôles et accès).
// Le middleware ne peut pas interroger la base de données facilement, donc
// il ne fait plus ce choix — il ne fait que garder les visiteurs non
// connectés en dehors de tout, ce que chaque page vérifie de toute façon en
// double, par sécurité.
const SECTIONS_PROTEGEES = ["/gerant", "/secretaire", "/mecanicien", "/bons"];

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const protegee = SECTIONS_PROTEGEES.some((prefixe) => pathname.startsWith(prefixe));
  if (!protegee) return NextResponse.next();

  const jeton = request.cookies.get(COOKIE_NAME)?.value;
  const session = await verifierJeton(jeton);

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/gerant/:path*", "/secretaire/:path*", "/mecanicien/:path*", "/bons/:path*"],
};
