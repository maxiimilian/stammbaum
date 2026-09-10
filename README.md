# Stammbaum

A pocket "who is who" for family gatherings. Two screens, one markdown file:

- **Übersicht** — the whole tree in a pannable, zoomable map.
- **Person** — one person with their first-degree relatives only: parents on
  top, partners beside, children below.

The data lives in [`data/family.md`](data/family.md) and is written in a
mermaid-flavoured DSL, so the tree is edited like text and reviewed like code.

## Running it

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # parser, graph and layout tests
npm run build        # dist/ — a normal static site
npm run build:single # dist/index.html — ONE self-contained file, works offline
```

`build:single` inlines the script, the styles and every photo as `data:` URIs.
The result is a single HTML file you can mail to relatives or open from a USB
stick with no server and no network — which is usually what a family gathering
in a house with bad reception actually needs.

## Writing the family file

Everything the app shows comes from the ```` ```family ```` block(s) in
`data/family.md`. Prose outside those blocks is ignored, so document the family
in the same file.

```family
person heinrich  "Heinrich Bauer"  born=1931-04-02 died=2011-08-17 photo=heinrich.jpg
person elisabeth "Elisabeth Bauer" born=1934-11-23 maiden=Vogt nick=Oma

heinrich + elisabeth married=1956-05-19 -> klaus, brigitte

%% Divorced, then married again: two partnerships, one line each.
klaus + sabine married=1984 divorced=1996 -> nina, jonas
klaus + carmen married=2001 -> luca
```

| Statement | Meaning |
| --- | --- |
| `person <id> "<Name>" key=value …` | Declares a person. |
| `<a> + <b> key=value …` | A partnership. |
| `<a> + <b> -> <child>, <child>` | Children of that partnership. |
| `<a> -> <child>` | Children whose second parent is unknown. |
| `%% …` | Comment. |

**Person keys** — `born`, `died`, `photo`, `maiden`, `nick`, `note`.
**Partnership keys** — `married`, `divorced`, `children`.

Notes:

- Dates are free text, but `1956`, `1956-04` and `1956-04-02` are formatted
  nicely (`* 2. April 1956`); anything else is printed as written.
- Ids are the deep-link handles — `#/p/klaus` opens Klaus directly — so keep
  them short, lowercase and stable.
- `nick` wins over the first name in bubbles: the tree says *Oma*, the detail
  view says *Elisabeth Bauer*.
- Statements about one partnership may be split across lines and written in
  either partner order; they merge.
- Photos are file names inside [`data/photos/`](data/photos). Anyone without a
  photo gets an initials bubble in a colour derived from their id.
- Undeclared ids still render, and the app shows a dismissible list of hints
  about the file — a half-finished tree never breaks the page.

## Themes

The default theme is a nod to *The Sims*: sky blue, plumbob green, chunky glossy
buttons, a plumbob over whoever you are looking at. The button in the top right
switches to **Schlicht**, a calm paper look, and the choice is remembered.

Structure and theme are strictly separated:

- [`src/styles/base.css`](src/styles/base.css) — layout only, no colours.
- [`src/styles/theme-sims.css`](src/styles/theme-sims.css),
  [`src/styles/theme-neutral.css`](src/styles/theme-neutral.css) — custom
  properties on `:root[data-theme='…']`, plus a few decorative rules.

To add a theme, copy a theme file, change the values, and add it to `THEMES` in
[`src/main.ts`](src/main.ts).

## How it is built

Vite + TypeScript, no UI framework and no runtime dependencies — the whole app
is ~30 kB of JavaScript. The overview is one SVG with a transform for pan and
zoom; the person view is HTML with connectors drawn into an SVG overlay after
layout, so it reflows correctly down to phone width.

```
data/family.md          the family, and the format documented in prose
data/photos/            photos, inlined by the offline build
src/parser/             markdown → { people, unions, warnings }
src/family.ts           derived lookups: parents, partnerships, broods, search
src/layout/layout.ts    generations, tidy horizontal placement, refinement sweep
src/views/overview.ts   the zoomable SVG tree
src/views/person.ts     one person and their first-degree relatives
src/styles/             base.css + one file per theme
tests/                  parser, family and layout tests (vitest)
```

The layout is a two-stage tidy tree: a recursive walk places each couple above
the middle of its children, then a relaxation sweep pulls couples towards their
children and children towards their parents without ever reordering a row. Two
families that marry into each other end up next to each other instead of at
opposite ends of the page.
