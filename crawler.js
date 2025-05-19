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
const REQUEST_DELAY_MS = 200; // optional polite delay between requests

// Helper delay function
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

app.post('/scan', async (req, res) => {
  const { site } = req.body;
  if (!site || !site.startsWith('http')) {
    return res.status(400).json({ error: 'Invalid site URL' });
  }

  const originHost = new URL(site).hostname;
  const crawled = new Set();
  const foundFiles = [];

  // Queue holds { url, depth }
  const queue = [{ url: site, depth: 0 }];

  while (queue.length > 0) {
    if (foundFiles.length >= MAX_FILES) {
      console.log('Reached max files limit:', MAX_FILES);
      break;
    }

    const { url, depth } = queue.shift();

    if (crawled.has(url) || depth > MAX_DEPTH) {
      continue;
    }
    crawled.add(url);

    try {
      console.log(`Crawling: ${url} (depth: ${depth})`);
      const resFetch = await axios.get(url, {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrawlerBot/1.0)' },
      });

      const contentType = resFetch.headers['content-type'] || '';

      // Add .js files by URL ending
      if (url.endsWith('.js')) {
        foundFiles.push(url);
        console.log('Found JS file:', url);
      }
      // Add HTML pages either by content-type or .html extension
      else if (
        contentType.includes('text/html') ||
        url.endsWith('.html')
      ) {
        foundFiles.push(url);
        console.log('Found HTML page:', url);
      }

      // Only parse links if content is HTML and we haven't reached max files
      if (contentType.includes('text/html') && foundFiles.length < MAX_FILES) {
        const dom = new JSDOM(resFetch.data);
        const doc = dom.window.document;

        const links = [...doc.querySelectorAll('a[href], script[src]')];

        for (const link of links) {
          let href = link.href || link.src;
          if (!href) continue;

          try {
            const absoluteUrl = new URL(href, url);
            if (absoluteUrl.hostname === originHost && !crawled.has(absoluteUrl.href)) {
              queue.push({ url: absoluteUrl.href, depth: depth + 1 });
            }
          } catch {
            // ignore invalid URLs
          }
        }
      }
    } catch (err) {
      console.log(`Error fetching ${url}: ${err.message}`);
      // continue silently on error
    }

    // Polite delay to avoid hammering the server (optional)
    await delay(REQUEST_DELAY_MS);
  }

  // Deduplicate foundFiles just in case and send response
  res.json({ files: [...new Set(foundFiles)] });
});

app.listen(PORT, () => {
  console.log(`Crawler backend running on port ${PORT}`);
});
