/* ============================================================================
   v2 — shared prototype behaviour
   ----------------------------------------------------------------------------
   Only what every screen needs: the icon set, the app shell, dialogs, row
   expansion and the money formatter. Anything specific to one screen — the
   month strip, the composition band — lives inline in that screen's file, so
   it can be read without hopping between two files.
   ========================================================================= */

const ICONS = {
  calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  mic: '<rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5"/>',
  /* Recorrência: duas setas girando, uma atrás da outra — o ciclo, não a
     troca. O par de setas retas anterior lia-se como "transferência". */
  repeat: '<path d="M20.5 12a8.5 8.5 0 0 0-14.6-5.9L3 9"/><path d="M3 3.5V9h5.5"/><path d="M3.5 12a8.5 8.5 0 0 0 14.6 5.9L21 15"/><path d="M21 20.5V15h-5.5"/>',
  /* Engrenagem, o padrão para configurações — o círculo com raios lia-se
     como um sol. */
  settings:
    '<circle cx="12" cy="12" r="3.1"/><path d="M19.1 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a1.9 1.9 0 1 1-3.8 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1h-.2a1.9 1.9 0 1 1 0-3.8h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5v-.2a1.9 1.9 0 1 1 3.8 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a1.9 1.9 0 1 1 0 3.8h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  wallet: '<rect x="2.5" y="5.5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M17 14.5h1.5"/>',
  tags: '<path d="M3 3h7.2L21 13.8 13.8 21 3 10.2z"/><circle cx="7.5" cy="7.5" r="1.4"/>',
  piggy: '<path d="M3 12.5a6.5 6.5 0 0 1 6.5-6.5h3A6.5 6.5 0 0 1 19 12.5V18h-3.5v-2h-5v2H7v-3a6.4 6.4 0 0 1-4-2.5z"/><path d="M20 11h1.5M13 6V3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pencil: '<path d="M4 20h4L20 8l-4-4L4 16z"/>',
  trash: '<path d="M4 6.5h16M9 6.5V4h6v2.5M6.5 6.5l1 14h9l1-14"/>',
  chevronLeft: '<path d="M15 5l-7 7 7 7"/>',
  chevronRight: '<path d="M9 5l7 7-7 7"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/>',
  download: '<path d="M12 3v12M7.5 10.5L12 15l4.5-4.5M4 20h16"/>',
  check: '<path d="M4 12.5l5.5 5.5L20 6.5"/>',
  alert: '<circle cx="12" cy="12" r="9.2"/><path d="M12 7.5v5.5M12 16.3v.2"/>',
  info: '<circle cx="12" cy="12" r="9.2"/><path d="M12 11v5.5M12 7.7v.2"/>',
  menu: '<path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  logout: '<path d="M15 4.5h4.5v15H15M11 12h9M14.5 8.5L11 12l3.5 3.5M9 4.5H4.5v15H9"/>',
  /* Idioma: o globo, não a bandeira — uma bandeira escolhe um país, e o
     seletor escolhe um idioma que nenhum país sozinho é dono. */
  globe: '<circle cx="12" cy="12" r="9.2"/><path d="M2.8 12h18.4M12 2.8a14 14 0 0 1 0 18.4M12 2.8a14 14 0 0 0 0 18.4"/>',
};

