# Stammbaum

A pocket "who is who" for family gatherings. Built mobile first — the phone in
your pocket at the party is the primary target, the desktop layout is the
enhancement. Two screens, one markdown file:

- **Übersicht** — the whole tree as a map you drag, pinch and flick around.
- **Person** — one person with their first-degree relatives only: parents on
  top, partners beside (below, on a phone), children underneath.

The data lives in [`data/family.md`](data/family.md) and is written in a
mermaid-flavoured DSL, so the tree is edited like text and reviewed like code.

## Gestures

The overview has no zoom buttons; it is driven by gestures, the same ones a map
app uses.

| Gesture | |
| --- | --- |
| Drag / flick | Pan, with momentum afterwards |
| Two-finger pinch | Zoom, around the point between your fingers |
| Double-tap | Zoom in at that point; again when zoomed in, back out |
| Tap a bubble | Open that person |
| Mouse wheel, trackpad pinch | Zoom at the cursor |
| Arrow keys, `+` / `-`, Enter | The same, from the keyboard |

The tree is clamped so it can never be flung off screen, and the button in the
bottom corner zooms out to the whole family.

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

The default theme is **Material**: Material 3 baseline colour roles, elevation
and shape tokens, a top app bar, tonal chips and a FAB. The button in the app bar
switches to **Papier**, a calm printed-genealogy look, and the choice is
remembered.

Structure and theme are strictly separated:

- [`src/styles/base.css`](src/styles/base.css) — layout only, no colours, and
  mobile first: phone styles are the defaults, `@media (min-width: 800px)` adds
  what a bigger screen can afford.
- [`src/styles/theme-material.css`](src/styles/theme-material.css),
  [`src/styles/theme-neutral.css`](src/styles/theme-neutral.css) — the same set
  of custom properties on `:root[data-theme='…']`, plus a few decorative rules.

To add a theme, copy a theme file, change the values, and add it to `THEMES` in
[`src/main.ts`](src/main.ts).

## How it is built

Vite + TypeScript, no UI framework and no runtime dependencies — the whole app
is ~34 kB of JavaScript, icons included (they are inline SVG, so there is no
icon font to load). The overview is one SVG with a transform for pan and zoom,
driven by Pointer Events so mouse, trackpad, pen and touch all take the same
code path. The person view is HTML with connectors drawn into an SVG overlay
after layout, so it reflows correctly from a 390 px phone up.

```
data/family.md          the family, and the format documented in prose
data/photos/            photos, inlined by the offline build
src/parser/             markdown → { people, unions, warnings }
src/family.ts           derived lookups: parents, partnerships, broods, search
src/layout/layout.ts    generations, tidy horizontal placement, refinement sweep
src/ui/icons.ts         inline Material-style icons
src/views/overview.ts   the gesture-driven SVG tree
src/views/person.ts     one person and their first-degree relatives
src/styles/             base.css + one file per theme
tests/                  parser, family and layout tests (vitest)
```

The layout is a two-stage tidy tree: a recursive walk places each couple above
the middle of its children, then a relaxation sweep pulls couples towards their
children and children towards their parents without ever reordering a row. Two
families that marry into each other end up next to each other instead of at
opposite ends of the page.
