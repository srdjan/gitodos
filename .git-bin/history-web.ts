#!/usr/bin/env -S deno run -A

// Generate a dynamic history HTML page from todos.db (with search + filters)

import { TodoDB } from "./todo-db.ts";

const OUT = ".git-bin/history.html";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function render(db: TodoDB): string {
  const all = db.getAll(2000, 0);
  const stats = db.getStats();
  const dataJson = JSON.stringify(all);

  const css = `
    :root{--bg:#0b1020;--bg-card:#121a33;--fg:#e7ecff;--muted:#aab3d1;--acc:#5b8cff;--warn:#ffb020;--bad:#ff5c77}
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
    .search-box{flex:1;min-width:220px;padding:6px 12px;background:#0e1630;border:1px solid #29407a;color:var(--fg);border-radius:8px}
    .badge{display:inline-flex;align-items:center;gap:6px;border:1px solid #29407a;border-radius:999px;padding:6px 10px;color:var(--fg);background:#0e1630}
    .badge input{accent-color:var(--acc)}
    .select{background:#0e1630;border:1px solid #29407a;color:var(--fg);padding:6px 10px;border-radius:8px}
    .list{display:block}
    .list .row{display:grid;grid-template-columns:16px 1fr;gap:10px;padding:10px 6px;border-bottom:1px solid #1c274d}
    .bullet{color:var(--muted);}
    .item{display:block}
    .head{display:flex;gap:8px;align-items:center}
    .badge-type{font-weight:700;font-size:11px;padding:2px 6px;border-radius:3px;background:#1a2040;flex:0 0 auto}
    .badge-type.todo{color:var(--warn);background:#3a2510}
    .badge-type.bug{color:var(--bad);background:#3a1020}
    .title{font-weight:600;line-height:1.35;overflow-wrap:anywhere}
    .sub{margin-top:6px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    .meta{color:var(--muted);font-size:12px}
    .path{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;background:#0e1630;border:1px solid #29407a;border-radius:6px;padding:2px 6px;color:#c7d2fe}
    .pill{display:inline-block;background:#0e1630;border:1px solid #29407a;border-radius:999px;padding:2px 8px;font-size:11px}
    @media(max-width:720px){.controls{gap:8px}.stats{grid-template-columns:repeat(2,1fr)}}
  `;

  const js = `(() => {
    const entries = ${dataJson};
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => Array.from(document.querySelectorAll(s));

    const state = {
      search: '',
      types: new Set(['TODO','BUG']),
      statuses: new Set(['active']),
      highOnly: false,
      sort: 'created', // created|completed|priority|type
    };

    const searchBox = $('#search');
    const highOnly = $('#high-only');
    const sortSel = $('#sort');
    const listEl = $('#rows');

    function updateStats(items){
      const a = items.filter(e => e.status === 'active').length;
      const c = items.filter(e => e.status === 'completed').length;
      $('#stat-total').textContent = items.length;
      $('#stat-active').textContent = a;
      $('#stat-completed').textContent = c;
      $('#stat-todo').textContent = items.filter(e => e.type==='TODO').length;
      $('#stat-bug').textContent = items.filter(e => e.type==='BUG').length;
    }

    function applyFilters(){
      const q = state.search.toLowerCase();
      let out = entries.filter(e => state.types.has(e.type) && state.statuses.has(e.status));
      if (state.highOnly) out = out.filter(e => (e.priority ?? 3) >= 4);
      if (q) out = out.filter(e => (e.title+ ' ' + (e.description||'')).toLowerCase().includes(q));

      // sort
      out.sort((a,b) => {
        if (state.sort === 'priority') return (b.priority??0)-(a.priority??0) || b.created_at.localeCompare(a.created_at);
        if (state.sort === 'completed') return (b.completed_at||'').localeCompare(a.completed_at||'') || b.created_at.localeCompare(a.created_at);
        if (state.sort === 'type') return a.type.localeCompare(b.type) || b.created_at.localeCompare(a.created_at);
        return b.created_at.localeCompare(a.created_at);
      });
      return out;
    }

    function render(){
      const items = applyFilters();
      listEl.innerHTML = '';
      for (const e of items) listEl.appendChild(row(e));
      updateStats(items);
      $('#count').textContent = String(items.length);
      $('#lastUpdated').textContent = new Date().toLocaleString();
    }

    function row(e){
      const row = document.createElement('div');
      row.className = 'row';

      const bullet = document.createElement('div');
      bullet.className = 'bullet';
      bullet.textContent = '•';

      const item = document.createElement('div');
      item.className = 'item';

      const head = document.createElement('div');
      head.className = 'head';
      head.innerHTML = '<span class="badge-type '+e.type.toLowerCase()+'">'+e.type+'</span>'+
                       '<div class="title">'+escapeHtml(e.title)+'</div>';

      const sub = document.createElement('div');
      sub.className = 'sub';
      if (e.description) sub.innerHTML += '<span class="path">'+escapeHtml(e.description)+'</span>';
      sub.innerHTML += '<span class="pill">'+e.status+'</span>'+
                       '<span class="meta">p'+(e.priority??3)+'</span>'+
                       '<span class="meta">'+e.created_at+(e.completed_at? ' → '+e.completed_at : '')+'</span>';

      item.appendChild(head);
      item.appendChild(sub);
      row.appendChild(bullet);
      row.appendChild(item);
      return row;
    }

    // Build filters
    for (const id of ['type-TODO','type-BUG']) {
      $('#'+id).addEventListener('change', () => {
        const type = id.split('-')[1];
        const el = $('#'+id);
        if (el.checked) state.types.add(type); else state.types.delete(type);
        render();
      });
    }
    for (const id of ['status-active','status-completed','status-cancelled']) {
      $('#'+id).addEventListener('change', () => {
        const st = id.split('-')[1];
        const el = $('#'+id);
        if (el.checked) state.statuses.add(st); else state.statuses.delete(st);
        render();
      });
    }
    highOnly.addEventListener('change', () => { state.highOnly = highOnly.checked; render(); });
    sortSel.addEventListener('change', () => { state.sort = sortSel.value; render(); });
    searchBox.addEventListener('input', () => { state.search = searchBox.value; render(); });

    // Keyboard: / to focus search, Esc to blur
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== searchBox) { e.preventDefault(); searchBox.focus(); }
      if (e.key === 'Escape') searchBox.blur();
    });

    // Escape helper in JS context
    function escapeHtml(s){ return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'); }

    updateStats(entries);
    render();
  })();`;

  return `<!doctype html>
  <html><head><meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Issue History</title>
  <style>${css}</style>
  </head>
  <body>
    <header>
      <h1>📚 Issue History</h1>
      <div class="sub">Durable journal from todos.db · <span id="count">${all.length}</span> items · <span id="lastUpdated"></span></div>
    </header>
    <main>
      <div class="stats">
        <div class="stat-card"><div class="stat-value" id="stat-total">${all.length}</div><div class="stat-label">Total</div></div>
        <div class="stat-card"><div class="stat-value" id="stat-active">${stats.totalActive}</div><div class="stat-label">Active</div></div>
        <div class="stat-card"><div class="stat-value" id="stat-completed">${stats.totalCompleted}</div><div class="stat-label">Completed</div></div>
        <div class="stat-card"><div class="stat-value" id="stat-todo">0</div><div class="stat-label">TODO</div></div>
        <div class="stat-card"><div class="stat-value" id="stat-bug">0</div><div class="stat-label">BUG</div></div>
      </div>

      <div class="panel">
        <div class="controls">
          <input type="text" id="search" class="search-box" placeholder="🔍 Search title/description (press / to focus)">
          <label class="badge"><input type="checkbox" id="type-TODO" checked> <span>TODO</span></label>
          <label class="badge"><input type="checkbox" id="type-BUG" checked> <span>BUG</span></label>
          <span style="width:12px"></span>
          <label class="badge"><input type="checkbox" id="status-active" checked> <span>Active</span></label>
          <label class="badge"><input type="checkbox" id="status-completed"> <span>Completed</span></label>
          <label class="badge"><input type="checkbox" id="status-cancelled"> <span>Cancelled</span></label>
          <span style="flex:1"></span>
          <label class="badge"><input type="checkbox" id="high-only"> <span>High only</span></label>
          <label>Sort: <select id="sort" class="select">
            <option value="created" selected>Created (newest)</option>
            <option value="completed">Completed (newest)</option>
            <option value="priority">Priority</option>
            <option value="type">Type</option>
          </select></label>
        </div>
        <div id="rows" class="list"></div>
      </div>
    </main>
    <script>${js}</script>
  </body></html>`;
}

const main = async () => {
  const db = new TodoDB();
  try {
    const html = render(db);
    await Deno.writeTextFile(OUT, html);
    console.error(`Wrote ${OUT}`);
  } finally {
    db.close();
  }
};

if (import.meta.main) {
  await main();
}
