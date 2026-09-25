"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AssistantSG() {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [messages, setMessages] = useState([]); // [{role: "user" | "assistant", texte, liens?}]
  const [historique, setHistorique] = useState([]); // format "contents" de Gemini, opaque
  const [texte, setTexte] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [ecoute, setEcoute] = useState(false);
  const [lireReponses, setLireReponses] = useState(false);
  const [micDisponible, setMicDisponible] = useState(false);
  const zoneMessagesRef = useRef(null);
  const reconnaissanceRef = useRef(null);

  useEffect(() => {
    const Reconnaissance = window.SpeechRecognition || window.webkitSpeechRecognition;
    setMicDisponible(!!Reconnaissance);
  }, []);

  useEffect(() => {
    if (zoneMessagesRef.current) {
      zoneMessagesRef.current.scrollTop = zoneMessagesRef.current.scrollHeight;
    }
  }, [messages, enCours]);

  async function envoyerMessage(texteMessage) {
    const contenu = texteMessage.trim();
    if (!contenu || enCours) return;
    setMessages((m) => [...m, { role: "user", texte: contenu }]);
    setTexte("");
    setEnCours(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: contenu, historique }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages((m) => [...m, { role: "assistant", texte: data.erreur || "Erreur inattendue." }]);
        return;
      }
      setMessages((m) => [...m, { role: "assistant", texte: data.reponse, liens: data.liens || [] }]);
      setHistorique(data.historique || []);
      if (lireReponses && window.speechSynthesis && data.reponse) {
        const enonce = new SpeechSynthesisUtterance(texteSansMarkdown(data.reponse));
        enonce.lang = "fr-CA";
        window.speechSynthesis.speak(enonce);
      }
      if (data.navigation) {
        setTimeout(() => {
          router.push(data.navigation);
          setOuvert(false);
        }, 600);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", texte: "Impossible de contacter Assistant SG — vérifie ta connexion." }]);
    } finally {
      setEnCours(false);
    }
  }

  function toggleEcoute() {
    if (ecoute) {
      reconnaissanceRef.current?.stop();
      return;
    }
    const Reconnaissance = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Reconnaissance) return;
    const reconnaissance = new Reconnaissance();
    reconnaissance.lang = "fr-CA";
    reconnaissance.interimResults = false;
    reconnaissance.maxAlternatives = 1;
    reconnaissance.onresult = (e) => {
      const dit = e.results[0]?.[0]?.transcript;
      if (dit) envoyerMessage(dit);
    };
    reconnaissance.onerror = () => setEcoute(false);
    reconnaissance.onend = () => setEcoute(false);
    reconnaissanceRef.current = reconnaissance;
    reconnaissance.start();
    setEcoute(true);
  }

  return (
    <>
      {ouvert && (
        <div onClick={() => setOuvert(false)} style={{ position: "fixed", inset: 0, zIndex: 39 }} />
      )}
      <div style={{ position: "fixed", bottom: 20, left: 16, zIndex: 40, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
        {ouvert && (
          <div
            style={{
              width: "min(400px, 92vw)", height: "min(600px, 75vh)",
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>🤖 Assistant SG</span>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  onClick={() => setLireReponses((v) => !v)}
                  title={lireReponses ? "Désactiver la lecture à voix haute" : "Activer la lecture à voix haute"}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, opacity: lireReponses ? 1 : 0.4 }}
                >
                  🔊
                </button>
                <button onClick={() => setOuvert(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--text-muted)" }}>✕</button>
              </div>
            </div>

            <div ref={zoneMessagesRef} style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {messages.length === 0 && (
                <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", marginTop: 20 }}>
                  Pose-moi une question — ex. « trouve Tremblay », « bons en cours », « factures impayées de plus de 30 jours ».
                </p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "85%", padding: "8px 12px", borderRadius: 12, fontSize: 13, lineHeight: 1.4,
                    background: m.role === "user" ? "var(--accent)" : "var(--bg)",
                    color: m.role === "user" ? "#17150f" : "var(--text)",
                    border: m.role === "user" ? "none" : "1px solid var(--border)",
                    whiteSpace: m.role === "user" ? "pre-wrap" : "normal",
                  }}
                >
                  {m.role === "user" ? m.texte : <RenduReponse texte={m.texte} liens={m.liens} onNaviguer={() => setOuvert(false)} />}
                </div>
              ))}
              {enCours && (
                <div style={{ alignSelf: "flex-start", padding: "8px 12px", borderRadius: 12, fontSize: 13, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                  …
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 6, padding: 10, borderTop: "1px solid var(--border)" }}>
              {micDisponible && (
                <button
                  onClick={toggleEcoute}
                  title="Poser la question à voix haute"
                  style={{
                    width: 34, height: 34, flexShrink: 0, borderRadius: 8, border: "1px solid var(--border)",
                    background: ecoute ? "var(--danger)" : "var(--bg)", color: ecoute ? "#fff" : "var(--text)",
                    cursor: "pointer", fontSize: 14,
                  }}
                >
                  🎤
                </button>
              )}
              <input
                type="text"
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") envoyerMessage(texte); }}
                placeholder="Écris ta question…"
                disabled={enCours}
                style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: 13 }}
              />
              <button
                onClick={() => envoyerMessage(texte)}
                disabled={enCours || !texte.trim()}
                className="bouton-3d"
                style={{ padding: "0 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, opacity: enCours || !texte.trim() ? 0.5 : 1 }}
              >
                Envoyer
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => setOuvert((v) => !v)}
          className="bouton-3d"
          style={{ width: 56, height: 56, borderRadius: "50%", fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center" }}
          aria-label="Assistant SG"
        >
          {ouvert ? "✕" : "💬"}
        </button>
      </div>
    </>
  );
}

// Chemin interne du logiciel seulement (jamais un site externe)
function lienInterne(url) {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//");
}

// Texte lisible à voix haute : [libellé](lien) → libellé, sans ** ni puces
function texteSansMarkdown(texte) {
  return String(texte || "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*/g, "").replace(/^\s*[-*]\s+/gm, "");
}

// Rendu du texte de l'assistant : liens Markdown vers les fiches (cliquables),
// **gras** et listes à puces — rien d'autre n'est interprété.
function RenduInline({ texte, onNaviguer }) {
  const morceaux = [];
  const motif = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;
  let dernier = 0;
  let m;
  while ((m = motif.exec(texte))) {
    if (m.index > dernier) morceaux.push(texte.slice(dernier, m.index));
    if (m[1] !== undefined) {
      morceaux.push(lienInterne(m[2])
        ? <Link key={m.index} href={m[2]} onClick={onNaviguer} style={styleLien}>{m[1]}</Link>
        : m[1]);
    } else {
      morceaux.push(<strong key={m.index}>{m[3]}</strong>);
    }
    dernier = motif.lastIndex;
  }
  if (dernier < texte.length) morceaux.push(texte.slice(dernier));
  return <>{morceaux}</>;
}

function RenduReponse({ texte, liens = [], onNaviguer }) {
  const lignes = String(texte || "").split("\n");
  const blocs = [];
  let puces = [];
  const viderPuces = () => {
    if (puces.length) {
      blocs.push(
        <ul key={`ul-${blocs.length}`} style={{ margin: "4px 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 3 }}>
          {puces.map((p, i) => <li key={i}><RenduInline texte={p} onNaviguer={onNaviguer} /></li>)}
        </ul>
      );
      puces = [];
    }
  };
  for (const ligne of lignes) {
    const puce = ligne.match(/^\s*[-*•]\s+(.*)$/);
    if (puce) { puces.push(puce[1]); continue; }
    viderPuces();
    if (ligne.trim()) blocs.push(<p key={`p-${blocs.length}`} style={{ margin: "2px 0" }}><RenduInline texte={ligne} onNaviguer={onNaviguer} /></p>);
  }
  viderPuces();

  // Raccourcis vers les fiches trouvées que l'IA n'a pas déjà mis en lien
  const autres = liens.filter((l) => lienInterne(l.url) && !String(texte || "").includes(`](${l.url})`));
  return (
    <>
      {blocs}
      {autres.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
          {autres.map((l) => (
            <Link
              key={l.url} href={l.url} onClick={onNaviguer}
              style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, textDecoration: "none", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--accent)" }}
            >
              ↗ {l.libelle}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

const styleLien = { color: "var(--accent)", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 };
