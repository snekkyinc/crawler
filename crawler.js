const express = require('express');
const cors = require('cors');       // <--- added
const axios = require('axios');
const { JSDOM } = require('jsdom');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());                   // <--- added
app.use(express.json());

const crawled = new Set();

async function crawl(url, origin, foundFiles, depth = 0) {
  if (crawled.has(url) || depth > 15) return; // increased depth to 15
  crawled.add(url);

  console.log("Fetching:", url);

  try {
    const res = await axios.get(url, { 
      timeout: 10000,    // increased timeout to 10 seconds
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; CrawlerBot/1.0)'  // set User-Agent header
      }
    });

    const contentType = res.headers['content-type'];

    if (url.endsWith('.html') || url.endsWith('.js')) {
      console.log("Found file:", url);
      foundFiles.push(url);
    }

    if (contentType && contentType.includes('text/html')) {
      const dom = new JSDOM(res.data);
      const doc = dom.window.document;

      const links = [...doc.querySelectorAll('a[href], script[src]')];

      for (const link of links) {
        let href = link.href || link.src;
        if (!href) continue;

        try {
          const absoluteUrl = new URL(href, url).href;

          // For debugging, comment out the origin check to allow crawling outside origin
          // if (absoluteUrl.startsWith(origin)) {
            await crawl(absoluteUrl, origin, foundFiles, depth + 1);
          // }

        } catch (err) {
          // ignore URL parsing errors
        }
      }
    }
  } catch (err) {
    console.log(`Failed to fetch ${url}: ${err.message}`);
    // silently ignore fetch errors
  }
}

app.post('/scan', async (req, res) => {
  const { site } = req.body;
  if (!site || !site.startsWith('http')) {
    return res.status(400).json({ error: 'Invalid site URL' });
  }

  crawled.clear();
  const foundFiles = [];
  await crawl(site, new URL(site).origin, foundFiles);

  const unique = [...new Set(foundFiles)];

  res.json({ files: unique });
});

app.listen(PORT, () => {
  console.log(`Crawler backend running on port ${PORT}`);
});

