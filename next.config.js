/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit (et ses dépendances comme fontkit) ne se regroupent pas bien
  // avec webpack — on le laisse en require() natif côté serveur, sinon la
  // classe PDFDocument arrive corrompue en production ("n is not a constructor")
  experimental: {
    serverComponentsExternalPackages: ["pdfkit"],
    // Sans ce flag (obligatoire sur Next 14.x), instrumentation.js n'est
    // jamais chargé et son register() n'est jamais appelé — c'est ce qui
    // empêchait le planificateur de sauvegarde automatique de démarrer.
    instrumentationHook: true,
  },
};
module.exports = nextConfig;