function icon(name, cls) {
  return (
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ` +
    `stroke-linecap="round" stroke-linejoin="round"${cls ? ` class="${cls}"` : ''} aria-hidden="true">` +
    (ICONS[name] || '') +
    '</svg>'
  );
}

/* pt-BR, euro, always two decimals. The React app formats in lib/money.ts and
   only ever from integer cents — this is the display half of that rule. */
function eur(n, { sign = true } = {}) {
  const s = Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (!sign) return `${s} €`;
  return `${n < 0 ? '−' : '+'} ${s} €`;
}

/* --- navigation -----------------------------------------------------------
   Settled on screen 02: everyday work stays at the top level and the two
   registries live under Configurações. Caixinhas sits right below Mês — it is
   visited constantly while running the month, so it is not a registry either.
   Recorrências, same reason, also stays out of that menu.
   Items with href:null have no prototype yet; they come with the remaining
   screens and say so rather than pretending to be links. */
const NAV = [
  { id: 'month', label: 'Mês', icon: 'calendar', href: '06-month.html' },
  { id: 'cashboxes', label: 'Caixinhas', icon: 'piggy', href: '05-cashboxes.html' },
  { id: 'reports', label: 'Relatórios', icon: 'chart', href: '09-reports-monthly.html' },
  { id: 'voice', label: 'Lançar por voz', icon: 'mic', href: null },
  { id: 'recurrences', label: 'Recorrências', icon: 'repeat', href: '12-recurrences.html' },
];

const NAV_SETTINGS = [
  { id: 'general', label: 'Geral', icon: 'globe', href: '14-settings-general.html' },
  { id: 'accounts', label: 'Contas', icon: 'wallet', href: '03-accounts.html' },
  { id: 'categories', label: 'Categorias', icon: 'tags', href: '04-categories.html' },
];

const SOON = 'Sem protótipo ainda — chega com as telas restantes';

/* An approved screen lives one folder down, so a link between two screens has
   to know which side of that boundary each end is on. Keeping the list here
   means a file that gets approved is a one-line change, not a sweep through
   every page's navigation. */
const APPROVED = new Set([
  '00-design-system.html',
  '01-login.html',
  '02-app-shell.html',
  '03-accounts.html',
  '04-categories.html',
  '05-cashboxes.html',
  '06-month.html',
  '07-entry-form.html',
  '08-cashbox-operations.html',
  '09-reports-monthly.html',
  '10-reports-yearly.html',
  '11-reports-charts.html',
  '12-recurrences.html',
  '14-settings-general.html',
  '14-settings-general-models.html',
  '15-transaction-import.html',
]);

function protoHref(file) {
  const here = location.pathname.includes('/approved/');
  const there = APPROVED.has(file);
  if (here === there) return file;
  return here ? `../${file}` : `approved/${file}`;
}

function navItem(item, active) {
  const soon = !item.href;
  return `<a href="${item.href ? protoHref(item.href) : '#'}"
    ${active === item.id ? 'aria-current="page"' : ''}
    ${soon ? `aria-disabled="true" title="${SOON}"` : ''}
    >${icon(item.icon)}<span>${item.label}</span></a>`;
}

function buildShell(active) {
  const settingsOpen = NAV_SETTINGS.some((i) => i.id === active);
  return `<aside class="side" id="side">
    <div class="brand">
      <span class="mark"><i style="background:var(--c1)"></i><i style="background:var(--c3)"></i><i style="background:var(--c2)"></i><i style="background:var(--c5)"></i></span>
      Orçamento
    </div>
    <nav class="nav">
      ${NAV.map((i) => navItem(i, active)).join('')}
      <button type="button" aria-expanded="${settingsOpen}" data-toggle="settings-sub">
        ${icon('settings')}<span>Configurações</span>${icon('chevronRight', 'caret')}
      </button>
      <div class="sub" id="settings-sub" ${settingsOpen ? '' : 'hidden'}>
        ${NAV_SETTINGS.map((i) => navItem(i, active)).join('')}
      </div>
    </nav>
    <div class="user">
      <span class="av">LC</span>
      <span class="grow">
        <span class="strong">Luís</span><br />
        <span class="xs muted">luis@exemplo.pt</span>
      </span>
      <button class="btn icon ghost" title="Sair">${icon('logout')}</button>
    </div>
  </aside>`;
}

document.addEventListener('DOMContentLoaded', () => {
  let dialogOpener;
  /* the strip that names the prototype — not part of the application.
     An approved screen lives one folder down, so the index link has to climb
     back out. */
  const indexHref = location.pathname.includes('/approved/') ? '../index.html' : 'index.html';
  document.querySelectorAll('[data-proto]').forEach((el) => {
    const ticket = el.dataset.ticket;
    el.className = 'proto-bar';
    el.innerHTML =
      `<b>${el.dataset.proto}</b>` +
      (ticket ? `<span class="ticket">${ticket}</span>` : '') +
      `<span class="grow"></span><a href="${indexHref}">Todos os protótipos</a>`;
  });

  document.querySelectorAll('[data-shell]').forEach((el) => {
    el.classList.add('shell');
    el.insertAdjacentHTML('afterbegin', buildShell(el.dataset.shell));
  });

  document.querySelectorAll('[data-icon]').forEach((el) => {
    el.outerHTML = icon(el.dataset.icon);
  });

  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-toggle]');
    if (toggle) {
      const target = document.getElementById(toggle.dataset.toggle);
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      target.hidden = open;
    }

    const burger = e.target.closest('[data-burger]');
    if (burger) {
      const side = document.getElementById('side');
      side.dataset.open = side.dataset.open === 'true' ? 'false' : 'true';
    }

    const open = e.target.closest('[data-open]');
    if (open) {
      dialogOpener = open;
      const dialog = document.getElementById(open.dataset.open);
      dialog.style.display = 'grid';
      requestAnimationFrame(() => (dialog.querySelector('[autofocus]') ?? dialog.querySelector('button, input, select, textarea, [href]'))?.focus());
    }

    const close = e.target.closest('[data-close]');
    if (close) {
      close.closest('.scrim').style.display = 'none';
      dialogOpener?.focus();
    }

    const scrim = e.target.classList?.contains('scrim') ? e.target : null;
    if (scrim) {
      scrim.style.display = 'none';
      dialogOpener?.focus();
    }

    /* expandable table rows — a parent category revealing its subcategories */
    const expand = e.target.closest('[data-expand]');
    if (expand) {
      const key = expand.dataset.expand;
      const now = expand.getAttribute('aria-expanded') !== 'true';
      expand.setAttribute('aria-expanded', String(now));
      expand.querySelector('svg').style.transform = now ? 'rotate(90deg)' : '';
      document.querySelectorAll(`[data-child="${key}"]`).forEach((r) => {
        r.hidden = !now;
      });
    }

    const sw = e.target.closest('.switch');
    if (sw) sw.setAttribute('aria-checked', String(sw.getAttribute('aria-checked') !== 'true'));
  });

  document.addEventListener('keydown', (e) => {
    const openDialog = [...document.querySelectorAll('.scrim')].find((dialog) => getComputedStyle(dialog).display !== 'none');
    if (e.key === 'Tab' && openDialog) {
      const controls = [...openDialog.querySelectorAll('button, input, select, textarea, [href]')].filter((control) => !control.disabled);
      const edge = e.shiftKey ? controls[0] : controls.at(-1);
      if (document.activeElement === edge) {
        e.preventDefault();
        (e.shiftKey ? controls.at(-1) : controls[0])?.focus();
      }
      return;
    }
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.scrim').forEach((s) => (s.style.display = 'none'));
    dialogOpener?.focus();
    const side = document.getElementById('side');
    if (side) side.dataset.open = 'false';
  });
});
