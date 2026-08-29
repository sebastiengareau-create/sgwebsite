/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit (et ses dépendances comme fontkit) ne se regroupent pas bien
  // avec webpack — on le laisse en require() natif côté serveur, sinon la
  // classe PDFDocument arrive corrompue en production ("n is not a constructor")
  experimental: {
    serverComponentsExternalPackages: ["pdfkit"],
  },
};
module.exports = nextConfig;
