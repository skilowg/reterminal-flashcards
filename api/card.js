export default async function handler(req, res) {
  const level = req.query.level ?? "2"; // default N2

  const api = new URL("https://jlpt-vocab-api.vercel.app/api/words/random");
  api.searchParams.set("level", level);

  const r = await fetch(api.toString(), { headers: { "cache-control": "no-store" } });
  if (!r.ok) return res.status(500).send(`API error: ${r.status}`);

  const j = await r.json();

  const word = j.word ?? "";
  const furi = j.furigana ? `(${j.furigana})` : "";
  const meaning = j.meaning ?? "";
  const meta = `N${level} · ${j.romaji ?? ""}`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  res.status(200).send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta http-equiv="refresh" content="3600"/>
  html, body {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  background: #000;
  color: #fff;
  font-family: system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif;

  display: flex;
  align-items: center;       /* vertical center */
  justify-content: center;   /* horizontal center */

  padding: 24px;
  box-sizing: border-box;
}

.wrap {
  display: flex;
  flex-direction: column;
  gap: 21px;
  text-align: center;
  max-width: 760px;          /* good for 800x480 */
}

.word { font-size: 64px; font-weight: 700; line-height: 1.05; }
.furigana { font-size: 28px; opacity: 0.9; }
.meaning { font-size: 26px; }
.meta { font-size: 18px; opacity: 0.8; }

body {
  background: #000;
  color: #fff;
  font-family: system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif;

  /* center the card */
  display: flex;
  align-items: center;     /* vertical */
  justify-content: center; /* horizontal */

  /* optional: safe padding so text doesn't touch edges on 800x480 */
  padding: 24px;
  box-sizing: border-box;
}

.wrap {
  display: flex;
  flex-direction: column;
  gap: 21px;               /* scale this as you like */
  text-align: center;      /* center lines */

  /* optional: keep it from spanning too wide */
  max-width: 760px;        /* 800 - padding */
}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="word">${escapeHtml(word)}</div>
    <div class="furigana">${escapeHtml(furi)}</div>
    <div class="meaning">${escapeHtml(meaning)}</div>
    <div class="meta">${escapeHtml(meta)}</div>
  </div>
</body>
</html>`);

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
}
