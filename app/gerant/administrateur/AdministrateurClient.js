"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BoutonEnLigne from "../../components/BoutonEnLigne";
import BandeauSection from "../../components/BandeauSection";
import { Icone, TEINTES, GroupeLiens, CarteLien, Panneau, Pastille, TitreGroupe } from "../../components/StyleSection";

export default function AdministrateurClient({ modules, verrouilleInit, estDeveloppeur, themeInit, tailleTexteInit }) {
  const router = useRouter();
  const [enCoursId, setEnCoursId] = useState(null);
  const [verrouille, setVerrouille] = useState(verrouilleInit);
  const [verrouillageEnCours, setVerrouillageEnCours] = useState(false);
  const [theme, setTheme] = useState(themeInit);
  const [themeEnCours, setThemeEnCours] = useState(false);
  const [tailleTexte, setTailleTexte] = useState(tailleTexteInit);
  const [tailleEnCours, setTailleEnCours] = useState(false);

  async function choisirTheme(nouveauTheme) {
    if (nouveauTheme === theme) return;
    setThemeEnCours(true);
    setTheme(nouveauTheme);
    await fetch("/api/parametres", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme_developpeur: nouveauTheme }),
    });
    setThemeEnCours(false);
    router.refresh();
  }

  async function choisirTailleTexte(nouvelleTaille) {
    if (nouvelleTaille === tailleTexte) return;
    setTailleEnCours(true);
    setTailleTexte(nouvelleTaille);
    await fetch("/api/parametres", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taille_texte_developpeur: nouvelleTaille }),
    });
    setTailleEnCours(false);
    router.refresh();
  }

  async function basculerVerrouillage() {
    const nouveauStatut = !verrouille;
    if (nouveauStatut) {
      if (!window.confirm("Verrouiller l'accès complet à ce logiciel maintenant ? Plus personne (sauf toi) ne pourra rien faire tant que ce ne sera pas décoché.")) return;
    }
    setVerrouillageEnCours(true);
    await fetch("/api/administrateur/verrouillage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verrouille: nouveauStatut }),
    });
    setVerrouille(nouveauStatut);
    setVerrouillageEnCours(false);
    router.refresh();
  }

  async function toggle(moduleId, nouveauStatut) {
    setEnCoursId(moduleId);
    await fetch("/api/administrateur/modules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: moduleId, actif: nouveauStatut }),
    });
    setEnCoursId(null);
    router.refresh();
  }

  const nbActifs = modules.filter((m) => m.actif).length;

  return (
    <div className="conteneur-page">
      <BandeauSection icone="⚙️" titre="Administrateur" sousTitre="Visible seulement par toi. Active ou désactive des modules complets sur cette installation." />

      {estDeveloppeur && <BoutonEnLigne />}

      <GroupeLiens
        titre="Configuration" teinte={TEINTES.ambre}
        liens={[
          { href: "/gerant/administrateur/entreprise", icone: "immeuble", label: "Informations de l'entreprise", detail: "Nom, adresse, téléphone, responsable" },
          { href: "/gerant/administrateur/acces", icone: "utilisateurs", label: "Rôles et accès des employés", detail: "Qui voit quelle section" },
          { href: "/gerant/administrateur/google-places", icone: "epingle", label: "Google — adresses", detail: "Clé API pour compléter les adresses" },
        ]}
      />
      <GroupeLiens
        titre="Données" teinte={TEINTES.bleu}
        liens={[
          { href: "/gerant/administrateur/sauvegarde", icone: "boite", label: "Sauvegarde des données", detail: "Télécharger ou recevoir une copie" },
        ]}
      />

      <Panneau
        titre="Modules"
        action={<Pastille couleur="var(--success)" fond="var(--success-fond)">{nbActifs} actif{nbActifs > 1 ? "s" : ""} sur {modules.length}</Pastille>}
      >
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "-6px 0 12px" }}>
          Utile pour ajuster ce qu'un client voit, une fois ce logiciel revendu à d'autres garages.
        </p>
        {modules.map((m, i) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 4px", borderTop: i === 0 ? "none" : "1px solid var(--border)", opacity: m.pasEncoreConstruit ? 0.5 : 1 }}>
            <span style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12, background: m.actif ? TEINTES.vert.fond : "var(--surface-alt)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Icone nom={ICONES_MODULES[m.id] || "reglages"} taille={20} couleur={m.actif ? TEINTES.vert.couleur : "var(--text-muted)"} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{m.label}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{m.description}</div>
              {m.pasEncoreConstruit && (
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>Pas encore construit — l'interrupteur n'a pas d'effet pour l'instant.</div>
              )}
            </div>
            <Interrupteur
              actif={m.actif} couleur="var(--success)" libelle={`${m.actif ? "Désactiver" : "Activer"} le module ${m.label}`}
              onClick={() => toggle(m.id, !m.actif)} disabled={enCoursId === m.id || m.pasEncoreConstruit}
            />
          </div>
        ))}
      </Panneau>

      {estDeveloppeur && (
        <Panneau titre="Affichage">
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "-6px 0 12px" }}>Pour toi seulement.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Segments
              options={[["sombre", "🌙 Sombre"], ["clair", "☀️ Clair"]]}
              valeur={theme === "sombre" ? "sombre" : "clair"} onChange={choisirTheme} disabled={themeEnCours}
            />
            <Segments
              options={[["normal", "Texte normal"], ["grand", "Texte plus gros"]]}
              valeur={tailleTexte === "grand" ? "grand" : "normal"} onChange={choisirTailleTexte} disabled={tailleEnCours}
            />
          </div>
        </Panneau>
      )}

      <section style={{ marginBottom: 24 }}>
        <TitreGroupe couleur="var(--danger)">Zone sensible</TitreGroupe>
        <div style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--danger)", borderRadius: 16, padding: "14px 16px 14px 20px", marginBottom: 10 }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "var(--danger)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12, background: "var(--danger-fond)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Icone nom="cadenas" taille={20} couleur="var(--danger)" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>Verrouiller l'accès complet</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                Ex. en cas de défaut de paiement — bloque toute l'installation pour tout le monde (sauf toi) et affiche
                un message pour contacter info@sgwebsite.online.
              </div>
            </div>
            <Interrupteur actif={verrouille} couleur="var(--danger)" libelle={verrouille ? "Déverrouiller l'accès" : "Verrouiller l'accès"} onClick={basculerVerrouillage} disabled={verrouillageEnCours} />
          </div>
          {verrouille && (
            <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: "var(--danger)" }}>
              🔒 Actuellement verrouillé — personne d'autre que toi ne peut utiliser le logiciel.
            </div>
          )}
        </div>
        <CarteLien
          href="/gerant/administrateur/reinitialisation" icone="poubelle" teinte={TEINTES.rouge}
          label="Réinitialisation" detail="Effacer les données de l'installation"
        />
      </section>
    </div>
  );
}

