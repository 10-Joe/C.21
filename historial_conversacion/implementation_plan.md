# Implementación de Scraping para Mercado Libre

Actualmente el generador de fichas técnicas funciona exclusivamente con ZonaProp. Para soportar Mercado Libre Inmuebles, necesitamos agregar una nueva lógica de extracción en el backend, ya que la estructura HTML de Mercado Libre es completamente diferente.

## Proposed Changes

### Backend (`app/api/scrape/route.js`)

Se detectará si la URL provista pertenece a `mercadolibre.com.ar`. Si es así, se derivará el HTML a una nueva función dedicada a extraer datos de Mercado Libre.

#### [MODIFY] `route.js`
- **Detección de URL:** Modificar la función `POST` principal para chequear `url.includes('mercadolibre.com.ar')`.
- **Nueva Función `parseMercadoLibreHTML(html, url)`:**
  - **Título:** Extraer del tag `<h1>` con clase `ui-pdp-title`.
  - **Precio:** Extraer de los meta tags `<meta itemprop="price">` y `<meta itemprop="priceCurrency">` (o de los tags visuales de precio de ML).
  - **Expensas:** Buscar en la tabla de características (`andes-table`) o en la descripción.
  - **Ubicación:** Extraer de la sección del mapa o del JSON-LD de la página (schema.org/RealEstateAgent o schema.org/Place).
  - **Descripción:** Extraer del div `<p class="ui-pdp-description__content">` y limpiar texto basura si lo hubiera.
  - **Imágenes:** Mercado Libre guarda sus imágenes en alta resolución en `http2.mlstatic.com/D_NQ_NP_...`. Se usará una expresión regular para capturar estas imágenes en alta calidad (limitando a 30 imágenes como en ZonaProp).
  - **Características:** Extraer la tabla principal de características (Superficie total, Ambientes, Baños, etc.) analizando las clases `andes-table__header` y `andes-table__column`.

## Open Questions

> [!IMPORTANT]
> **Bloqueos Antispam de Mercado Libre**
> Mercado Libre tiene protecciones muy fuertes. Usaremos ScraperAPI (que ya tenés configurado) para evadirlas. Si por alguna razón Mercado Libre devuelve un "Captcha" a través de ScraperAPI, podríamos necesitar activar la opción `render=true` (renderizado con navegador real) en ScraperAPI, lo cual consume un poco más de créditos por petición. ¿Estás de acuerdo con activar esta opción si fuera estrictamente necesario?

## Verification Plan

1. Actualizaré el backend con el soporte para Mercado Libre.
2. Pushearemos a GitHub y forzaremos un nuevo deploy en Render.
3. Haremos una prueba real con un link de un departamento en venta en Mercado Libre para asegurar que traiga título, precio, descripción, imágenes en alta calidad y la ubicación.
4. Generaremos un PDF de prueba.
