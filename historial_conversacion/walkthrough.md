# Generador de Fichas Técnicas - Finalizado

La aplicación para generar fichas técnicas profesionales sin marca de anunciante ya está lista para usarse.

## Lo que se ha implementado

1. **Frontend Premium**: 
   - Diseño glassmorphism elegante, sin depender de Tailwind (usando Vanilla CSS puro).
   - Animaciones fluidas, notificaciones de éxito/error y estado de carga mientras se extrae la información y se genera el PDF.

2. **Scraping (Extracción de Datos)**:
   - Se implementó un backend con **Puppeteer** (navegador headless) para extraer inteligentemente: Precio, Expensas, Características principales, Ubicación, Descripción y un límite de 10 Imágenes. 
   - Se agregaron heurísticas específicas para procesar correctamente las URL de **ZonaProp, Argenprop y Mercado Libre**.

3. **Generación de PDF Fiel al Original**:
   - Recreamos el estilo exacto de Century 21 a partir del PDF de muestra usando HTML y convirtiéndolo a PDF (formato A4) con Puppeteer para garantizar una calidad perfecta (nada de capturas borrosas).
   - La primera página resume los datos y contiene una imagen principal; a partir de la segunda página se crea un grid/catálogo con el resto de las imágenes obtenidas de la publicación original.

## Cómo probarlo

1. Abre tu terminal en la carpeta del proyecto (`C:\Users\Admin\.gemini\antigravity\scratch\generador-fichas`).
2. Ejecuta `npm run dev` para levantar el servidor local de Next.js.
3. Ingresa a `http://localhost:3000` en tu navegador.
4. Pega un enlace de ZonaProp, Argenprop o MercadoLibre.
5. Haz clic en "Generar Ficha" y la aplicación automáticamente procesará y descargará el PDF limpio.

> [!TIP]
> Si una página tiene medidas antibots muy extremas en algún momento futuro, la aplicación capturará al menos la información visible y las imágenes grandes disponibles a primera vista. 

¡Ya puedes usar el sistema!
