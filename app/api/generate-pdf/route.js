import { NextResponse } from "next/server";
import puppeteer from "puppeteer";

export async function POST(req) {
  try {
    const data = await req.json();

    const {
      title,
      price,
      expenses,
      location,
      description,
      features,
      images,
    } = data;

    // Filter valid images and deduplicate
    const validImages = Array.isArray(images) 
      ? [...new Set(images)].filter(img => img && img.startsWith('http')) 
      : [];
      
    const mainImage = validImages.length > 0 ? validImages[0] : "";
    const galleryImages = validImages.length > 1 ? validImages.slice(1, 40) : [];

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Ficha Técnica</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
        
        body {
          font-family: 'Roboto', sans-serif;
          margin: 0;
          padding: 0;
          color: #333;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        
        .page {
          width: 210mm;
          padding: 20mm;
          box-sizing: border-box;
          position: relative;
        }

        /* Top Right Logo */
        .corner-logo {
          position: absolute;
          top: 15mm;
          right: 15mm;
          width: 120px;
          height: 120px;
        }

        /* Header */
        .header {
          text-align: center;
          margin-bottom: 25px;
          padding-bottom: 10px;
          margin-top: 10px;
        }
        .header .adherido {
          font-size: 11px;
          color: #333;
          font-weight: 500;
          margin: 0 0 5px 0;
        }
        .header h1 {
          margin: 0;
          font-size: 34px;
          color: #000;
          letter-spacing: 3px;
          font-weight: 700;
        }
        .header h2 {
          margin: 5px 0;
          font-size: 18px;
          font-weight: 700;
          color: #000;
        }
        .header .cucicba {
          font-size: 11px;
          color: #000;
          margin: 5px 0 15px 0;
          font-weight: 500;
        }
        .contact-info {
          font-size: 11px;
          color: #222;
          margin-top: 5px;
        }

        /* Layout */
        .content-wrapper {
          margin-top: 20px;
        }
        
        .sidebar {
          float: left;
          width: 32%;
          background: #e9e9e9;
          margin-right: 3%;
          padding: 0;
          margin-bottom: 20px;
        }

        /* Sidebar content */
        .section-title {
          font-size: 14px;
          font-weight: 700;
          color: #444;
          text-transform: uppercase;
          border-bottom: 3px solid #888;
          padding-bottom: 5px;
          margin-bottom: 15px;
          margin-top: 0;
        }
        
        .sidebar .section-title {
          margin-top: 15px;
          margin-left: 15px;
          margin-right: 15px;
        }

        .sidebar .section-title:first-child {
          margin-top: 15px;
        }
        
        .feature-list {
          list-style: none;
          padding: 0 15px 15px 15px;
          margin: 0;
          font-size: 12px;
          line-height: 1.6;
        }
        .feature-list li {
          margin-bottom: 6px;
        }
        .feature-list li::before {
          content: "•";
          color: #000;
          display: inline-block;
          width: 1em;
          margin-left: -1em;
          font-weight: bold;
        }

        /* Main Content */
        .main-image {
          float: right;
          width: 65%;
          height: 320px;
          object-fit: cover;
          margin-bottom: 15px;
        }

        .location-title {
          margin-left: 35%;
          text-align: center;
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 5px;
          text-transform: uppercase;
          clear: right;
        }

        .location {
          margin-left: 35%;
          text-align: center;
          font-size: 13px;
          margin-bottom: 25px;
          color: #333;
        }

        .description-title {
          font-size: 14px;
          font-weight: 700;
          text-transform: uppercase;
          margin-bottom: 10px;
        }

        .description {
          font-size: 12px;
          line-height: 1.6;
          color: #222;
          white-space: pre-wrap;
          text-align: justify;
        }

        .gallery-section {
          clear: both;
          margin-top: 40px;
        }
        
        .gallery-page-title {
          font-family: Arial, sans-serif;
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 20px;
          margin-top: 10px;
          text-transform: uppercase;
          border-bottom: 2px solid #888;
          padding-bottom: 5px;
        }
        
        .gallery-flex {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
        }
        
        .gallery-img {
          width: calc(33.333% - 10px);
          height: 150px;
          object-fit: cover;
          page-break-inside: avoid;
        }
      </style>
    </head>
    <body>
      <div class="page">
        <!-- Top Right Logo -->
        <svg class="corner-logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M 50 10 A 40 40 0 1 1 20 80" stroke="#b49b57" stroke-width="6" fill="none" stroke-linecap="round" />
          <text x="50" y="68" font-family="Arial" font-weight="bold" font-size="45" fill="#b49b57" text-anchor="middle">21</text>
        </svg>

        <!-- Header -->
        <div class="header">
          <p class="adherido">Adherido al sistema</p>
          <h1>CENTURY 21<span style="font-size: 14px; vertical-align: super;">®</span></h1>
          <h2>Mauvecin</h2>
          <p class="cucicba">CMCDJLM 923 / CUCICBA 8439</p>
          
          <div class="contact-info">
            Dr. Ricardo Balbín 4050, Saavedra, Capital Federal<br>
            T (011)3621-2121 | contacto@c21mauvecin.com.ar | c21mauvecin.com.ar
          </div>
        </div>

        <div class="content-wrapper">
          <!-- Sidebar -->
          <div class="sidebar">
            <div class="section-title">Datos de la Propiedad</div>
            <ul class="feature-list">
              ${title ? "<li><strong>Propiedad:</strong> " + title + "</li>" : ""}
              <li><strong>Precio:</strong> ${price || "Consultar"}</li>
              ${expenses ? "<li><strong>Expensas:</strong> " + expenses + "</li>" : ""}
            </ul>

            <div class="section-title">Datos Generales</div>
            <ul class="feature-list">
              ${(features || []).map(f => "<li>" + f + "</li>").join('')}
            </ul>
          </div>

          <!-- Main Image and Location -->
          ${mainImage ? '<img src="' + mainImage + '" class="main-image" />' : ""}
          
          <div class="location-title">UBICACIÓN DEL INMUEBLE</div>
          <div class="location">${location || "Ubicación a consultar"}</div>
          
          <!-- Description starts here and flows around sidebar -->
          <div class="description-title">DESCRIPCIÓN</div>
          <div class="description">${description || "Sin descripción."}</div>
          
        </div>

        <!-- Gallery Section -->
        <div class="gallery-section">
          <div class="gallery-page-title">${title || 'Catálogo de Fotos'}</div>
          
          <div class="gallery-flex">
            ${galleryImages.map(img => `<img src="${img}" class="gallery-img" />`).join('')}
          </div>
        </div>
      </div>
    </body>
    </html>
    `;

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });
    
    const page = await browser.newPage();
    
    await page.setContent(htmlContent, { 
      waitUntil: ['load', 'networkidle2'],
      timeout: 45000 
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });

    await browser.close();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="Ficha_Tecnica.pdf"',
      }
    });

  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json({ error: "Failed to generate PDF", details: error.message }, { status: 500 });
  }
}
