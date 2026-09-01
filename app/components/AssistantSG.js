"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function AssistantSG() {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [messages, setMessages] = useState([]); // [{role: "user" | "assistant", texte}]
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
      setMessages((m) => [...m, { role: "assistant", texte: data.reponse }]);
      setHistorique(data.historique || []);
      if (lireReponses && window.speechSynthesis && data.reponse) {
        const enonce = new SpeechSynthesisUtterance(data.reponse);
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
              width: "min(360px, 92vw)", height: "min(520px, 70vh)",
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
                  Pose-moi une question — ex. "quels employés travaillent en ce moment ?"
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
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {m.texte}
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
