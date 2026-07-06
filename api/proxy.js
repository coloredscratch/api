export default async function handler(req, res) {
  // 1. Get the target URL from the request's query string
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing ?url= parameter' });
  }

  try {
    // 2. Your Vercel function fetches the target website
    const response = await fetch(targetUrl);
    const html = await response.text();

    // 3. Return the HTML content to the browser
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*'); // Helps with CORS
    res.status(200).send(html);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
}