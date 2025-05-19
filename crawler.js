const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { JSDOM } = require('jsdom');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const MAX_DEPTH = 10;
const MAX_FILES = 50;

app.post('/scan', async (req, res) => {
  const { site } = req.body;
  if (!site || !site.startsWith('http')) {
    return res.status(400).json({ error: 'Invalid site URL' });
  }

  const originHost = new URL(site).hostname;
  const crawled = new Set();
  const foundFiles = [];

  // Queue stores objects: { url, depth }
  const queue = [{ url: site, depth: 0 }];

  while (queue.length > 0) {
    const { url, depth } = queue.shift();

    if (crawled.has(url) || depth > MAX_DEPTH || foundFiles.length >= MAX_FILES) {
      continue;
    }
    crawled.add(url);

    try {
      const resFetch = await axios.get(url, {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrawlerBot/1.0)' },
      });

      const contentType = resFetch.headers['content-type'];

      if (url.endsWith('.html') || url.endsWith('.js')) {
        foundFiles.push(url);
        console.log('Found:', url);
      }

      if (contentType && contentType.includes('text/html')) {
        const dom = new JSDOM(resFetch.data);
        const doc = dom.window.document;

        const links = [...doc.querySelectorAll('a[href], script[src]')];

        for (const link of links) {
          let href = link.href || link.src;
          if (!href) continue;

          try {
            const absoluteUrl = new URL(href, url);
            if (absoluteUrl.hostname === originHost) {
              queue.push({ url: absoluteUrl.href, depth: depth + 1 });
            }
          } catch (e) {
            // ignore invalid URLs
          }
        }
      }
    } catch (err) {
      console.log(`Error fetching ${url}: ${err.message}`);
      // ignore fetch errors
    }
  }

  res.json({ files: [...new Set(foundFiles)] });
});

app.listen(PORT, () => {
  console.log(`Crawler backend running on port ${PORT}`);
});
