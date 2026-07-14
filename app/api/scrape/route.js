import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const SCRAPER_API_KEY = '3fbd635f92f10c5695df6a7e229ff732';

export async function POST(req) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    // Use ScraperAPI to bypass Cloudflare - residential IPs that ZonaProp can't block
    const scraperUrl = `https://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}&country_code=ar`;

    console.log("Fetching via ScraperAPI:", url);
    
    const response = await fetch(scraperUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      if (response.status === 410) {
        return NextResponse.json({ 
          error: "Esta propiedad ya no está disponible en ZonaProp (fue eliminada o expiró). Por favor usá un link vigente." 
        }, { status: 200 });
      }
      console.error("ScraperAPI error:", response.status, response.statusText);
      return NextResponse.json({ error: "ScraperAPI error: " + response.status }, { status: 500 });
    }

    const html = await response.text();
    
    if (html.includes('Just a moment') && html.includes('cf-browser-verification')) {
      return NextResponse.json({ error: "Cloudflare challenge not bypassed" }, { status: 500 });
    }

    const data = parseZonaPropHTML(html, url);
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

  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  if (titleMatch) result.title = titleMatch[1].trim();
  if (!result.title) {
    const metaTitleMatch = html.match(/<title>([^<]+)<\/title>/);
    if (metaTitleMatch) result.title = metaTitleMatch[1].replace(/\s*[\|\-]\s*ZonaProp.*$/i, '').trim();
  }

  const priceMatch = html.match(/(?:U\$S|USD|\$)\s*[\d\.]+/g);
  if (priceMatch) result.price = priceMatch[0];

  // Description from full container or meta
  const descDivMatch = html.match(/<div[^>]*data-qa="posting-description"[^>]*>([\s\S]*?)<\/div>/i) || 
                       html.match(/<div[^>]*id="longDescription"[^>]*>([\s\S]*?)<\/div>/i);
                       
  if (descDivMatch && descDivMatch[1]) {
    let cleanDesc = descDivMatch[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ');

    // Filter out unwanted competitor/publisher blocks
    cleanDesc = cleanDesc.split('\n').filter(line => {
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

    result.description = cleanDesc;
  } else {
    const descMatch = html.match(/<meta name="description" content="([^"]+)"/);
    if (descMatch) result.description = descMatch[1].replace(/RE\/MAX|Remax|Zonaprop|Argenprop/gi, '');
  }

  const imgRegex = /https?:\/\/[^"'\s]+1200x1200[^"'\s]*\.(?:jpg|jpeg|webp)/gi;
  const foundImages = [...new Set(html.match(imgRegex) || [])];
  const idMatch = url.match(/-(\d{6,12})\.html/);
  if (idMatch) {
    const idPath = idMatch[1].match(/.{1,2}/g)?.join('/');
    result.images = idPath 
      ? foundImages.filter(img => img.includes(idPath)).slice(0, 30)
      : foundImages.slice(0, 30);
  } else {
    result.images = foundImages.slice(0, 30);
  }

  const featureRegex = /"label":"([^"]+)","value":"?([^",}]*)"?/g;
  const features = new Set();
  let match;
  while ((match = featureRegex.exec(html)) !== null) {
    const label = match[1].trim();
    const value = match[2].trim();
    if (label && value && value !== 'null' && label.length < 50) {
      features.add(value ? `${label}: ${value}` : label);
    }
  }
  result.features = [...features].filter(f => 
    !f.includes('ZonaProp') && !f.includes('Buscar') && !f.includes('Publicar')
  ).slice(0, 20);

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
