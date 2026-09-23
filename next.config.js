/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit (et ses dépendances comme fontkit) ne se regroupent pas bien —
  // on le laisse en require() natif côté serveur, sinon la classe
  // PDFDocument arrive corrompue en production ("n is not a constructor").
  // instrumentation.js (planificateur de sauvegarde automatique) est chargé
  // d'office depuis Next 15, plus besoin de flag.
  serverExternalPackages: ["pdfkit"],
};
module.exports = nextConfig;
