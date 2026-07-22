import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const SCRAPER_API_KEYS = [
  '3fbd635f92f10c5695df6a7e229ff732',  // ivalenciabocanegra@frba.utn.edu.ar
  '5a6151765f4a8861ff055504f0db5108',  // valencia.jooel@gmail.com
];

export async function POST(req) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    // Elegir una API key al azar de la lista
    const randomKey = SCRAPER_API_KEYS[Math.floor(Math.random() * SCRAPER_API_KEYS.length)];
    let responseDesktop, responseMobile;
    let desktopHtml = '', mobileHtml = '';

    console.log("Fetching via ScraperAPI:", url);
    const headers = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'es-AR,es;q=0.8,en-US;q=0.5,en;q=0.3',
    };

    if (url.includes('mercadolibre.com.ar') || url.includes('mercadolibre.com')) {
      // Mercado Libre requires two fetches: 
      // 1. Desktop version to get the features/specs table.
      // 2. Mobile version to get the full image gallery (16+ images instead of just 5).
      const urlDesktop = `https://api.scraperapi.com/?api_key=${randomKey}&url=${encodeURIComponent(url)}&country_code=ar`;
      const urlMobile = `https://api.scraperapi.com/?api_key=${randomKey}&url=${encodeURIComponent(url)}&country_code=ar&device_type=mobile`;
      
      const [resDesktop, resMobile] = await Promise.all([
        fetch(urlDesktop, { headers, signal: AbortSignal.timeout(60000) }),
        fetch(urlMobile, { headers, signal: AbortSignal.timeout(60000) })
      ]);
      
      responseDesktop = resDesktop;
      desktopHtml = await resDesktop.text();
      mobileHtml = await resMobile.text();
    } else {
      // ZonaProp and others just need one fetch
      const scraperUrl = `https://api.scraperapi.com/?api_key=${randomKey}&url=${encodeURIComponent(url)}&country_code=ar`;
      responseDesktop = await fetch(scraperUrl, { headers, signal: AbortSignal.timeout(60000) });
      desktopHtml = await responseDesktop.text();
    }

    if (!responseDesktop.ok) {
      if (responseDesktop.status === 410) {
        return NextResponse.json({ 
          error: "Esta propiedad ya no está disponible en ZonaProp (fue eliminada o expiró). Por favor usá un link vigente." 
        }, { status: 200 });
      }
      console.error("ScraperAPI error:", responseDesktop.status, responseDesktop.statusText);
      return NextResponse.json({ error: "ScraperAPI error: " + responseDesktop.status }, { status: 500 });
    }

    let data;
    if (url.includes('zonaprop.com.ar')) {
      data = parseZonaPropHTML(desktopHtml, url);
    } else if (url.includes('mercadolibre.com.ar') || url.includes('mercadolibre.com')) {
      data = parseMercadoLibreHTML(desktopHtml, url, mobileHtml);
    } else {
      return NextResponse.json({ error: "URL no soportada" }, { status: 400 });
    }

    // SANITIZATION: Strict rules to eliminate ANY trace of direct owner, agency, or contact info
    const scrubOwner = (text) => {
      if (!text) return text;
      const patterns = [
        /dueñ[oa] (directo|vende|alquila|acepta)/gi,
        /duen[oa] (directo|vende|alquila|acepta)/gi,
        /(venta|alquiler) por dueñ[oa]/gi,
        /(venta|alquiler) por duen[oa]/gi,
        /sin (intermediarios|comisi[oó]n)/gi,
        /trato (directo|con el dueñ[oa]|con propietario)/gi,
        /propietario directo/gi,
        /particular (vende|alquila)/gi,
        /solo particulares/gi,
        /no (inmobiliarias|corredores|comisionistas)/gi,
        /abstenerse (inmobiliarias|corredores|martilleros|intermediarios)/gi,
        /(inmobiliarias|intermediarios) abstenerse/gi,
        /no aceptamos (inmobiliarias|intermediaci[oó]n)/gi,
        /inmobiliarias no (llamar|molestar)/gi,
        /no responder[eé] inmobiliarias/gi,
        /no (republicar|compartir publicaci[oó]n)/gi,
        /inmobiliarias por favor no (contactar|llamar|molestar)/gi,
        /trato directo con (?:el )?(?:dueñ[oa]|duen[oa])/gi,
        /vende (?:dueñ[oa]|duen[oa])/gi
      ];
      
      let scrubbed = text;
      for (const pattern of patterns) {
        scrubbed = scrubbed.replace(pattern, '');
      }
      return scrubbed.replace(/\s{2,}/g, ' ').trim();
    };

    const isForbiddenLine = (line) => {
      const lower = line.toLowerCase();
      
      // Rule 1: Contact info & Social Media
      const contactKeywords = [
        'teléfono', 'telefono', 'tel.', 'celular', 'cel:', 'whatsapp', 'wsp', 'wp',
        'email', 'e-mail', 'mail:', '@', '.com', '.com.ar', 'sitio web', 'http', 'www.',
        'instagram', 'ig:', 'facebook', 'fb:', 'tiktok', 'linkedin', 'código qr', 'codigo qr'
      ];
      if (contactKeywords.some(kw => lower.includes(kw))) return true;

      // Phone number regex heuristics (e.g., 11-xxxx-xxxx, 15-xxxx-xxxx)
      if (/\b(?:11|15)[\s-]?\d{4}[\s-]?\d{4}\b/.test(lower)) return true;
      if (/\b\d{2,4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(lower)) return true; // generic 10+ digit phones

      // Rule 2: Real estate agency / developer keywords
      const agencyKeywords = [
        'inmobiliaria', 'propiedades', 'real estate', 'bienes raíces', 'bienes raices',
        'broker', 'estudio inmobiliario', 'desarrolladora', 'constructora', 'inversiones',
        'negocios inmobiliarios'
      ];
      if (agencyKeywords.some(kw => lower.includes(kw))) return true;

      // Rule 3: Person + role/license
      const licenseKeywords = [
        'asesor inmobiliario', 'corredor inmobiliario', 'martillero', 'corredor público', 'corredor publico',
        'matrícula', 'matricula', 'cucicba', 'cmcpsi', 'cpmclz', 'mat.', 'matriculado'
      ];
      if (licenseKeywords.some(kw => lower.includes(kw))) return true;

      // Rule 4: Institutional blocks
      const institutionalKeywords = [
        'marca comercial', 'slogan', 'sucursal', 'horario de atención', 'horario de atencion'
      ];
      if (institutionalKeywords.some(kw => lower.includes(kw))) return true;

      // Also apply the owner phrase filtering
      const ownerPhrases = [
        'dueño directo', 'dueno directo', 'dueño vende', 'dueno vende', 'dueño alquila', 'dueno alquila',
        'venta por dueño', 'venta por dueno', 'alquiler por dueño', 'alquiler por dueno',
        'sin intermediarios', 'sin comisión', 'sin comision',
        'trato directo', 'propietario directo',
        'particular vende', 'particular alquila', 'solo particulares',
        'no inmobiliarias', 'abstenerse',
        'no corredores', 'no comisionistas', 'no intermediarios',
        'no aceptamos inmobiliarias', 'no aceptamos intermediación', 'no aceptamos intermediacion',
        'inmobiliarias no llamar', 'inmobiliarias no molestar', 'no respondere inmobiliarias', 'no responderé inmobiliarias',
        'no republicar', 'no compartir'
      ];
      if (ownerPhrases.some(phrase => lower.includes(phrase))) return true;

      return false;
    };

    if (data.title) data.title = scrubOwner(data.title);
    
    if (data.description) {
      data.description = scrubOwner(data.description)
        .split('\n')
        .filter(line => !isForbiddenLine(line.trim()))
        .join('\n')
        .trim();
    }
    
    if (data.features && Array.isArray(data.features)) {
      data.features = data.features
        .filter(f => !isForbiddenLine(f.trim()))
        .map(f => scrubOwner(f))
        .filter(f => f.length > 0);
    }

    data._version = 'v3-ml-support';
    return NextResponse.json(data);

  } catch (error) {
    console.error("Scraping error:", error);
    return NextResponse.json({ error: "Failed to scrape property data", message: error.message }, { status: 500 });
  }
}

