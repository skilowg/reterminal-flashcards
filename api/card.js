export default async function handler(req, res) {
  const level = req.query.level ?? "2"; // default N2

  const api = new URL("https://jlpt-vocab-api.vercel.app/api/words/random");
  api.searchParams.set("level", level);

  const r = await fetch(api.toString(), {
    headers: { "cache-control": "no-store" },
  });

  if (!r.ok) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(`API error: ${r.status}`);
    return;
  }

  const j = await r.json();

  const word = j.word ?? "";
  const furi = j.furigana ? `(${j.furigana})` : "";
  const meaning = j.meaning ?? "";
  const meta = `N${level} · ${j.romaji ?? ""}`;

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  // NOTE: No <style> tag. Inline styles only for max compatibility with e-ink web renderers.
  res.end(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta http-equiv="refresh" content="3600"/>
</head>

<body style="margin:0; width:100vw; height:100vh; background:#000; color:#fff; font-family:system-ui,-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif;">
  <table style="width:100%; height:100%; border-collapse:collapse;">
    <tr>
      <td style="text-align:center; vertical-align:middle; padding:24px;">
        <div style="max-width:760px; margin:0 auto;">
          <div style="font-size:120px; font-weight:700; line-height:1.05;">${escapeHtml(word)}</div>
          <div style="font-size:53px; opacity:0.9; margin-top:21px;">${escapeHtml(furi)}</div>
          <div style="font-size:53px; margin-top:21px;">${escapeHtml(meaning)}</div>
          <div style="font-size:35px; opacity:0.8; margin-top:21px;">${escapeHtml(meta)}</div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
