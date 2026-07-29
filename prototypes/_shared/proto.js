/*
 * Prototype runtime — disposable.
 *
 * Two jobs only:
 *   1. the black bar at the top, which switches the colour / type / motion concepts under review
 *      and persists the choice across pages, so the whole set can be judged as one system;
 *   2. the application shell (sidebar + topbar), rendered from one list instead of being pasted
 *      into fourteen files.
 *
 * No framework, no build step. This code is thrown away when a screen is approved.
 */

const ICONS = {
  calendar:
    '<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>',
  chart: '<path d="M3 3v18h18M7 15l4-5 3 3 5-7"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z M16 12h3"/>',
  tags: '<path d="M3 6a3 3 0 0 1 3-3h5l8 8-8 8-8-8V6z M7.5 7.5h.01"/>',
  piggy:
    '<path d="M4 12a7 7 0 0 1 7-7h3a7 7 0 0 1 7 7v3a2 2 0 0 1-2 2h-1v2h-3v-2H10v2H7v-2.4A7 7 0 0 1 4 15v-3z M16 10h.01M4 11H2"/>',
  repeat: '<path d="M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/>',
  mic: '<path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z M19 10v1a7 7 0 0 1-14 0v-1M12 18v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>',
  pencil: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  chevronLeft: '<path d="M15 18l-6-6 6-6"/>',
  chevronRight: '<path d="M9 18l6-6-6-6"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  card: '<path d="M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7z M2 10h20"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  download: '<path d="M12 3v12M7 11l5 5 5-5M4 21h16"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5z"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  alert: '<path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  inbox: '<path d="M3 12h5l2 3h4l2-3h5M5 5h14l2 7v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7l2-7z"/>',
};

