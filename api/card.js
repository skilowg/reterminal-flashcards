export default async function handler(req, res) {
  const level = String(req.query.level ?? "2"); // default N2

  // JLPT random word API
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

  // ---- Example sentence (Tatoeba) ----
  let exJp = "";
  let exEn = "";

  if (word) {
    try {
      const tatoeba = new URL("https://api.tatoeba.org/unstable/sentences");
      tatoeba.searchParams.set("lang", "jpn");
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

        const translations = Array.isArray(first?.translations) ? first.translations : [];
        const eng = translations.find((t) => t?.lang === "eng" && typeof t?.text === "string");
        exEn = eng?.text ?? "";
      }
    } catch (_) {
      // If example lookup fails, we still render the card without examples.
    }
  }

  // Emphasis that should render on limited e-ink browsers: bold + italic + underline
  const EMPH_STYLE = "font-weight:800;font-style:italic;text-decoration:underline;";

  // JP: emphasize the exact target word if it appears
  const exJpEmph = emphasizeInSentence(exJp, word, EMPH_STYLE);

  // EN: try emphasize the meaning; if not found, try first token of meaning
  const meaningToken = String(meaning).trim().split(/\s+/)[0] || "";
  const exEnEmph =
    emphasizeInSentence(exEn, meaning, EMPH_STYLE, { caseInsensitive: true }) ||
    emphasizeInSentence(exEn, meaningToken, EMPH_STYLE, { caseInsensitive: true }) ||
    escapeHtml(exEn);

  // Optional server-side truncation fallback (in case ellipsis isn't supported by renderer)
  // Tune these if you want more/less visible text.
  const exJpSafe = ellipsizeHtmlSafely(exJpEmph, 44);
  const exEnSafe = ellipsizeHtmlSafely(exEnEmph, 85);

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  // Inline styles only
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

          <div style="font-size:100px; font-weight:700; line-height:1.05;">
            ${escapeHtml(word)}
          </div>

          ${furi ? `<div style="font-size:44px; opacity:0.9; margin-top:16px;">${escapeHtml(furi)}</div>` : ``}

          ${meaning ? `<div style="font-size:41px; margin-top:16px;">${escapeHtml(meaning)}</div>` : ``}

          ${
            exJp
              ? `<div style="font-size:26px; line-height:1.2; opacity:0.95; margin-top:18px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                   ${exJpSafe}
                 </div>`
              : ``
          }

          ${
            exEn
              ? `<div style="font-size:20px; line-height:1.2; opacity:0.80; margin-top:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                   ${exEnSafe}
                 </div>`
              : ``
          }

          ${meta ? `<div style="font-size:28px; opacity:0.8; margin-top:18px;">${escapeHtml(meta)}</div>` : ``}

        </div>
      </td>
    </tr>
  </table>
</body>
</html>`);
}

/**
 * Emphasize the first occurrence of `target` within `sentence` by wrapping it in a <span style="...">.
 * Returns an escaped HTML string (safe to inject) or "" if no target found (when opts.requireMatch = true).
 */
function emphasizeInSentence(sentence, target, style, opts = {}) {
  const { caseInsensitive = false, requireMatch = false } = opts;

  if (!sentence) return "";
  const sentEsc = escapeHtml(sentence);
  const targRaw = String(target ?? "").trim();
  if (!targRaw) return requireMatch ? "" : sentEsc;

  // We do matching on the UNESCAPED original, but we inject on escaped text.
  // To keep it simple and robust, match on escaped as well.
  const targEsc = escapeHtml(targRaw);

  if (!caseInsensitive) {
    const idx = sentEsc.indexOf(targEsc);
    if (idx === -1) return requireMatch ? "" : sentEsc;
    return (
      sentEsc.slice(0, idx) +
      `<span style="${style}">` +
      targEsc +
      `</span>` +
      sentEsc.slice(idx + targEsc.length)
    );
  }

  // Case-insensitive match for English
  const lowerSent = sentEsc.toLowerCase();
  const lowerTarg = targEsc.toLowerCase();
  const idx = lowerSent.indexOf(lowerTarg);
  if (idx === -1) return requireMatch ? "" : sentEsc;

  return (
    sentEsc.slice(0, idx) +
    `<span style="${style}">` +
    sentEsc.slice(idx, idx + targEsc.length) +
    `</span>` +
    sentEsc.slice(idx + targEsc.length)
  );
}

/**
 * Truncate already-escaped HTML (may include our injected <span>) to a max character count,
 * without breaking HTML. If too long, degrade gracefully by stripping tags and adding ellipsis.
 */
function ellipsizeHtmlSafely(html, maxChars) {
  const raw = String(html ?? "");
  const plain = raw.replace(/<[^>]*>/g, "");
  if (plain.length <= maxChars) return raw;

  // Safe fallback: strip tags and ellipsize as plain text (prevents broken markup)
  return escapeHtml(ellipsizePlain(plain, maxChars));
}

function ellipsizePlain(text, maxChars) {
  const s = String(text ?? "");
  if (s.length <= maxChars) return s;
  return s.slice(0, Math.max(0, maxChars - 1)) + "…";
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
