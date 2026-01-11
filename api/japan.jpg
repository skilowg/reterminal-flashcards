export default async function handler(req, res) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return res.status(500).send("Missing UNSPLASH_ACCESS_KEY");

  const query = (req.query.q ?? "japan tokyo kyoto").toString();

  const apiUrl = new URL("https://api.unsplash.com/photos/random");
  apiUrl.searchParams.set("query", query);
  apiUrl.searchParams.set("orientation", "landscape");
  apiUrl.searchParams.set("content_filter", "high");

  const r = await fetch(apiUrl.toString(), {
    headers: { Authorization: `Client-ID ${accessKey}` },
    cache: "no-store",
  });
  if (!r.ok) return res.status(502).send(`Unsplash API error: ${r.status}`);

  const photo = await r.json();

  // Record download (recommended by Unsplash API guidance)
  if (photo?.links?.download_location) {
    try {
      await fetch(`${photo.links.download_location}&client_id=${accessKey}`, { cache: "no-store" });
    } catch (_) {}
  }

  // Force 800x480 crop for the e-ink panel
  const img = new URL(photo.urls.raw);
  img.searchParams.set("w", "800");
  img.searchParams.set("h", "480");
  img.searchParams.set("fit", "crop");
  img.searchParams.set("q", "80");
  img.searchParams.set("fm", "jpg");

  const imgResp = await fetch(img.toString(), { cache: "no-store" });
  if (!imgResp.ok) return res.status(502).send(`Image fetch error: ${imgResp.status}`);

  const buf = Buffer.from(await imgResp.arrayBuffer());
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(buf);
}
