import './styles/base.css';
import './styles/theme-sims.css';
import './styles/theme-neutral.css';

import { loadFamily } from './data';
import { Family } from './family';
import { OverviewView } from './views/overview';
import { renderPerson } from './views/person';
import type { Person } from './parser/types';
import { lifespan } from './ui/format';

const THEMES = [
  { id: 'sims', label: '🔮 Sims' },
  { id: 'neutral', label: '📄 Schlicht' },
] as const;

const family = new Family(loadFamily());
const view = must<HTMLElement>('#view');
const searchInput = must<HTMLInputElement>('#search');
const results = must<HTMLUListElement>('#results');
const backButton = must<HTMLButtonElement>('#back');
const themeButton = must<HTMLButtonElement>('#theme');

document.title = family.graph.title;
must<HTMLElement>('#family-title').textContent = family.graph.title;

const overview = new OverviewView(family, (id) => {
  location.hash = `#/p/${encodeURIComponent(id)}`;
});

// ---- routing --------------------------------------------------------------

function route(): void {
  const match = /^#\/p\/(.+)$/.exec(location.hash);
  const person = match ? family.person(decodeURIComponent(match[1]!)) : undefined;
  closeResults();

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

function openPerson(person: Person): void {
  searchInput.value = '';
  closeResults();
  searchInput.blur();
  // On the overview a search hit centres the bubble instead of leaving the map.
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
      button.className = 'result';
      const name = document.createElement('span');
      name.textContent = person.name;
      const years = document.createElement('small');
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
    searchInput.value = '';
    closeResults();
  }
});

document.addEventListener('pointerdown', (event) => {
  if (!(event.target as Element | null)?.closest('.search')) closeResults();
});

// ---- theme ----------------------------------------------------------------

function applyTheme(id: string): void {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
  document.documentElement.dataset.theme = theme.id;
  const next = THEMES[(THEMES.findIndex((t) => t.id === theme.id) + 1) % THEMES.length]!;
  themeButton.textContent = theme.label;
  themeButton.title = `Design wechseln (nächstes: ${next.label})`;
  try {
    localStorage.setItem('stammbaum-theme', theme.id);
  } catch {
    // Private browsing — the theme just won't be remembered.
  }
}

themeButton.addEventListener('click', () => {
  const current = document.documentElement.dataset.theme ?? THEMES[0].id;
  const index = THEMES.findIndex((t) => t.id === current);
  applyTheme(THEMES[(index + 1) % THEMES.length]!.id);
});

let stored: string | null = null;
try {
  stored = localStorage.getItem('stammbaum-theme');
} catch {
  stored = null;
}
applyTheme(stored ?? THEMES[0].id);

// ---- parse warnings -------------------------------------------------------

if (family.graph.warnings.length > 0) {
  const banner = document.createElement('div');
  banner.className = 'warnings';
  banner.innerHTML = `<strong>${family.graph.warnings.length} Hinweis(e) in family.md</strong>`;
  const list = document.createElement('ul');
  for (const warning of family.graph.warnings.slice(0, 8)) {
    const item = document.createElement('li');
    item.textContent = warning.line > 0 ? `Zeile ${warning.line}: ${warning.message}` : warning.message;
    list.append(item);
  }
  banner.append(list);
  banner.addEventListener('click', () => banner.remove());
  document.body.append(banner);
}

route();

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`missing element: ${selector}`);
  return element;
}
