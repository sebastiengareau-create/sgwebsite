<?php
// Listes du formulaire véhicule récréatif (année → marque de VR → modèle →
// type de VR), lues dans le logiciel de VR Premium pour offrir exactement
// les mêmes choix que son dossier véhicule. Relais côté serveur : la clé
// secrète ne quitte jamais ce serveur.
//
// Le logiciel de VR Premium roule avec le profil « vr-premium » : la même
// adresse lui renvoie donc le catalogue de VR, pas celui des autos.
//
//   api/vehicle_catalog.php                                  → { annees: [2027, …, 1970] }
//   api/vehicle_catalog.php?annee=2019                       → { marques: { populaires: [{nom}], autres: [...] } }
//   api/vehicle_catalog.php?annee=2019&marque=Jayco          → { modeles: ["Eagle", "Jay Flight", …] }
//   api/vehicle_catalog.php?marque=Jayco&modele=Jay%20Flight → { versions: ["Roulotte de voyage", "Classe A", …] }
//
// Différences avec les autos :
//   - les marques et les modèles ne sont pas filtrés par année (une gamme
//     comme le Jay Flight est offerte pendant des décennies) ;
//   - la 4e liste est le type de VR (Classe A, B, C, roulotte, sellette…) :
//     le ou les types connus du modèle d'abord, puis tous les autres.
//     Libellé conseillé dans le formulaire : « Type de VR ».
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/functions.php';

header('Content-Type: application/json; charset=utf-8');

$query = [];
foreach (['annee', 'marque', 'modele'] as $key) {
    if (isset($_GET[$key])) {
        $query[$key] = mb_substr(trim((string) $_GET[$key]), 0, 100);
    }
}

$result = fetchSoftware('vehicules/catalogue', $query);
if ($result['status'] !== 200) {
    // Le formulaire bascule alors en saisie libre
    http_response_code(503);
    echo json_encode(['error' => 'Catalogue indisponible.']);
    exit;
}

// Les listes changent rarement : le navigateur peut les garder une heure
header('Cache-Control: public, max-age=3600');
echo json_encode($result['body']);
