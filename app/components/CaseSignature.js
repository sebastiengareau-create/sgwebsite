"use client";

import { useEffect, useRef, useState } from "react";

// Case où signer du doigt, du stylet ou de la souris. Toujours sur fond
// blanc avec encre foncée, peu importe le thème : c'est l'image conservée.
// Sert aux soumissions (/soumission/<jeton>) et aux signatures de
// l'immobilier (/signature/<jeton>, portail des locataires).
export default function CaseSignature({ onChange }) {
  const canvasRef = useRef(null);
  const trace = useRef({ enCours: false, x: 0, y: 0 });
  const [vide, setVide] = useState(true);

  function preparer() {
    const canvas = canvasRef.current;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    ctx.strokeStyle = "#17150f";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }
  useEffect(preparer, []);

  function position(e) {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function debut(e) {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    trace.current = { enCours: true, ...position(e) };
  }
  function bouge(e) {
    if (!trace.current.enCours) return;
    const { x, y } = position(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(trace.current.x, trace.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    trace.current = { enCours: true, x, y };
    if (vide) setVide(false);
  }
  function fin() {
    if (!trace.current.enCours) return;
    trace.current.enCours = false;
    if (!vide) onChange(canvasRef.current.toDataURL("image/png"));
  }
  function effacer() {
    preparer();
    setVide(true);
    onChange(null);
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          onPointerDown={debut} onPointerMove={bouge} onPointerUp={fin} onPointerCancel={fin}
          aria-label="Case de signature"
          style={{ display: "block", width: "100%", height: 160, background: "#fff", border: "1.5px dashed var(--border)", borderRadius: 12, touchAction: "none", cursor: "crosshair" }}
        />
        {vide && (
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#9c978a", pointerEvents: "none" }}>
            Signez ici avec le doigt
          </span>
        )}
      </div>
      {!vide && (
        <button type="button" onClick={effacer} style={{ marginTop: 6, background: "none", border: "none", padding: 0, fontSize: 13, color: "var(--text-muted)", textDecoration: "underline", cursor: "pointer" }}>
          Effacer et recommencer
        </button>
      )}
    </div>
  );
}
