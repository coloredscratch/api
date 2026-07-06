export default async function handler(req, res) {
  // Get the target URL from the query string
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing ?url= parameter' });
  }

  try {
    // Fetch the target website from Vercel's servers
    const response = await fetch(targetUrl);
    const html = await response.text();

    // Return the HTML content to the browser
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(html);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
}