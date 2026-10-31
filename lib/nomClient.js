// Nom du client sur un bon et sa facture : celui corrigé pour ce document
// (bon.clientNomAffiche), sinon celui du dossier. La correction ne touche ni
// le dossier du client, ni le véhicule, ni le reste. Client et serveur.
export function nomClientBon(bon) {
  return (bon?.clientNomAffiche || "").trim() || bon?.client?.nom || "";
}

// Valeur à enregistrer : vide, ou identique au nom du dossier → null
export function nomAfficheAEnregistrer(nom, nomDossier) {
  const n = String(nom ?? "").trim().slice(0, 200);
  return n && n !== (nomDossier || "").trim() ? n : null;
}