function parseZonaPropHTML(html, url) {
  const result = {
    title: '',
    price: 'Consultar Precio',
    expenses: '',
    location: '',
    description: '',
    features: [],
    images: []
  };

  const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      const props = nextData?.props?.pageProps;
      const posting = props?.posting || props?.listingData || props?.propertyData;
      if (posting) return parseFromNextData(posting);
    } catch(e) {}
  }

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    result.title = titleMatch[1].replace(' - Zonaprop', '').trim();
  }

  const priceMatch = html.match(/(?:U\$S|USD|\$)\s*[\d\.]+/g);
  if (priceMatch) result.price = priceMatch[0];

  const expensesMatch = html.match(/Expensas\s*\$?\s*[\d\.]+/i);
  if (expensesMatch) result.expenses = expensesMatch[0];

  // Try extracting location from JSON-LD
  const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  if (ldMatch) {
    ldMatch.forEach(m => {
       try {
         const jsonStr = m.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
         const json = JSON.parse(jsonStr);
         if (json.address) {
            let locParts = [json.address.streetAddress, json.address.addressRegion, json.address.addressLocality].filter(Boolean);
            result.location = locParts.join(', ').replace(', ,', ',').trim();
         }
       } catch (e) {}
    });
  }

  // Description from full container — try multiple selectors
  const descDivMatch = html.match(/<div[^>]*class="section-description"[^>]*>([\s\S]*?)<\/div>/i) ||
                       html.match(/<div[^>]*data-qa="posting-description"[^>]*>([\s\S]*?)<\/div>/i) || 
                       html.match(/<div[^>]*id="longDescription"[^>]*>([\s\S]*?)<\/div>/i) ||
                       html.match(/<div[^>]*id="reactDescription"[^>]*>([\s\S]*?)<\/div>/i);
                       
  if (descDivMatch && (descDivMatch[1] || descDivMatch[2] || descDivMatch[3] || descDivMatch[4])) {
    let rawDesc = descDivMatch[1] || descDivMatch[2] || descDivMatch[3] || descDivMatch[4];
    let cleanDesc = rawDesc
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ');

    // Filter out unwanted competitor/publisher/legal blocks
    cleanDesc = cleanDesc.split('\n').filter(line => {
      const lower = line.trim().toLowerCase();
      if (!lower) return false;
      return !lower.includes('re/max') && 
             !lower.includes('remax') && 
             !lower.includes('zonaprop') && 
             !lower.includes('argenprop') && 
             !lower.includes('mercado libre') && 
             !lower.includes('inmobiliaria') &&
             !lower.includes('matrícula') &&
             !lower.includes('matricula') &&
             !lower.includes('ver datos') &&
             !lower.includes('cucicba') &&
             !lower.includes('leer menos') &&
             !lower.includes('kiteprop') &&
             !lower.includes('publicado usando') &&
             !lower.includes('crm inmobiliario') &&
             !lower.includes('toda la información del aviso') &&
             !lower.includes('art. 973') &&
             !lower.includes('estimativos') &&
             !lower.includes('sujetos a modificación') &&
             !lower.includes('- kp') &&
             !lower.includes('- kpt');
    }).join('\n').trim();

    result.description = cleanDesc;
  } else {
    const descMatch = html.match(/<meta name="description" content="([^"]+)"/);
    if (descMatch) result.description = descMatch[1].replace(/RE\/MAX|Remax|Zonaprop|Argenprop/gi, '');
  }

  // Extract images — get 1200x1200 first, fallback to 720x532
  let imgRegex = /https?:\/\/[^"'\s]+1200x1200[^"'\s]*\.(?:jpg|jpeg|webp)/gi;
  let allMatches = (html.match(imgRegex) || []).map(url => url.replace('/resize', ''));
  let foundImages = [...new Set(allMatches)];
  
  if (!foundImages.length) {
    imgRegex = /https?:\/\/[^"'\s]+720x532[^"'\s]*\.(?:jpg|jpeg|webp)/gi;
    allMatches = (html.match(imgRegex) || []).map(url => url.replace('/resize', ''));
    foundImages = [...new Set(allMatches)];
  }
  if (!foundImages.length) {
    imgRegex = /https?:\/\/[^"'\s]+360x266[^"'\s]*\.(?:jpg|jpeg|webp)/gi;
    allMatches = (html.match(imgRegex) || []).map(url => url.replace('/resize', ''));
    foundImages = [...new Set(allMatches)];
  }
  // Filter only property images (from avisos path), skip logos/icons
  result.images = foundImages.filter(img => img.includes('/avisos/')).slice(0, 30);

  // Extract Features robustly
  const featureRegex = /"label"\s*:\s*"([^"]+)"\s*,\s*"measure"\s*:\s*(?:"([^"]+)"|null)\s*,\s*"value"\s*:\s*(?:"([^"]+)"|null)/g;
  const features = new Set();
  let match;
  while ((match = featureRegex.exec(html)) !== null) {
    const label = match[1].trim();
    const measure = match[2];
    const value = match[3];
    
    if (!label || label.length > 50) continue;
    
    let feat = label;
    if (value && measure && measure !== 'null' && value !== 'null') feat = `${value} ${measure} ${label}`;
    else if (value && value !== 'null') feat = `${label}: ${value}`;
    
    // Filter out common UI labels
    if (!feat.includes('ZonaProp') && !feat.includes('Buscar') && !feat.includes('Publicar')) {
      features.add(feat);
    }
  }
  
  result.features = [...features].slice(0, 20);

  return result;
}

