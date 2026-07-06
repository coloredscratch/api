export default async function handler(req, res) {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send('Missing ?url= parameter');
  }

  try {
    let decodedUrl = decodeURIComponent(targetUrl);
    if (!decodedUrl.startsWith('http://') && !decodedUrl.startsWith('https://')) {
      decodedUrl = 'https://' + decodedUrl;
    }

    const response = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    let content = await response.text();
    const contentType = response.headers.get('content-type') || 'text/html';

    if (contentType.includes('text/html')) {
      const baseUrl = decodedUrl.replace(/\/[^\/]*$/, '/');
      const proxyBaseUrl = `https://${req.headers.host}${req.url.split('?')[0]}`;

      // Add base tag for relative URLs
      content = content.replace(/<head>/, `<head><base href="${baseUrl}">`);

      // Rewrite ALL attributes that could contain URLs
      const attributes = ['href', 'src', 'action', 'data-src', 'data-href', 'data-url', 'data-original', 'data-lazy-src'];
      const attrPattern = new RegExp(`(${attributes.join('|')})=["']([^"']*)["']`, 'g');
      content = content.replace(attrPattern, (match, attr, url) => {
        const rewrittenUrl = rewriteUrl(url, baseUrl, proxyBaseUrl);
        return `${attr}="${rewrittenUrl}"`;
      });

      // Rewrite CSS url() references
      content = content.replace(/url\(["']?([^"')]*)["']?\)/g, (match, url) => {
        const rewrittenUrl = rewriteUrl(url, baseUrl, proxyBaseUrl);
        return `url("${rewrittenUrl}")`;
      });

      // Rewrite JavaScript that sets location or src
      content = content.replace(/(window\.location|document\.location|location\.href)\s*=\s*["']([^"']*)["']/g, (match, prefix, url) => {
        const rewrittenUrl = rewriteUrl(url, baseUrl, proxyBaseUrl);
        return `${prefix}="${rewrittenUrl}"`;
      });

      // Inject a script to fix dynamically loaded resources
      const fixScript = `
        <script>
          (function() {
            // Fix any relative links that the proxy might have missed
            document.addEventListener('DOMContentLoaded', function() {
              const elements = document.querySelectorAll('[src], [href]');
              elements.forEach(el => {
                const attr = el.hasAttribute('src') ? 'src' : 'href';
                const url = el.getAttribute(attr);
                if (url && url.startsWith('/') && !url.startsWith('//')) {
                  el.setAttribute(attr, '${proxyBaseUrl}?url=${encodeURIComponent(baseUrl)}' + url.substring(1));
                }
              });
            });
          })();
        </script>
      `;
      
      // Inject the fix script just before </body>
      content = content.replace(/<\/body>/, fixScript + '</body>');
    }

    // Remove restrictive headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');

    res.status(200).send(content);

  } catch (error) {
    res.status(502).send(`<h2>Proxy Error</h2><p>${error.message}</p>`);
  }
}

function rewriteUrl(url, baseUrl, proxyBaseUrl) {
  url = url.trim();
  
  if (!url || url.startsWith('data:') || url.startsWith('javascript:') || 
      url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('#')) {
    return url;
  }

  if (url.includes(proxyBaseUrl)) {
    return url;
  }

  let absoluteUrl;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    absoluteUrl = url;
  } else if (url.startsWith('//')) {
    absoluteUrl = 'https:' + url;
  } else if (url.startsWith('/')) {
    const domain = baseUrl.match(/^https?:\/\/[^\/]+/);
    absoluteUrl = domain ? domain[0] + url : baseUrl + url;
  } else {
    absoluteUrl = baseUrl + url;
  }

  return `${proxyBaseUrl}?url=${encodeURIComponent(absoluteUrl)}`;
}