const ICONES_MODULES = {
  calendrier: "calendrier", comptabilite: "banque", paie: "calculatrice", notifications: "alerte",
  documents: "document", jobs_deplacement: "vehicule", elevage: "drapeau",
};

// Interrupteur marche/arrêt, bien visible même éteint (thème clair ou sombre)
function Interrupteur({ actif, couleur, libelle, onClick, disabled }) {
  return (
    <button
      type="button" role="switch" aria-checked={actif} aria-label={libelle}
      onClick={onClick} disabled={disabled}
      style={{
        width: 50, height: 30, borderRadius: 999, border: "none", position: "relative", flexShrink: 0,
        cursor: disabled ? "not-allowed" : "pointer", background: actif ? couleur : "var(--border)", transition: "background 0.15s",
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: actif ? 23 : 3, width: 24, height: 24, borderRadius: "50%",
        background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.25)", transition: "left 0.15s",
      }} />
    </button>
  );
}

// Choix entre deux ou trois options, en onglets
function Segments({ options, valeur, onChange, disabled }) {
  return (
    <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 12, background: "var(--bg)" }}>
      {options.map(([cle, libelle]) => {
        const actif = valeur === cle;
        return (
          <button
            key={cle} type="button" onClick={() => onChange(cle)} disabled={disabled}
            style={{
              flex: 1, padding: "10px 12px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700,
              background: actif ? "var(--accent)" : "transparent", color: actif ? "#221f18" : "var(--text-muted)",
            }}
          >
            {libelle}
          </button>
        );
      })}
    </div>
  );
}
