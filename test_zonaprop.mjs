import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  
  await page.goto('https://www.zonaprop.com.ar/propiedades/clasificado/alclapin-depto-2-amb-esquina-corrientes-recien-pintado-59486645.html', { waitUntil: 'networkidle2', timeout: 45000 });

  const imgs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img')).map(img => {
      return { src: img.src, class: img.className, alt: img.alt };
    });
  });

  console.log(JSON.stringify(imgs, null, 2));
  
  await browser.close();
})();
