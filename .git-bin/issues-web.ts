#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Minimal static site generator for inline issues
 * - Reads: .git-bin/.issues and .git-bin/.bugs
 * - Writes: .git-bin/issues.html
 * - No dependencies; produces a single self-contained HTML file
 */

type Issue = {
  readonly ts: string; // timestamp for the line (or snapshot time if not present)
  readonly file: string;
  readonly line: number;
  readonly tag: string; // uppercased (TODO/BUG/FIXME/...)
  readonly message: string;
  readonly source: string; // ".issues" | ".bugs"
};

const ISSUES_PATH = ".git-bin/.issues";
const BUGS_PATH = ".git-bin/.bugs";
const OUT_HTML = ".git-bin/issues.html";

// Utilities
const exists = async (p: string) => {
  try {
    await Deno.stat(p);
    return true;
  } catch (_) {
    return false;
  }
};

const readMaybe = async (p: string): Promise<string | null> =>
  (await exists(p)) ? await Deno.readTextFile(p) : null;

const parseHeaderSnapshotTime = (text: string): string | null => {
  // Matches: "# Inline-issue snapshot 2025-09-08 18:56:41"
  const m = text.match(/#\s*Inline-issue\s+snapshot\s+([0-9\-]{10}\s+[0-9:]{8})/);
  return m ? m[1] : null;
};

const parseLines = (text: string, source: string): Issue[] => {
  if (!text) return [];
  const snapshotTs = parseHeaderSnapshotTime(text) ?? new Date().toISOString().slice(0, 19).replace("T", " ");
  const out: Issue[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    // Columns can be either:
    // 1) timestamp, path:line, tag, message (new format)
    // 2) path:line, tag, message (legacy format)
    const parts = line.split(/\s{2,}/).filter(Boolean);
    if (parts.length < 3) continue;

    let ts: string;
    let pathLine: string;
    let tag: string;
    let message: string;

    if (parts.length >= 4) {
      [ts, pathLine, tag, message] = [parts[0], parts[1], parts[2], parts.slice(3).join("  ")];
    } else {
      ts = snapshotTs;
      [pathLine, tag, message] = [parts[0], parts[1], parts.slice(2).join("  ")];
    }

    const idx = pathLine.lastIndexOf(":");
    if (idx <= 0) continue;
    const file = pathLine.slice(0, idx);
    const lnStr = pathLine.slice(idx + 1);
    const ln = Number.parseInt(lnStr, 10);
    if (!Number.isFinite(ln)) continue;

    out.push({ ts, file, line: ln, tag: tag.toUpperCase(), message, source });
  }
  return out;
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const buildHtml = (issues: Issue[]): string => {
  const generatedAt = new Date().toISOString();
  const tags = Array.from(new Set(issues.map((i) => i.tag))).sort();
  const dataJson = JSON.stringify(issues);

  const css = `:root{--bg:#0b1020;--bg-card:#121a33;--fg:#e7ecff;--muted:#aab3d1;--acc:#5b8cff;--ok:#28c386;--warn:#ffb020;--bad:#ff5c77}
  *{box-sizing:border-box}body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;background:var(--bg);color:var(--fg)}
  header{padding:16px 20px;border-bottom:1px solid #1c274d;background:linear-gradient(180deg,#0c1326,#0b1020)}
  header h1{margin:0;font-size:18px}
  header .sub{color:var(--muted);font-size:12px;margin-top:4px}
  main{padding:20px;max-width:1100px;margin:0 auto}
  .panel{background:var(--bg-card);border:1px solid #1c274d;border-radius:12px;padding:12px}
  .controls{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:12px}
  .badge{display:inline-flex;align-items:center;gap:6px;border:1px solid #29407a;border-radius:999px;padding:6px 10px;color:var(--fg);background:#0e1630}
  .badge input{accent-color:var(--acc)}
  .select{background:#0e1630;border:1px solid #29407a;color:var(--fg);padding:6px 10px;border-radius:8px}
  table{width:100%;border-collapse:collapse}
  th,td{padding:10px;border-bottom:1px solid #1c274d;vertical-align:top}
  th{color:var(--muted);text-align:left;font-weight:600}
  tr:hover td{background:#0f1833}
  .tag{font-weight:700}
  .tag[data-tag="BUG"], .tag[data-tag="FIXME"], .tag[data-tag="HACK"]{color:var(--bad)}
  .tag[data-tag="TODO"]{color:var(--warn)}
  .file{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:#c7d2fe}
  .msg{white-space:pre-wrap}
  .empty{color:var(--muted);padding:20px;text-align:center}
  @media(max-width:720px){
    table, thead, tbody, th, td, tr{display:block}
    thead{display:none}
    td{border-bottom:1px solid #1c274d}
    td[data-col]:before{content:attr(data-col)": ";display:block;color:var(--muted);font-size:12px;margin-bottom:4px}
  }`;

  const js = `(() => {
    const entries = ${dataJson};
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => Array.from(document.querySelectorAll(sel));

    const tags = Array.from(new Set(entries.map(e => e.tag))).sort();

    // Build tag filters
    const filtersEl = $('#filters');
    for (const t of tags) {
      const id = 'tag-' + t;
      const wrap = document.createElement('label');
      wrap.className = 'badge';
      wrap.innerHTML = '<input type="checkbox" id="'+id+'" checked> <span>'+t+'</span>';
      filtersEl.appendChild(wrap);
    }

    const getActiveTags = () => tags.filter(t => $('#tag-'+t)?.checked);

    const sortSel = $('#sort');
    const tbody = $('#rows');
    const countEl = $('#count');

    function render(){
      const active = new Set(getActiveTags());
      const sorted = entries.slice().filter(e => active.has(e.tag));
      const mode = sortSel.value;
      sorted.sort((a,b) => {
        if (mode === 'file') return a.file.localeCompare(b.file) || a.line - b.line;
        if (mode === 'line') return a.line - b.line || a.file.localeCompare(b.file);
        if (mode === 'tag') return a.tag.localeCompare(b.tag) || a.file.localeCompare(b.file) || a.line - b.line;
        if (mode === 'time') return a.ts.localeCompare(b.ts) || a.file.localeCompare(b.file) || a.line - b.line;
        return 0;
      });
      tbody.innerHTML = '';
      for (const e of sorted){
        const tr = document.createElement('tr');
        tr.innerHTML = ` +
      "`<td class=\"tag\" data-col=\"Tag\" data-tag=\"${'${e.tag}'}\">${'${e.tag}'}</td>" +
      "<td class=\"file\" data-col=\"File:Line\">${'${e.file}'}:${'${e.line}'}</td>" +
      "<td class=\"msg\" data-col=\"Message\">${'${e.message.replace(/&/g,'&amp;').replace(/</g,'&lt;')}'}</td>" +
      "<td class=\"ts\" data-col=\"Timestamp\">${'${e.ts}'}</td>`" +
      `;
        tbody.appendChild(tr);
      }
      countEl.textContent = String(sorted.length);
      document.getElementById('lastUpdated').textContent = new Date().toLocaleString();
    }

    filtersEl.addEventListener('change', render);
    sortSel.addEventListener('change', render);

    render();
  })();`;

  const summary = `${issues.length} item${issues.length === 1 ? "" : "s"}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Inline Issues</title>
<style>${css}</style>
</head>
<body>
<header>
  <h1>Inline Issues</h1>
  <div class="sub">Generated at ${escapeHtml(generatedAt)} · <span id="count">${issues.length}</span> total · <span>Last viewed: <span id="lastUpdated"></span></span></div>
</header>
<main>
  <div class="panel">
    <div class="controls">
      <strong>Filter tags:</strong>
      <span id="filters"></span>
      <span style="flex:1"></span>
      <label>Sort by: <select id="sort" class="select">
        <option value="file">File</option>
        <option value="line">Line</option>
        <option value="tag">Tag</option>
        <option value="time">Timestamp</option>
      </select></label>
    </div>
    ${issues.length === 0 ? `<div class="empty">No issues found. Run the scanner tasks to generate data.</div>` : `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr><th>Tag</th><th>File:Line</th><th>Message</th><th>Timestamp</th></tr>
        </thead>
        <tbody id="rows"></tbody>
      </table>
    </div>`}
  </div>
</main>
<script>${js}</script>
</body>
</html>`;
};

const main = async () => {
  const [issuesText, bugsText] = await Promise.all([
    readMaybe(ISSUES_PATH),
    readMaybe(BUGS_PATH),
  ]);

  const items: Issue[] = [];
  if (issuesText) items.push(...parseLines(issuesText, ".issues"));
  if (bugsText) items.push(...parseLines(bugsText, ".bugs"));

  // Deduplicate by file|line|tag|message
  const seen = new Set<string>();
  const deduped: Issue[] = [];
  for (const it of items) {
    const key = `${it.file}|${it.line}|${it.tag}|${it.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(it);
    }
  }

  const html = buildHtml(deduped);
  await Deno.writeTextFile(OUT_HTML, html);
  console.error(`Wrote ${OUT_HTML} with ${deduped.length} item(s).`);
};

if (import.meta.main) {
  await main();
}