function icon(name, size) {
  return (
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ` +
    `stroke-linecap="round" stroke-linejoin="round"${size ? ` width="${size}" height="${size}"` : ''}>` +
    (ICONS[name] || '') +
    '</svg>'
  );
}

/* Navigation as it is specified in M3-T06, plus the two screens added by M7 and M8. */
const NAV = [
  { key: 'month', label: 'Mês', href: '06-month.html', icon: 'calendar' },
  { key: 'reports', label: 'Relatórios', href: '09-reports-monthly.html', icon: 'chart' },
  { key: 'voice', label: 'Lançar por voz', href: '13-voice.html', icon: 'mic' },
];

const NAV_SETUP = [
  { key: 'accounts', label: 'Contas', href: '03-accounts.html', icon: 'wallet' },
  { key: 'categories', label: 'Categorias', href: '04-categories.html', icon: 'tags' },
  { key: 'cashboxes', label: 'Caixinhas', href: '05-cashboxes.html', icon: 'piggy' },
  { key: 'recurrences', label: 'Recorrências', href: '12-recurrences.html', icon: 'repeat' },
];

/* --------------------------------------------------------------- concepts */

const AXES = [
  { attr: 'data-theme', key: 'proto.theme', fallback: 'sage', options: ['sage', 'indigo', 'slate'] },
  { attr: 'data-appearance', key: 'proto.appearance', fallback: 'light', options: ['light', 'dark'] },
  { attr: 'data-font', key: 'proto.font', fallback: 'grotesk', options: ['grotesk', 'humanist', 'mixed'] },
  { attr: 'data-motion', key: 'proto.motion', fallback: 'full', options: ['full', 'reduced'] },
];

function applyStoredAxes() {
  for (const axis of AXES) {
    const value = localStorage.getItem(axis.key) || axis.fallback;
    document.documentElement.setAttribute(axis.attr, value);
  }
}

function setAxis(attr, value) {
  const axis = AXES.find((a) => a.attr === attr);
  localStorage.setItem(axis.key, value);
  document.documentElement.setAttribute(attr, value);
}

applyStoredAxes();

function axisSelect(attr, label) {
  const axis = AXES.find((a) => a.attr === attr);
  const current = document.documentElement.getAttribute(attr);
  const options = axis.options.map((o) => `<option value="${o}"${o === current ? ' selected' : ''}>${o}</option>`);
  return `<label>${label} <select data-axis="${attr}">${options.join('')}</select></label>`;
}

/* The index lives at the repository root so GitHub Pages serves it as the site's home page,
   while every screen stays under prototypes/. So the way back up depends on where we are — and
   on the index itself there is nowhere to go back to. */
function isScreen() {
  return /\/prototypes\/[^/]*$/.test(location.pathname);
}

function backLink() {
  return isScreen() ? '<a href="../index.html">← Índice</a><span class="sep"></span>' : '';
}

function renderProtoBar() {
  const host = document.querySelector('[data-proto-bar]');
  if (!host) return;
  const title = host.getAttribute('data-proto-bar') || document.title;
  host.className = 'proto-bar';
  host.innerHTML = `
    ${backLink()}
    <strong>${title}</strong>
    <span style="flex:1"></span>
    ${axisSelect('data-theme', 'cor')}
    ${axisSelect('data-appearance', 'modo')}
    ${axisSelect('data-font', 'fonte')}
    ${axisSelect('data-motion', 'motion')}
  `;
  host.querySelectorAll('select[data-axis]').forEach((sel) => {
    sel.addEventListener('change', () => setAxis(sel.getAttribute('data-axis'), sel.value));
  });
}

/* ------------------------------------------------------------------ shell */

function navGroup(items, active) {
  return items
    .map(
      (i) =>
        `<a href="${i.href}" class="${i.key === active ? 'active' : ''}">${icon(i.icon)}<span>${i.label}</span></a>`,
    )
    .join('');
}

function renderShell() {
  const host = document.querySelector('[data-shell]');
  if (!host) return;
  const active = host.getAttribute('data-shell');
  const sidebar = `
    <aside class="sidebar">
      <div class="brand"><span class="brand-mark">O</span> Orçamento</div>
      <nav class="nav">
        ${navGroup(NAV, active)}
        <div class="nav-label">Cadastros</div>
        ${navGroup(NAV_SETUP, active)}
      </nav>
      <div class="sidebar-footer">
        <div class="user-chip">
          <span class="avatar">LC</span>
          <span class="grow small strong">Lucas</span>
          <button class="btn icon ghost" title="Sair">${icon('logout')}</button>
        </div>
      </div>
    </aside>`;
  host.classList.add('shell');
  host.insertAdjacentHTML('afterbegin', sidebar);
}

/* --------------------------------------------------------- tiny behaviour */

/* data-open="<id>" shows the element with that id; data-close closes its dialog. Enough to
   demonstrate a dialog opening without pulling in a framework. */
function wireOverlays() {
  document.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-open]');
    if (opener) {
      const target = document.getElementById(opener.getAttribute('data-open'));
      if (target) target.style.display = 'grid';
      return;
    }
    const closer = event.target.closest('[data-close]');
    if (closer) {
      const scrim = closer.closest('.scrim');
      if (scrim) scrim.style.display = 'none';
      return;
    }
    if (event.target.classList.contains('scrim')) event.target.style.display = 'none';
  });
}

/* data-tabs container + [data-tab] buttons + [data-panel] panels */
function wireTabs() {
  document.querySelectorAll('[data-tabs]').forEach((group) => {
    group.querySelectorAll('[data-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        const name = button.getAttribute('data-tab');
        group.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b === button)));
        const scope = group.getAttribute('data-tabs');
        document
          .querySelectorAll(`[data-panel][data-scope="${scope}"]`)
          .forEach((p) => (p.hidden = p.getAttribute('data-panel') !== name));
      });
    });
  });
}

function wireSwitches() {
  document.querySelectorAll('.switch').forEach((s) => {
    s.addEventListener('click', () => s.setAttribute('aria-checked', s.getAttribute('aria-checked') !== 'true'));
  });
}

function wireExpanders() {
  document.querySelectorAll('[data-expand]').forEach((button) => {
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!open));
      document
        .querySelectorAll(`[data-expandable="${button.getAttribute('data-expand')}"]`)
        .forEach((row) => (row.hidden = open));
      const chevron = button.querySelector('svg');
      if (chevron) chevron.style.transform = open ? '' : 'rotate(90deg)';
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderProtoBar();
  renderShell();
  wireOverlays();
  wireTabs();
  wireSwitches();
  wireExpanders();
  document.querySelectorAll('[data-icon]').forEach((el) => {
    el.innerHTML = icon(el.getAttribute('data-icon'));
  });
});
