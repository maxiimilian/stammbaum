import './styles/app.css';

import { loadFamily } from './data';
import { Family } from './family';
import { OverviewView } from './views/overview';
import { renderPerson } from './views/person';
import { icon, iconButton, type IconName } from './ui/icons';
import type { Person } from './parser/types';
import { lifespan } from './ui/format';

/**
 * Three-way appearance switch. "system" leaves the choice to the OS: daisyUI's
 * dark theme is registered with --prefersdark, so it applies on its own when no
 * data-theme attribute is set.
 */
const MODES = [
  { id: 'system', label: 'Automatisch', icon: 'auto' },
  { id: 'light', label: 'Hell', icon: 'sun' },
  { id: 'dark', label: 'Dunkel', icon: 'moon' },
] as const satisfies ReadonlyArray<{ id: string; label: string; icon: IconName }>;

type Mode = (typeof MODES)[number]['id'];

const family = new Family(loadFamily());
const appBar = must<HTMLElement>('.app-bar');
const actions = must<HTMLElement>('.app-actions');
const view = must<HTMLElement>('#view');
const searchInput = must<HTMLInputElement>('#search');
const results = must<HTMLUListElement>('#results');
const title = must<HTMLAnchorElement>('#family-title');

const backButton = iconButton('back', 'Zurück zur Übersicht');
const searchToggle = iconButton('search', 'Person suchen');
const themeButton = iconButton('auto', 'Darstellung wechseln');
backButton.id = 'back';
searchToggle.id = 'search-toggle';
themeButton.id = 'theme';
searchToggle.classList.add('search-toggle');
searchToggle.setAttribute('aria-pressed', 'false');
backButton.hidden = true;
actions.append(backButton, searchToggle, themeButton);

must<HTMLElement>('#crest').append(icon('tree'));
document.title = family.graph.title;
title.textContent = family.graph.title;

const overview = new OverviewView(family, (id) => {
  location.hash = `#/p/${encodeURIComponent(id)}`;
});

// ---- routing --------------------------------------------------------------

function route(): void {
  const match = /^#\/p\/(.+)$/.exec(location.hash);
  const person = match ? family.person(decodeURIComponent(match[1]!)) : undefined;
  closeResults();
  closeSearch();

  if (person) {
    view.replaceChildren(renderPerson(family, person));
    view.scrollTop = 0;
    backButton.hidden = false;
    document.title = `${person.name} — ${family.graph.title}`;
    return;
  }
  if (match) location.replace('#/');

  view.replaceChildren(overview.element);
  overview.activate();
  showGestureHint();
  backButton.hidden = true;
  document.title = family.graph.title;
}

window.addEventListener('hashchange', route);
backButton.addEventListener('click', () => {
  location.hash = '#/';
});

// ---- search ---------------------------------------------------------------

let hits: Person[] = [];

function closeResults(): void {
  results.hidden = true;
  results.replaceChildren();
  searchInput.setAttribute('aria-expanded', 'false');
}

/** On a phone the field lives under the bar and is opened by the search icon. */
function openSearch(): void {
  appBar.classList.add('is-searching');
  searchToggle.setAttribute('aria-pressed', 'true');
  searchInput.focus();
}

function closeSearch(): void {
  appBar.classList.remove('is-searching');
  searchToggle.setAttribute('aria-pressed', 'false');
  searchInput.value = '';
}

searchToggle.addEventListener('click', () => {
  if (appBar.classList.contains('is-searching')) {
    closeResults();
    closeSearch();
  } else {
    openSearch();
  }
});

function openPerson(person: Person): void {
  closeResults();
  closeSearch();
  searchInput.blur();
  // On the overview a hit centres the bubble instead of leaving the map.
  if (location.hash === '' || location.hash === '#/') overview.highlight(person.id);
  else location.hash = `#/p/${encodeURIComponent(person.id)}`;
}

searchInput.addEventListener('input', () => {
  hits = family.search(searchInput.value);
  if (hits.length === 0) {
    closeResults();
    return;
  }
  results.replaceChildren(
    ...hits.map((person) => {
      const item = document.createElement('li');
      item.setAttribute('role', 'option');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'result flex w-full items-baseline justify-between gap-3';
      const name = document.createElement('span');
      name.textContent = person.name;
      const years = document.createElement('small');
      years.className = 'opacity-60 tabular-nums';
      years.textContent = lifespan(person);
      button.append(name, years);
      button.addEventListener('click', () => openPerson(person));
      item.append(button);
      return item;
    }),
  );
  results.hidden = false;
  searchInput.setAttribute('aria-expanded', 'true');
});

searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && hits[0]) openPerson(hits[0]);
  if (event.key === 'Escape') {
    closeResults();
    closeSearch();
  }
});

document.addEventListener('pointerdown', (event) => {
  const target = event.target as Element | null;
  if (target?.closest('.search') || target?.closest('.search-toggle')) return;
  closeResults();
  if (searchInput.value === '') closeSearch();
});

// ---- appearance -----------------------------------------------------------

function applyMode(id: string): void {
  const mode = MODES.find((m) => m.id === id) ?? MODES[0];
  const next = MODES[(MODES.findIndex((m) => m.id === mode.id) + 1) % MODES.length]!;

  // No attribute means "let daisyUI follow prefers-color-scheme".
  if (mode.id === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = mode.id;

  themeButton.replaceChildren(icon(mode.icon));
  themeButton.title = `Darstellung: ${mode.label} — umschalten auf ${next.label}`;
  themeButton.setAttribute('aria-label', themeButton.title);
  writeStored('stammbaum-mode', mode.id);
  paintThemeColor();
}

/** Keeps the phone's status bar in step with the theme. */
function paintThemeColor(): void {
  const meta = document.querySelector<HTMLMetaElement>('#theme-color');
  if (!meta) return;
  const shell = document.querySelector('.app-shell');
  const surface = shell ? getComputedStyle(shell).backgroundColor : '';
  if (surface) meta.content = toHex(surface) ?? surface;
}

/**
 * daisyUI's palette is oklch, which older browsers will not parse in a
 * theme-color tag. Painting one pixel and reading it back gives plain sRGB.
 */
function toHex(color: string): string | undefined {
  try {
    const context = document.createElement('canvas').getContext('2d');
    if (!context) return undefined;
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    if (r === undefined || g === undefined || b === undefined) return undefined;
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  } catch {
    return undefined;
  }
}

themeButton.addEventListener('click', () => {
  const current = (readStored('stammbaum-mode') ?? 'system') as Mode;
  const index = MODES.findIndex((m) => m.id === current);
  applyMode(MODES[(index + 1) % MODES.length]!.id);
});

applyMode(readStored('stammbaum-mode') ?? 'system');
// Following the system means reacting when it changes.
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintThemeColor);

// ---- one-off gesture hint -------------------------------------------------

function showGestureHint(): void {
  if (readStored('stammbaum-hint') === 'seen') return;
  const touch = matchMedia('(pointer: coarse)').matches;
  const hint = document.createElement('div');
  hint.className = 'hint alert border-0 bg-neutral text-neutral-content shadow-lg';
  hint.textContent = touch
    ? 'Ziehen zum Bewegen · zwei Finger zum Zoomen · tippen für eine Person'
    : 'Ziehen zum Bewegen · Mausrad zum Zoomen · Klick für eine Person';
  overview.element.append(hint);
  writeStored('stammbaum-hint', 'seen');

  const dismiss = () => {
    hint.classList.add('is-leaving');
    setTimeout(() => hint.remove(), 400);
  };
  setTimeout(dismiss, 6000);
  overview.element.addEventListener('pointerdown', dismiss, { once: true });
}

// ---- parse warnings -------------------------------------------------------

if (family.graph.warnings.length > 0) {
  const banner = document.createElement('div');
  banner.className = 'warnings alert alert-warning shadow-lg flex-col items-start gap-1';
  const heading = document.createElement('strong');
  heading.textContent = `${family.graph.warnings.length} Hinweis(e) in family.md`;
  const list = document.createElement('ul');
  for (const warning of family.graph.warnings.slice(0, 8)) {
    const item = document.createElement('li');
    item.textContent = warning.line > 0 ? `Zeile ${warning.line}: ${warning.message}` : warning.message;
    list.append(item);
  }
  banner.append(heading, list);
  banner.addEventListener('click', () => banner.remove());
  document.body.append(banner);
}

route();

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Nothing to do — the hint will show again next time.
  }
}

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`missing element: ${selector}`);
  return element;
}
