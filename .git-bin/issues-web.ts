#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Minimal static site generator for inline issues
 * - Reads: .git-bin/.issues and .git-bin/.bugs
 * - Writes: .git-bin/issues.html
 * - No dependencies; produces a single self-contained HTML file
 */

type Priority = "high" | "normal";

type Issue = {
  readonly ts: string; // timestamp for the line (or snapshot time if not present)
  readonly file: string;
  readonly line: number;
  readonly tag: string; // uppercased (TODO/BUG)
  readonly message: string;
  readonly priority: Priority;
  readonly owner?: string;
  readonly date?: string;
  readonly category?: string;
  readonly id?: string;
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
  return m && m[1] ? m[1] : null;
};

const parseLines = (text: string, source: string): Issue[] => {
  if (!text) return [];
  const snapshotTs = parseHeaderSnapshotTime(text) ??
    new Date().toISOString().slice(0, 19).replace("T", " ");
  const out: Issue[] = [];
  
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    
    const parts = line.split(/\s{2,}/).filter(Boolean);
    if (parts.length < 3) continue;

    // New format: timestamp path:line tag priority owner date category id message
    // Old format: timestamp path:line tag message
    // Legacy format: path:line tag message
    
    let ts: string;
    let pathLine: string;
    let tag: string;
    let priority: Priority = "normal";
    let owner: string | undefined;
    let date: string | undefined;
    let category: string | undefined;
    let id: string | undefined;
    let message: string;

    // Check if we have the new format with priority
    if (parts.length >= 9) {
      // New format with all metadata
      ts = parts[0]!;
      pathLine = parts[1]!;
      tag = parts[2]!;
      const pr = parts[3]!;
      priority = (pr === "high" ? "high" : "normal");
      owner = parts[4]!;
      date = parts[5]!;
      category = parts[6]!;
      id = parts[7]!;
      message = parts.slice(8).join("  ");
      if (owner === "-") owner = undefined;
      if (date === "-") date = undefined;
      if (category === "-") category = undefined;
      if (id === "-") id = undefined;
    } else if (parts.length >= 4 && /^\d{4}-\d{2}-\d{2}/.test(parts[0]!)) {
      // Old format with timestamp
      ts = parts[0]!;
      pathLine = parts[1]!;
      tag = parts[2]!;
      message = parts.slice(3).join("  ");
    } else {
      // Legacy format without timestamp
      ts = snapshotTs;
      pathLine = parts[0]!;
      tag = parts[1]!;
      message = parts.slice(2).join("  ");
    }

    const idx = pathLine.lastIndexOf(":");
    if (idx <= 0) continue;
    const file = pathLine.slice(0, idx);
    const lnStr = pathLine.slice(idx + 1);
    const ln = Number.parseInt(lnStr, 10);
    if (!Number.isFinite(ln)) continue;

    out.push({ 
      ts, 
      file, 
      line: ln, 
      tag: tag.toUpperCase(), 
      message,
      priority: priority as Priority,
      owner,
      date,
      category,
      id,
      source 
    });
  }
  return out;
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const buildHtml = (issues: Issue[]): string => {
  const generatedAt = new Date().toISOString();
  const dataJson = JSON.stringify(issues);

  const css =
    `:root{--bg:#0b1020;--bg-card:#121a33;--fg:#e7ecff;--muted:#aab3d1;--acc:#5b8cff;--warn:#ffb020;--bad:#ff5c77;--high:#ff9800;--normal:#4caf50}
  *{box-sizing:border-box}body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;background:var(--bg);color:var(--fg)}
  header{padding:16px 20px;border-bottom:1px solid #1c274d;background:linear-gradient(180deg,#0c1326,#0b1020)}
  header h1{margin:0;font-size:18px}
  header .sub{color:var(--muted);font-size:12px;margin-top:4px}
  main{padding:20px;max-width:1200px;margin:0 auto}
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px}
  .stat-card{background:var(--bg-card);border:1px solid #1c274d;border-radius:8px;padding:12px;text-align:center}
  .stat-value{font-size:24px;font-weight:bold;color:var(--acc)}
  .stat-label{font-size:12px;color:var(--muted);margin-top:4px}
  .panel{background:var(--bg-card);border:1px solid #1c274d;border-radius:12px;padding:12px}
  .controls{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:12px}
  .search-box{flex:1;min-width:200px;padding:6px 12px;background:#0e1630;border:1px solid #29407a;color:var(--fg);border-radius:8px}
  .badge{display:inline-flex;align-items:center;gap:6px;border:1px solid #29407a;border-radius:999px;padding:6px 10px;color:var(--fg);background:#0e1630;cursor:pointer}
  .badge input{accent-color:var(--acc)}
  .select{background:#0e1630;border:1px solid #29407a;color:var(--fg);padding:6px 10px;border-radius:8px}
  .group-header{background:#0e1630;padding:8px 12px;margin:8px 0;border-radius:6px;cursor:pointer;display:flex;justify-content:space-between;align-items:center}
  .group-header:hover{background:#1a2040}
  .group-content{margin-bottom:16px}
  .collapsed .group-content{display:none}
  table{width:100%;border-collapse:collapse}
  th,td{padding:8px;border-bottom:1px solid #1c274d;vertical-align:top}
  th{color:var(--muted);text-align:left;font-weight:600;font-size:12px;text-transform:uppercase}
  tr:hover td{background:#0f1833}
  .priority{width:8px;padding:0;background:var(--normal)}
  .priority[data-priority="high"]{background:var(--high)}
  .tag{font-weight:700;font-size:11px;padding:2px 6px;border-radius:3px;background:#1a2040}
  .tag[data-tag="BUG"]{color:var(--bad);background:#3a1020}
  .tag[data-tag="TODO"]{color:var(--warn);background:#3a2510}
  .file{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:#c7d2fe;font-size:12px}
  .line-num{color:var(--muted);font-size:11px}
  .msg{white-space:pre-wrap;font-size:13px}
  .metadata{display:flex;gap:8px;margin-top:4px;flex-wrap:wrap}
  .meta-item{font-size:11px;color:var(--muted);padding:2px 6px;background:#0e1630;border-radius:3px}
  .empty{color:var(--muted);padding:40px;text-align:center}
  .kbd{background:#1a2040;padding:2px 4px;border-radius:3px;font-size:11px;border:1px solid #29407a}
  @media(max-width:720px){
    .stats{grid-template-columns:repeat(2,1fr)}
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
    const priorityOrder = { high: 0, normal: 1 };

    // Stats
    function updateStats() {
      const byTag = {};
      const byPriority = { high: 0, normal: 0 };
      entries.forEach(e => {
        byTag[e.tag] = (byTag[e.tag] || 0) + 1;
        byPriority[e.priority] = (byPriority[e.priority] || 0) + 1;
      });
      $('#stat-total').textContent = entries.length;
      $('#stat-high').textContent = byPriority.high;
      $('#stat-todo').textContent = byTag.TODO || 0;
      $('#stat-bug').textContent = byTag.BUG || 0;
    }

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
    const searchBox = $('#search');
    const sortSel = $('#sort');
    const groupCheck = $('#group-by-dir');
    const tbody = $('#rows');
    const countEl = $('#count');

    function render(){
      const active = new Set(getActiveTags());
      const searchTerm = searchBox.value.toLowerCase();
      
      let filtered = entries.filter(e => {
        if (!active.has(e.tag)) return false;
        if (searchTerm && !e.message.toLowerCase().includes(searchTerm) && 
            !e.file.toLowerCase().includes(searchTerm)) return false;
        return true;
      });

      const mode = sortSel.value;
      filtered.sort((a,b) => {
        if (mode === 'priority') {
          const prioCmp = priorityOrder[a.priority] - priorityOrder[b.priority];
          if (prioCmp !== 0) return prioCmp;
          return a.file.localeCompare(b.file) || a.line - b.line;
        }
        if (mode === 'file') return a.file.localeCompare(b.file) || a.line - b.line;
        if (mode === 'line') return a.line - b.line || a.file.localeCompare(b.file);
        if (mode === 'tag') return a.tag.localeCompare(b.tag) || a.file.localeCompare(b.file) || a.line - b.line;
        if (mode === 'time') return a.ts.localeCompare(b.ts) || a.file.localeCompare(b.file) || a.line - b.line;
        return 0;
      });

      tbody.innerHTML = '';
      
      if (groupCheck.checked) {
        // Group by directory
        const groups = {};
        filtered.forEach(e => {
          const dir = e.file.includes('/') ? e.file.substring(0, e.file.lastIndexOf('/')) : '.';
          if (!groups[dir]) groups[dir] = [];
          groups[dir].push(e);
        });

        Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).forEach(([dir, items]) => {
          const groupDiv = document.createElement('div');
          groupDiv.className = 'group';
          
          const header = document.createElement('div');
          header.className = 'group-header';
          header.innerHTML = '<span>📁 ' + dir + '</span><span>(' + items.length + ')</span>';
          header.onclick = () => groupDiv.classList.toggle('collapsed');
          
          const content = document.createElement('div');
          content.className = 'group-content';
          
          const table = document.createElement('table');
          items.forEach(e => table.appendChild(createRow(e)));
          content.appendChild(table);
          
          groupDiv.appendChild(header);
          groupDiv.appendChild(content);
          tbody.appendChild(groupDiv);
        });
      } else {
        filtered.forEach(e => tbody.appendChild(createRow(e)));
      }
      
      countEl.textContent = String(filtered.length);
      document.getElementById('lastUpdated').textContent = new Date().toLocaleString();
    }

    function createRow(e) {
      const tr = document.createElement('tr');

      const tdPriority = document.createElement('td');
      tdPriority.className = 'priority';
      tdPriority.dataset.priority = e.priority;
      tdPriority.title = e.priority;

      const tdTag = document.createElement('td');
      tdTag.innerHTML = '<span class="tag" data-tag="' + e.tag + '">' + e.tag + '</span>';
      tdTag.setAttribute('data-col','Tag');

      const tdFile = document.createElement('td');
      tdFile.setAttribute('data-col','Location');
      tdFile.innerHTML = '<span class="file">' + e.file + '</span>:<span class="line-num">' + e.line + '</span>';

      const tdMsg = document.createElement('td');
      tdMsg.className = 'msg';
      tdMsg.setAttribute('data-col','Message');
      tdMsg.textContent = e.message;
      
      // Add metadata if present
      const meta = [];
      if (e.owner) meta.push('<span class="meta-item">@' + e.owner + '</span>');
      if (e.date) meta.push('<span class="meta-item">📅 ' + e.date + '</span>');
      if (e.category) meta.push('<span class="meta-item">[' + e.category + ']</span>');
      if (e.id) meta.push('<span class="meta-item">' + e.id + '</span>');
      if (meta.length > 0) {
        tdMsg.innerHTML = tdMsg.textContent + '<div class="metadata">' + meta.join('') + '</div>';
      }

      tr.append(tdPriority, tdTag, tdFile, tdMsg);
      return tr;
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.key === '/' && document.activeElement !== searchBox) {
        e.preventDefault();
        searchBox.focus();
      }
      if (e.key === 'Escape') {
        searchBox.blur();
      }
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey && document.activeElement !== searchBox) {
        e.preventDefault();
        groupCheck.checked = !groupCheck.checked;
        render();
      }
    });

    searchBox.addEventListener('input', render);
    filtersEl.addEventListener('change', render);
    sortSel.addEventListener('change', render);
    groupCheck.addEventListener('change', render);

    updateStats();
    render();
  })();`;

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
  <h1>📋 Inline Issues</h1>
  <div class="sub">Generated at ${
    escapeHtml(generatedAt)
  } · <span id="count">${issues.length}</span> filtered · <span>Last viewed: <span id="lastUpdated"></span></span></div>
</header>
<main>
  <div class="stats">
    <div class="stat-card">
      <div class="stat-value" id="stat-total">${issues.length}</div>
      <div class="stat-label">Total Issues</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="stat-high" style="color:var(--high)">0</div>
      <div class="stat-label">High Priority</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="stat-todo" style="color:var(--warn)">0</div>
      <div class="stat-label">TODOs</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="stat-bug" style="color:var(--bad)">0</div>
      <div class="stat-label">BUGs</div>
    </div>
  </div>
  
  <div class="panel">
    <div class="controls">
      <input type="text" id="search" class="search-box" placeholder="🔍 Search issues... (press / to focus)">
      <label class="badge">
        <input type="checkbox" id="group-by-dir">
        <span>Group by directory</span>
      </label>
    </div>
    <div class="controls">
      <strong>Tags:</strong>
      <span id="filters"></span>
      <span style="flex:1"></span>
      <label>Sort: <select id="sort" class="select">
        <option value="priority">Priority</option>
        <option value="file">File</option>
        <option value="line">Line</option>
        <option value="tag">Tag</option>
        <option value="time">Time</option>
      </select></label>
    </div>
    ${
    issues.length === 0
      ? `<div class="empty">
          <div style="font-size:48px;margin-bottom:16px">📭</div>
          <div>No issues found</div>
          <div style="margin-top:8px;font-size:12px">Run <code class="kbd">deno task issues:scan</code> to generate data</div>
        </div>`
      : `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr><th width="8"></th><th width="80">Tag</th><th>Location</th><th>Message</th></tr>
        </thead>
        <tbody id="rows"></tbody>
      </table>
    </div>`
  }
  </div>
  
  <div style="margin-top:20px;text-align:center;color:var(--muted);font-size:12px">
    Keyboard shortcuts: <span class="kbd">/</span> Search · <span class="kbd">g</span> Group by directory · <span class="kbd">Esc</span> Clear focus
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
