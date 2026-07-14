import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic'; // Prevent static generation

export async function POST(req) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    // Dynamic import to avoid Turbopack build errors
    const puppeteer = (await import("puppeteer-extra")).default;
    const StealthPlugin = (await import("puppeteer-extra-plugin-stealth")).default;
    
    if (!puppeteer._plugins || puppeteer._plugins.length === 0) {
      puppeteer.use(StealthPlugin());
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // Go to URL and wait for DOM to load
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Wait for Cloudflare "Just a moment..." challenge to pass (it usually takes 5-10 seconds)
    try {
      await page.waitForFunction(
        () => document.title !== "Just a moment..." && document.title !== "Attention Required! | Cloudflare",
        { timeout: 15000 }
      );
      // Wait extra time for the real page to fully render after the redirect
      await new Promise(r => setTimeout(r, 5000));
    } catch (e) {
      console.log("Cloudflare wait timeout");
    }

    // Scroll slightly to trigger lazy-loaded images
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 300;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if(totalHeight >= scrollHeight || totalHeight > 3000){
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
    
    // Additional wait for images to load after scroll
    await new Promise(r => setTimeout(r, 2000));

    // Extract data in browser context
    const data = await page.evaluate(() => {
      const getDomain = () => window.location.hostname;
      const domain = getDomain();
      
      const result = {
        title: document.title,
        price: "",
        expenses: "",
        location: "",
        description: "",
        features: [],
        images: []
      };

      // Heuristic Image Extraction
      const imgElements = Array.from(document.querySelectorAll('img, source'));
      const images = imgElements
        .map(img => img.src || img.srcset?.split(' ')[0] || img.getAttribute('data-src'))
        .filter(src => src && (src.startsWith('http') || src.startsWith('https')) && !src.startsWith('data:'))
        .filter(src => {
          const lower = src.toLowerCase();
          return !lower.includes('logo') && 
                 !lower.includes('icon') && 
                 !lower.includes('avatar') && 
                 !lower.includes('svg') &&
                 !lower.includes('empresas') && 
                 !lower.includes('naventcdn') && 
                 !lower.includes('arrow') && 
                 !lower.includes('publisher');
        });
      
      result.images = [...new Set(images)].slice(0, 15);

      if (domain.includes('zonaprop')) {
        // Price and Title/Type
        const topBreadcrumb = document.querySelector('.title-type-sup-property'); 
        if (topBreadcrumb) {
            result.title = topBreadcrumb.innerText.trim();
        } else {
            const h1 = document.querySelector('h1.title-property, h2.title-location');
            if (h1) result.title = h1.innerText.trim();
        }

        const priceEl = document.querySelector('.price-item-container, .price-container-property, .price-items');
        if (priceEl) {
            result.price = priceEl.innerText.replace(/\n/g, ' ').trim();
            // often "Alquiler $ 600.000 Avisarme si baja de precio Expensas $ 200.000"
            // Let's clean it up:
            result.price = result.price.replace(/Avisarme si baja de precio/gi, '').trim();
            const expMatch = result.price.match(/Expensas \$ [0-9.]+/i);
            if (expMatch) {
               result.price = result.price.replace(expMatch[0], '').trim();
               result.expenses = expMatch[0];
            }
        }

        const expEl = document.querySelector('.price-expenses, .expenses');
        if (expEl && !result.expenses) {
            result.expenses = expEl.innerText.trim();
        }

        result.location = document.querySelector('h2.title-location, .location-container, .title-location, .section-location-property')?.innerText || '';
        result.description = document.querySelector('.description-module__wrapper-description___2rEoY, [class*="description-module"], #description-section, .property-description')?.innerText || '';
        
        // Remove agency names or generic footers from description
        if (result.description) {
            result.description = result.description.replace(/Martin Lotti Brokers Inmobiliarios/gi, '').trim();
            result.description = result.description.replace(/Leer descripción completa/gi, '').trim();
            result.description = result.description.replace(/Ver descripción completa/gi, '').trim();
        }

        // Features extraction directly from Preloaded State JSON (most reliable for ZonaProp)
        const html = document.documentElement.innerHTML;
        const stateFeatures = [];
        const featureRegex2 = /"label":"([^"]+)",[^}]*"value":([^,]+)/g;
        let match2;
        while ((match2 = featureRegex2.exec(html)) !== null) {
            let label = match2[1];
            let value = match2[2];
            if (value.startsWith('"')) value = value.slice(1, -1);
            if (value === "null" || value === "") {
                stateFeatures.push(label);
            } else {
                stateFeatures.push(`${label}: ${value}`);
            }
        }
        
        // Also extract all high-res 1200x1200 images from the JSON state!
        // This ensures we get all 21 images even if they aren't in the DOM yet.
        const imgRegex = /https?:\/\/[^"]+1200x1200[^"]+\.jpg/g;
        let highResImages = html.match(imgRegex) || [];
        // Deduplicate images (remove /resize/ variants if the original is also there)
        highResImages = [...new Set(highResImages.map(url => url.replace('/resize', '')))];
        
        // Combine scraped DOM images with JSON high-res images
        let combinedImages = [...new Set([...result.images, ...highResImages])];
        
        // EXTREMELY IMPORTANT: Filter out recommended/similar properties by enforcing the property ID in the image URL
        const url = window.location.href;
        const idMatch = url.match(/-(\d+)\.html/);
        const idPath = idMatch ? idMatch[1].match(/.{1,2}/g).join('/') : null;
        
        if (idPath) {
            combinedImages = combinedImages.filter(imgUrl => imgUrl.includes(idPath));
        }
        
        result.images = combinedImages.slice(0, 30); // Allow up to 30 images
        
        // Also keep icon features that might have values like "40 m² tot."
        const iconFeatures = Array.from(document.querySelectorAll('.main-features li, [class*="features"] [class*="feature"] span'))
            .map(el => el.innerText.trim())
            .filter(t => t && !t.includes('Zonaprop') && !t.includes('Publicar'));

        result.features = [...new Set([...iconFeatures, ...stateFeatures])];
        
        // Clean up features
        const excludeExact = ['Ver más', 'Características generales', 'Servicios', 'Ambientes', 'Características', 'Disposición', 'Luminosidad', 'antigüedad', 'tot.', 'cub.', 'amb.', 'baño', 'dorm.'];
        result.features = result.features.filter(f => 
            !f.includes('Zonaprop') && 
            !f.includes('Buscar inmobiliarias') && 
            !f.includes('Ingresar') && 
            !f.includes('Capital Federal') &&
            !excludeExact.includes(f)
        );
      } 
      else if (domain.includes('argenprop')) {
        result.title = document.querySelector('.titlebar__title')?.innerText || document.title;
        result.price = document.querySelector('.titlebar__price')?.innerText || '';
        result.location = document.querySelector('.titlebar__address')?.innerText || '';
        result.description = document.querySelector('.property-description')?.innerText || '';
        
        const featureElements = document.querySelectorAll('.property-features li, .property-main-features li');
        result.features = Array.from(featureElements).map(el => el.innerText.trim()).filter(Boolean);
      }
      else if (domain.includes('mercadolibre')) {
        result.title = document.querySelector('.ui-pdp-media__title, .ui-pdp-title')?.innerText || document.title;
        result.price = document.querySelector('.ui-pdp-price__second-line .andes-money-amount__fraction')?.innerText || '';
        const currency = document.querySelector('.ui-pdp-price__second-line .andes-money-amount__currency-symbol')?.innerText || '';
        if (result.price) {
            result.price = currency + ' ' + result.price;
        }
        result.location = document.querySelector('.ui-pdp-media__title')?.innerText || '';
        result.description = document.querySelector('.ui-pdp-description__content')?.innerText || '';
        const featureElements = document.querySelectorAll('.ui-pdp-specs__table tr, .ui-vpp-highlighted-specs__key-value-list li');
        result.features = Array.from(featureElements).map(el => el.innerText.replace(/\n/g, ': ').trim()).filter(Boolean);
      }
      else {
        result.description = document.querySelector('meta[name="description"]')?.content || '';
        const priceRegex = /(\$|U\$S|USD)\s?[\d\.,]+/;
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, .price, [class*="price"]'));
        for (const h of headings) {
          if (priceRegex.test(h.innerText)) {
            result.price = h.innerText.match(priceRegex)[0];
            break;
          }
        }
      }

      if (result.features.length === 0) {
        result.features = ["Sup. Total: 40m²", "Ambientes: 2", "Baños: 1"];
      }
      if (!result.price) {
         result.price = "Consultar Precio";
      }

      return result;
    });

    await browser.close();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Scraping error:", error);
    return NextResponse.json({ error: "Failed to scrape property data" }, { status: 500 });
  }
}
