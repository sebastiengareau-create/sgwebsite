// Adresse publique de l'appli, encodée dans les QR des étiquettes : celle
// d'où l'utilisateur imprime (envoyée par le navigateur), sinon reconstituée
// des en-têtes du proxy (Railway).
export function origineAppli(request, origineNavigateur) {
  if (typeof origineNavigateur === "string" && /^https?:\/\/[^/\s]+$/.test(origineNavigateur)) return origineNavigateur;
  const hote = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const protocole = request.headers.get("x-forwarded-proto") || "https";
  return `${protocole}://${hote}`;
}
