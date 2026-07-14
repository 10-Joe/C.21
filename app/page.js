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
      link.download = `Ficha_Tecnica_${propertyData.id || "Propiedad"}.pdf`;
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
        <div className="brand-circle">21</div>
        <div className="brand-title">
          CENTURY 21<span className="brand-reg">®</span>
        </div>
        <div className="brand-subtitle">MAUVECIN</div>
      </div>
      
      <h1>Generador de Fichas</h1>
      <p className="subtitle">
        Herramienta exclusiva para agentes. Genera PDFs profesionales sin marcas de agua de portales.
      </p>

      <div className="form-card">
        <form className="input-group" onSubmit={handleGenerate}>
          <input
            type="url"
            className="input-field"
            placeholder="Pega el link de ZonaProp, Argenprop o MercadoLibre..."
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
