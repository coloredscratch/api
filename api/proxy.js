export default async function handler(req, res) {
  // 1. Get the target URL from the query string
  const targetUrl = req.query.url;

  // 2. If no URL is provided, show an error page
  if (!targetUrl) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Proxy Error</title></head>
      <body style="font-family: Arial; padding: 40px; text-align: center;">
        <h2>Missing URL Parameter</h2>
        <p>Usage: <code>?url=https://example.com</code></p>
        <input type="text" id="urlInput" placeholder="Enter URL" style="padding: 8px; width: 300px;">
        <button onclick="window.location.href='?url='+encodeURIComponent(document.getElementById('urlInput').value)">Go</button>
      </body>
      </html>
    `);
  }

  try {
    // 3. Decode the URL and add protocol if missing
    let decodedUrl = decodeURIComponent(targetUrl);
    if (!decodedUrl.startsWith('http://') && !decodedUrl.startsWith('https://')) {
      decodedUrl = 'https://' + decodedUrl;
    }

    // 4. Fetch the target website from Vercel's servers
    const response = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    // 5. Get the content and content type
    const contentType = response.headers.get('content-type') || 'text/html';
    let content = await response.text();

    // 6. If it's HTML, rewrite links to go through the proxy
    if (contentType.includes('text/html')) {
      const baseUrl = decodedUrl.replace(/\/[^\/]*$/, '/');
      const proxyBaseUrl = `https://${req.headers.host}${req.url.split('?')[0]}`;
      
      // Add base tag to help with relative URLs
      content = content.replace(/<head>/, `<head><base href="${baseUrl}">`);
      
      // Rewrite all href, src, and action attributes
      content = content.replace(/(href|src|action)=["']([^"']*)["']/g, (match, attr, url) => {
        const rewrittenUrl = rewriteUrl(url, baseUrl, proxyBaseUrl);
        return `${attr}="${rewrittenUrl}"`;
      });
      
      // Rewrite CSS url() references
      content = content.replace(/url\(["']?([^"')]*)["']?\)/g, (match, url) => {
        const rewrittenUrl = rewriteUrl(url, baseUrl, proxyBaseUrl);
        return `url("${rewrittenUrl}")`;
      });
    }

    // 7. Set proper response headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Remove restrictive security headers that break iframe embedding
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    
    // Send the content
    res.status(200).send(content);
    
  } catch (error) {
    // 8. Handle errors gracefully
    res.status(502).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Proxy Error</title></head>
      <body style="font-family: Arial; padding: 40px; text-align: center;">
        <h2>Error Fetching URL</h2>
        <p>${error.message}</p>
        <p><a href="javascript:history.back()">Go Back</a></p>
      </body>
      </html>
    `);
  }
}

/**
 * Rewrites a URL to go through the proxy
 */
function rewriteUrl(url, baseUrl, proxyBaseUrl) {
  // Trim and clean
  url = url.trim();
  
  // Skip empty, data:, javascript:, mailto:, tel:, anchors
  if (!url || url.startsWith('data:') || url.startsWith('javascript:') || 
      url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('#')) {
    return url;
  }
  
  // If it's already a proxy URL, return as is
  if (url.includes(proxyBaseUrl)) {
    return url;
  }
  
  // Resolve absolute URL
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
  
  // Return the rewritten URL
  return `${proxyBaseUrl}?url=${encodeURIComponent(absoluteUrl)}`;
}