function parseFromNextData(posting) {
  const result = {
    title: '',
    price: 'Consultar Precio',
    expenses: '',
    location: '',
    description: '',
    features: [],
    images: []
  };

  result.title = posting.title || posting.postingTitle || posting.propertyType || '';

  const priceOps = posting.priceOperationTypes || [];
  if (priceOps.length > 0 && priceOps[0].prices?.length > 0) {
    const p = priceOps[0].prices[0];
    result.price = `${p.currency} ${p.amount?.toLocaleString('es-AR')}`;
  } else if (posting.price?.amount) {
    result.price = `${posting.price.currency || ''} ${posting.price.amount?.toLocaleString('es-AR')}`.trim();
  }

  if (posting.expenses?.amount) {
    result.expenses = `Expensas ${posting.expenses.currency || '$'} ${posting.expenses.amount?.toLocaleString('es-AR')}`;
  }

  const loc = posting.postingLocation || posting.location || {};
  result.location = [
    loc.address?.name,
    loc.neighbourhood?.name,
    loc.city?.name,
    loc.state?.name
  ].filter(Boolean).join(', ');

  let cleanDesc = (posting.richDescription || posting.description || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ');
    
  result.description = cleanDesc.split('\n').filter(line => {
    const lower = line.toLowerCase();
    return !lower.includes('re/max') && 
           !lower.includes('remax') && 
           !lower.includes('zonaprop') && 
           !lower.includes('argenprop') && 
           !lower.includes('mercado libre') && 
           !lower.includes('inmobiliaria') &&
           !lower.includes('propiedades') &&
           !lower.includes('matrícula') &&
           !lower.includes('matricula') &&
           !lower.includes('cel 1') &&
           !lower.includes('ver datos') &&
           !lower.includes('cucicba') &&
           !lower.includes('leer menos');
  }).join('\n').trim();

  const mainFeatures = posting.mainFeatures || [];
  const generalFeatures = posting.generalFeatures || posting.detailedFeatures || [];
  result.features = [...mainFeatures, ...generalFeatures]
    .map(f => f.value ? `${f.label}: ${f.value}` : f.label)
    .filter(Boolean);

  const photos = posting.photos || posting.postingImages || posting.images || [];
  result.images = photos
    .map(p => {
      const imgUrl = p.image || p.url || p.src || (typeof p === 'string' ? p : '');
      return imgUrl.replace(/\d+x\d+/, '1200x1200').replace('/resize', '');
    })
    .filter(img => img && img.startsWith('http'))
    .slice(0, 30);

  return result;
}

function parseMercadoLibreHTML(html, url, mobileHtml = null) {
  const result = {
    title: '',
    price: 'Consultar Precio',
    expenses: '',
    location: '',
    description: '',
    features: [],
    images: []
  };

  // Title
  const titleMatch = html.match(/<h1 class="ui-pdp-title">([^<]+)<\/h1>/);
  if (titleMatch) {
    result.title = titleMatch[1].trim();
  } else {
    const titleMeta = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMeta) result.title = titleMeta[1].replace(/ \| MercadoLibre/i, '').replace(/ - MercadoLibre/i, '').trim();
  }

  // Price
  const currencySymbol = html.match(/<span class="andes-money-amount__currency-symbol"[^>]*>([^<]+)/);
  const priceAmount = html.match(/<span class="andes-money-amount__fraction"[^>]*>([^<]+)/);
  if (priceAmount) {
    result.price = `${currencySymbol ? currencySymbol[1] : '$'} ${priceAmount[1]}`;
  }

  // Features from andes-table (extract early to get expenses from here)
  const headers = [...html.matchAll(/<th class="andes-table__header[^"]*"[^>]*>([\s\S]*?)<\/th>/gi)];
  const columns = [...html.matchAll(/<td class="andes-table__column[^"]*"[^>]*>([\s\S]*?)<\/td>/gi)];
  const allFeatures = [];
  for (let i = 0; i < Math.min(headers.length, columns.length); i++) {
    const key = headers[i][1].replace(/<[^>]+>/g, '').trim();
    const val = columns[i][1].replace(/<[^>]+>/g, '').trim();
    if (key && val && (key + val).length < 80) {
      allFeatures.push({ key, val, text: `${key}: ${val}` });
    }
  }

  // Expenses — from features table
  const expFeature = allFeatures.find(f => f.key.toLowerCase().includes('expensas'));
  if (expFeature) {
    result.expenses = `Expensas $${expFeature.val.replace(/\s*ARS/, '')}`;
  }

  // Features — filter out expenses (already shown separately) and limit to 20
  result.features = allFeatures
    .filter(f => !f.key.toLowerCase().includes('expensas'))
    .map(f => f.text)
    .slice(0, 20);

  // Location — priority: 1) street address from JSON label, 2) breadcrumbs + neighborhood/city
  const labelText = html.match(/"label"\s*:\s*\{[^}]*"text"\s*:\s*"([^"]*(?:al \d+|al\d+)[^"]*)"/i);
  const neighborhoodMatch = html.match(/"neighborhood"\s*:\s*"([^"]+)"/i);
  const cityMatch = html.match(/"city"\s*:\s*"([^"]+)"/i);
  
  if (labelText) {
    let loc = labelText[1];
    if (neighborhoodMatch && !loc.toLowerCase().includes(neighborhoodMatch[1].toLowerCase())) {
      loc = `${loc}, ${neighborhoodMatch[1]}`;
    }
    result.location = loc;
  } else {
    const crumbs = html.match(/<li class="andes-breadcrumb__item"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/gi);
    if (crumbs) {
      const crumbTexts = crumbs
        .map(c => c.replace(/<[^>]+>/g, '').trim())
        .filter(t => t && t !== '...' && t.length > 1 
          && !t.toLowerCase().includes('venta') 
          && !t.toLowerCase().includes('alquiler')
          && !t.toLowerCase().includes('departamento') 
          && !t.toLowerCase().includes('emprendimiento')
          && !t.toLowerCase().includes('inmueble'));
      const unique = [...new Set(crumbTexts)];
      if (unique.length) result.location = unique.join(', ');
    }
    if (neighborhoodMatch || cityMatch) {
      const parts = [neighborhoodMatch?.[1], cityMatch?.[1]].filter(Boolean);
      const enriched = [...new Set(parts)].join(', ');
      if (!result.location || result.location.length < enriched.length) {
        result.location = enriched;
      }
    }
  }

  // Description
  const descMatch = html.match(/<p class="ui-pdp-description__content">([\s\S]*?)<\/p>/i);
  if (descMatch) {
    result.description = descMatch[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .split('\n')
      .filter(line => {
        const lower = line.trim().toLowerCase();
        if (!lower) return false;
        return !lower.includes('mercado libre') &&
               !lower.includes('mercadolibre') &&
               !lower.includes('ver datos') &&
               !lower.includes('leer menos');
      })
      .join('\n')
      .trim();
  } else {
    const metaDesc = html.match(/<meta name="description" content="([^"]+)"/);
    if (metaDesc) result.description = metaDesc[1];
  }

  // Images — extracted from mobile HTML if available to get all 16+ photos
  const imageSourceHtml = mobileHtml ? mobileHtml : html;
  const allImgUrls = imageSourceHtml.match(/https:\/\/http2\.mlstatic\.com\/D_NQ_NP_[^"'\s]+/g) || [];
  const cleaned = allImgUrls.map(u => u.split(' ')[0]); // remove srcset suffixes
  
  // Try original quality first (-O), then full (-F), with or without -null suffix
  let images = [...new Set(cleaned.filter(u => /D_NQ_NP_[^"'\s]+-O(?:-null)?\.(webp|jpg|jpeg|png)$/.test(u)))];
  if (!images.length) {
    images = [...new Set(cleaned.filter(u => /D_NQ_NP_[^"'\s]+-F(?:-null)?\.(webp|jpg|jpeg|png)$/.test(u)))];
  }
  if (!images.length) {
    // Last resort: any D_NQ_NP_ image
    images = [...new Set(cleaned.filter(u => /D_NQ_NP_[^"'\s]+\.(webp|jpg|jpeg|png)$/.test(u)))];
  }
  result.images = images.slice(0, 30);

  return result;
}
