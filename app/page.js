"use client";

import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // Step 1: Scrape data
      const scrapeRes = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!scrapeRes.ok) {
        const errorData = await scrapeRes.json();
        throw new Error(errorData.error || "Error al extraer los datos de la propiedad");
      }

      const propertyData = await scrapeRes.json();

      // Step 2: Generate PDF
      const pdfRes = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(propertyData),
      });

      if (!pdfRes.ok) {
        throw new Error("Error al generar el PDF");
      }

      // Step 3: Download PDF
      const blob = await pdfRes.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      
      let safeName = "Propiedad";
      if (propertyData.location) {
          // Permite letras, números, espacios, comas, acentos y guiones. Elimina guiones bajos.
          safeName = propertyData.location
            .replace(/[^a-zA-Z0-9\s,áéíóúÁÉÍÓÚñÑ-]/g, '')
            .trim()
            .substring(0, 60);
      }
      link.download = `${safeName}.pdf`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setSuccess("¡Ficha técnica generada con éxito!");
    } catch (err) {
      console.error(err);
      setError(err.message || "Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="brand-logo">
        <svg viewBox="0 0 100 100" width="80" height="80" style={{ backgroundColor: 'white', borderRadius: '50%', padding: '2px', marginBottom: '10px' }}>
          <path d="M 85 23 A 43 43 0 1 0 85 77 L 73 66 A 27 27 0 1 1 73 34 Z" fill="#b49b57" />
          <text x="48" y="67" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="900" fontSize="44" fill="#b49b57" textAnchor="middle" letterSpacing="-2">21</text>
        </svg>
        <div className="brand-title">
          CENTURY 21<span className="brand-reg">®</span>
        </div>
        <div className="brand-subtitle">MAUVECIN</div>
      </div>
      
      <h1>Generador de Fichas</h1>
      <p className="subtitle">
        Herramienta exclusiva para agentes. Genera PDFs profesionales sin marcas de agua de portales.
      </p>

      <div className="supported-portals">
        <p className="portals-title">Plataformas Integradas</p>
        <div className="portals-logos">
          <div className="portal-logo-wrapper">
            {/* Si tenés los logos locales, podés cambiarlos por /ml-logo.png y /zonaprop-logo.png */}
            <img 
              src="https://http2.mlstatic.com/frontend-assets/ml-web-navigation/ui-navigation/5.22.8/mercadolibre/logo__large_plus.png" 
              alt="Mercado Libre Inmuebles" 
              className="portal-logo ml-logo" 
            />
          </div>
          <div className="portal-divider"></div>
          <div className="portal-logo-wrapper">
            <svg viewBox="0 0 130 30" xmlns="http://www.w3.org/2000/svg" className="portal-logo zp-logo">
              <path d="M 10 5 C 6 5 3 8 3 12 C 3 15.3 5.3 18.2 8.5 18.8 L 8.5 27 L 11.5 27 L 11.5 24 L 14.5 24 L 14.5 21 L 11.5 21 L 11.5 18.8 C 14.7 18.2 17 15.3 17 12 C 17 8 14 5 10 5 Z M 10 9 C 11.6 9 13 10.4 13 12 C 13 13.6 11.6 15 10 15 C 8.4 15 7 13.6 7 12 C 7 10.4 8.4 9 10 9 Z" fill="#FF5A00" />
              <text x="22" y="21" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="800" fontSize="19" fill="#111" letterSpacing="-0.5">zonaprop</text>
            </svg>
          </div>
        </div>
      </div>

      <div className="form-card">
        <form className="input-group" onSubmit={handleGenerate}>
          <input
            type="url"
            className="input-field"
            placeholder="Pega el link de Mercado Libre o ZonaProp..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            disabled={loading}
          />
          <button type="submit" className="btn-primary" disabled={loading || !url}>
            {loading ? "Procesando propiedad..." : "Generar Ficha PDF"}
          </button>
        </form>

        {loading && (
          <div className="loader-container">
            <div className="spinner"></div>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>Conectando con el portal y extrayendo imágenes en alta resolución...</p>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
      </div>
    </div>
  );
}
