export default function TalonPaie({ paie, cumulatif, anneeCourante, entreprise, className }) {
  const estVacances = paie.typePaie === "VACANCES";

  return (
    <div className={className} style={{ maxWidth: 620, margin: "0 auto 40px", background: "white", color: "#17150f", padding: "36px 40px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ borderBottom: "2px solid #17150f", paddingBottom: 16, marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>{entreprise.nomEntreprise}</h1>
        <p style={{ fontSize: 11, color: "#666", margin: "3px 0 0" }}>{entreprise.adresseLigne1}, {entreprise.adresseLigne2} · {entreprise.telephone}</p>
        <p style={{ fontSize: 15, fontWeight: 700, marginTop: 12, marginBottom: 0 }}>
          Talon de paie {estVacances && <span style={{ color: "#a87b1f" }}>— Vacances</span>}
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{paie.employe.nom}</div>
          {paie.heuresTravaillees > 0 && (
            <div style={{ fontSize: 11, color: "#666", marginTop: 3 }}>
              Heures travaillées : {paie.heuresTravaillees.toFixed(2)} h · Cumulatif {anneeCourante} : {cumulatif.heures.toFixed(2)} h
            </div>
          )}
          <div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>
            Période : {new Date(paie.periodeDebut).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })} au {new Date(paie.periodeFin).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>
            Salaire net : {paie.salaireNet.toFixed(2)} $
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#666" }}>Versée le</div>
          <div style={{ fontSize: 12 }}>{paie.dateVersement ? new Date(paie.dateVersement).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" }) : "—"}</div>
        </div>
      </div>

      <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #17150f" }}>
            <th style={{ textAlign: "left", padding: "6px 0", fontSize: 10.5, textTransform: "uppercase", color: "#888" }}></th>
            <th style={{ textAlign: "right", padding: "6px 0", fontSize: 10.5, textTransform: "uppercase", color: "#888" }}>Cette paie</th>
            <th style={{ textAlign: "right", padding: "6px 0", fontSize: 10.5, textTransform: "uppercase", color: "#888" }}>Cumulatif {anneeCourante}</th>
          </tr>
        </thead>
        <tbody>
          <LigneTalon label={estVacances ? "Vacances versées" : "Salaire brut"} valeur={paie.salaireBrut} cumul={cumulatif.brut} gras />
          <LigneTalon label="RRQ" valeur={-paie.rrqEmploye} cumul={-cumulatif.rrq} />
          <LigneTalon label="RQAP" valeur={-paie.rqapEmploye} cumul={-cumulatif.rqap} />
          <LigneTalon label="Assurance-emploi" valeur={-paie.aeEmploye} cumul={-cumulatif.ae} />
          <LigneTalon label="Impôt fédéral" valeur={-paie.impotFederal} cumul={-cumulatif.impotFederal} />
          <LigneTalon label="Impôt Québec" valeur={-paie.impotQuebec} cumul={-cumulatif.impotQuebec} />
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid #17150f" }}>
            <td style={{ padding: "8px 0", fontWeight: 700, fontSize: 13.5 }}>Salaire net</td>
            <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 700, fontSize: 13.5 }}>{paie.salaireNet.toFixed(2)} $</td>
            <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 700, fontSize: 13.5 }}>{cumulatif.net.toFixed(2)} $</td>
          </tr>
        </tfoot>
      </table>

      {!estVacances && paie.vacancesAccumulees > 0 && (
        <p style={{ fontSize: 11, color: "#666", marginTop: 14 }}>
          Vacances accumulées cette paie : {paie.vacancesAccumulees.toFixed(2)} $
        </p>
      )}

      <p style={{ fontSize: 9.5, color: "#999", marginTop: 30, textAlign: "center" }}>
        Document généré à titre informatif — conserve tes talons de paie pour tes déclarations de revenus.
      </p>
    </div>
  );
}

function LigneTalon({ label, valeur, cumul, gras }) {
  return (
    <tr>
      <td style={{ padding: "5px 0", fontWeight: gras ? 700 : 400 }}>{label}</td>
      <td style={{ padding: "5px 0", textAlign: "right", fontWeight: gras ? 700 : 400 }}>{valeur.toFixed(2)} $</td>
      <td style={{ padding: "5px 0", textAlign: "right", color: "#666" }}>{cumul.toFixed(2)} $</td>
    </tr>
  );
}
