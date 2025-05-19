const express = require('express');
const cors = require('cors');       // <--- add this line
const axios = require('axios');
const { JSDOM } = require('jsdom');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());                   // <--- add this line
app.use(express.json());

const crawled = new Set();

async function crawl(url, origin, foundFiles, depth = 0) {
  if (crawled.has(url) || depth > 10) return;
  crawled.add(url);

  try {
    const res = await axios.get(url, { timeout: 5000 });
    const contentType = res.headers['content-type'];

    if (url.endsWith('.html') || url.endsWith('.js')) {
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
          if (absoluteUrl.startsWith(origin)) {
            await crawl(absoluteUrl, origin, foundFiles, depth + 1);
          }
        } catch {}
      }
    }
  } catch (err) {
    // ignore errors
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
