export default async function handler(req, res) {
  // Default to N2 if not provided
  const level = String(req.query.level ?? "2");

  try {
    // 1) Get a random JLPT vocab item
    const jlptApi = new URL("https://jlpt-vocab-api.vercel.app/api/words/random");
    jlptApi.searchParams.set("level", level);

    const vocabResp = await fetch(jlptApi.toString(), {
      headers: { "cache-control": "no-store" },
    });

    if (!vocabResp.ok) {
      return res.status(500).send(`JLPT API error: ${vocabResp.status}`);
    }

    const j = await vocabResp.json();

    const word = j.word ?? "";
    const furi = j.furigana ? `(${j.furigana})` : "";
    const meaning = j.meaning ?? "";
    const meta = `N${level} · ${j.romaji ?? ""}`.trim();

    // 2) Try to find an example sentence (JP) + translation (EN) via Tatoeba
    // Tatoeba API is public/read-only and supports returning translations with showtrans:*  [oai_citation:1‡api.tatoeba.org](https://api.tatoeba.org/openapi-unstable.json)
    let exJp = "";
    let exEn = "";

    if (word) {
      try {
        const tatoeba = new URL("https://api.tatoeba.org/unstable/sentences");
        tatoeba.searchParams.set("lang", "jpn"); // required  [oai_citation:2‡api.tatoeba.org](https://api.tatoeba.org/openapi-unstable.json)
        // Quote the word for a tighter match (ManticoreSearch query syntax per docs)  [oai_citation:3‡api.tatoeba.org](https://api.tatoeba.org/openapi-unstable.json)
        tatoeba.searchParams.set("q", `"${word}"`);
        tatoeba.searchParams.set("trans:lang", "eng");
        tatoeba.searchParams.set("trans:is_direct", "yes");
        tatoeba.searchParams.set("showtrans:lang", "eng");
        tatoeba.searchParams.set("showtrans:is_direct", "yes");
        tatoeba.searchParams.set("sort", "relevance");
        tatoeba.searchParams.set("limit", "1");

        const sResp = await fetch(tatoeba.toString(), {
          headers: { "cache-control": "no-store" },
        });

        if (sResp.ok) {
          const sJson = await sResp.json();
          const first = sJson?.data?.[0];

          exJp = first?.text ?? "";

          // translations[] contains Translation objects which include the sentence fields (like .text)
          // We requested showtrans:lang=eng, so grab the first English translation if present.  [oai_citation:4‡api.tatoeba.org](https://api.tatoeba.org/openapi-unstable.json)
          const translations = Array.isArray(first?.translations) ? first.translations : [];
          const eng = translations.find((t) => t?.lang === "eng" && typeof t?.text === "string");
          exEn = eng?.text ?? "";
        }
      } catch (_) {
        // If sentence fetch fails, just omit examples.
      }
    }

    // 3) Render HTML for your e-ink frame
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");

    res.status(200).send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta http-equiv="refresh" content="3600"/>
  <style>
    html, body { width:100%; height:100%; margin:0; }
    body {
      background:#000;
      color:#fff;
      font-family: system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;

      display:flex;
      align-items:center;     /* vertical */
      justify-content:center; /* horizontal */

      padding:24px;
      box-sizing:border-box;
    }
    .wrap {
      display:flex;
      flex-direction:column;
      gap:18px;
      text-align:center;
      max-width:760px; /* 800 - padding */
    }

    /* Main card typography */
    .word { font-size:100px; font-weight:700; line-height:1.05; }
    .furigana { font-size:44px; opacity:0.9; }
    .meaning { font-size:40px; }

    /* Example sentence area */
    .example {
      margin-top:6px;
      font-size:34px;
      line-height:1.25;
      opacity:0.95;
      word-break:break-word;
    }
    .example-en {
      font-size:26px;
      line-height:1.25;
      opacity:0.8;
      word-break:break-word;
    }

    .meta { font-size:22px; opacity:0.75; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="word">${escapeHtml(word)}</div>
    ${furi ? `<div class="furigana">${escapeHtml(furi)}</div>` : ``}
    ${meaning ? `<div class="meaning">${escapeHtml(meaning)}</div>` : ``}

    ${exJp ? `<div class="example">${escapeHtml(exJp)}</div>` : ``}
    ${exEn ? `<div class="example-en">${escapeHtml(exEn)}</div>` : ``}

    ${meta ? `<div class="meta">${escapeHtml(meta)}</div>` : ``}
  </div>
</body>
</html>`);

  } catch (e) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.status(500).send(`Server error: ${e?.message ?? String(e)}`);
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
}
