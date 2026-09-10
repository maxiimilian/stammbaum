import type { Family } from '../family';
import type { Person, Union } from '../parser/types';
import { bubble, tile } from '../ui/tile';
import { longDate, shortName, year } from '../ui/format';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * One person and their first-degree relatives: parents above, partners beside,
 * children below. Connectors are drawn into an SVG overlay after layout, so
 * they stay correct however the rows wrap on a phone.
 */
export function renderPerson(family: Family, person: Person): HTMLElement {
  const root = document.createElement('article');
  root.className = 'person-view';

  const wires = document.createElementNS(SVG_NS, 'svg');
  wires.setAttribute('class', 'wires');
  root.append(wires);

  const parents = family.parents(person.id);
  const partnerships = family.partnerships(person.id);
  const broods = family.broods(person.id);

  const parentTiles: HTMLElement[] = [];
  if (parents.length > 0) {
    const tier = section('tier tier-parents', 'Eltern');
    const row = document.createElement('div');
    row.className = 'row';
    for (const parent of parents) {
      const element = tile(parent);
      parentTiles.push(element);
      row.append(element);
    }
    tier.append(row);
    root.append(tier);
  }

  // Focus row: a three-column grid keeps the focused person dead centre even
  // when there is only one partner.
  const focusTier = document.createElement('section');
  focusTier.className = 'tier tier-focus';
  const left = document.createElement('div');
  left.className = 'partner-slot slot-left';
  const right = document.createElement('div');
  right.className = 'partner-slot slot-right';
  const card = focusCard(person);
  focusTier.append(left, card, right);
  root.append(focusTier);

  const partnerTiles = new Map<string, HTMLElement>();
  partnerships.forEach(({ union, partner }, index) => {
    if (!partner) return;
    const element = document.createElement('div');
    element.className = 'partner';
    element.append(tile(partner), relationPill(union));
    partnerTiles.set(union.id, element);
    (index === 0 && partnerships.length > 1 ? left : right).append(element);
  });
  // Narrow screens drop the partners below the card; the CSS needs to know
  // which side is actually occupied to keep a single partner centred.
  focusTier.classList.toggle('has-left', left.childElementCount > 0);
  focusTier.classList.toggle('has-right', right.childElementCount > 0);

  const broodTiles: Array<{ union: Union; tiles: HTMLElement[] }> = [];
  if (broods.length > 0) {
    const tier = section('tier tier-children', broods.flatMap((b) => b.children).length === 1 ? 'Kind' : 'Kinder');
    const groups = document.createElement('div');
    groups.className = 'broods';
    for (const brood of broods) {
      const group = document.createElement('div');
      group.className = 'brood';
      if (broods.length > 1 && brood.partner) {
        const caption = document.createElement('span');
        caption.className = 'brood-label';
        caption.textContent = `mit ${shortName(brood.partner)}`;
        group.append(caption);
      }
      const row = document.createElement('div');
      row.className = 'row';
      const tiles = brood.children.map((child) => {
        const element = tile(child);
        row.append(element);
        return element as HTMLElement;
      });
      group.append(row);
      groups.append(group);
      broodTiles.push({ union: brood.union, tiles });
    }
    tier.append(groups);
    root.append(tier);
  }

  if (parents.length === 0 && partnerships.length === 0 && broods.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-note';
    empty.textContent = 'Keine Verwandten in der Datei hinterlegt.';
    root.append(empty);
  }

  const draw = () => drawWires(wires, root, card, parentTiles, partnerTiles, broodTiles);
  requestAnimationFrame(draw);
  new ResizeObserver(draw).observe(root);
  return root;
}

function section(className: string, label: string): HTMLElement {
  const element = document.createElement('section');
  element.className = className;
  const caption = document.createElement('h2');
  caption.className = 'tier-label';
  caption.textContent = label;
  element.append(caption);
  return element;
}

function focusCard(person: Person): HTMLElement {
  const card = document.createElement('div');
  card.className = `focus-card${person.died ? ' is-deceased' : ''}`;
  card.append(bubble(person, 168));

  const name = document.createElement('h1');
  name.className = 'focus-name';
  name.textContent = person.name;
  card.append(name);

  if (person.nick && person.nick !== shortName(person)) {
    card.append(line('focus-nick', `„${person.nick}“`));
  }
  if (person.maiden) card.append(line('focus-maiden', `geb. ${person.maiden}`));

  const dates: string[] = [];
  if (person.born) dates.push(`* ${longDate(person.born)}`);
  if (person.died) dates.push(`† ${longDate(person.died)}`);
  if (dates.length > 0) card.append(line('focus-dates', dates.join('   ')));
  if (person.note) card.append(line('focus-note', person.note));
  return card;
}

function line(className: string, text: string): HTMLElement {
  const element = document.createElement('p');
  element.className = className;
  element.textContent = text;
  return element;
}

function relationPill(union: Union): HTMLElement {
  const pill = document.createElement('span');
  const divorced = union.divorced !== undefined;
  pill.className = `relation-pill${divorced ? ' is-divorced' : ''}`;
  const from = year(union.married);
  pill.textContent = divorced
    ? `💔 ${[from, year(union.divorced)].filter(Boolean).join(' – ') || 'geschieden'}`
    : `💍 ${from || 'verheiratet'}`;
  return pill;
}

// ---- connectors -----------------------------------------------------------

function drawWires(
  svg: SVGSVGElement,
  root: HTMLElement,
  focus: HTMLElement,
  parents: HTMLElement[],
  partners: Map<string, HTMLElement>,
  broods: Array<{ union: Union; tiles: HTMLElement[] }>,
): void {
  const base = root.getBoundingClientRect();
  if (base.width === 0) return;
  svg.setAttribute('viewBox', `0 0 ${base.width} ${base.height}`);
  svg.setAttribute('width', String(base.width));
  svg.setAttribute('height', String(base.height));
  svg.replaceChildren();

  const box = (element: Element) => {
    const rect = element.getBoundingClientRect();
    return {
      cx: rect.left - base.left + rect.width / 2,
      top: rect.top - base.top,
      bottom: rect.top - base.top + rect.height,
      left: rect.left - base.left,
      right: rect.right - base.left,
    };
  };
  const bubbleOf = (element: Element) => box(element.querySelector('.bubble-html') ?? element);

  const path = (d: string, className: string) => {
    const element = document.createElementNS(SVG_NS, 'path');
    element.setAttribute('class', className);
    element.setAttribute('d', d);
    svg.append(element);
  };

  const focusBubble = bubbleOf(focus);

  const card = box(focus);
  if (parents.length > 0) {
    // Leave from the bottom of the whole tile so the wire clears the captions.
    const tiles = parents.map(box);
    const bubbles = parents.map(bubbleOf);
    const busY = (Math.max(...tiles.map((p) => p.bottom)) + card.top) / 2;
    const xs = [...bubbles.map((p) => p.cx), focusBubble.cx];
    path(
      [
        ...tiles.map((p, i) => `M ${bubbles[i]!.cx} ${p.bottom} L ${bubbles[i]!.cx} ${busY}`),
        `M ${Math.min(...xs)} ${busY} L ${Math.max(...xs)} ${busY}`,
        `M ${focusBubble.cx} ${busY} L ${focusBubble.cx} ${card.top}`,
      ].join(' '),
      'wire wire-descent',
    );
  }

  // A partner sits beside the card on a wide screen and below it on a phone.
  const partnerGeometry = new Map<string, { bubble: ReturnType<typeof box>; outer: ReturnType<typeof box>; below: boolean }>();
  for (const [unionId, element] of partners) {
    const bubble = bubbleOf(element);
    const outer = box(element);
    const below = bubble.top > card.bottom - 4;
    partnerGeometry.set(unionId, { bubble, outer, below });

    const divorced = element.querySelector('.relation-pill.is-divorced') !== null;
    const kind = `wire wire-${divorced ? 'divorced' : 'married'}`;
    if (below) {
      const midY = (card.bottom + bubble.top) / 2;
      path(
        `M ${focusBubble.cx} ${card.bottom} L ${focusBubble.cx} ${midY} L ${bubble.cx} ${midY} L ${bubble.cx} ${bubble.top}`,
        kind,
      );
      continue;
    }
    const y = (bubble.top + bubble.bottom) / 2;
    const [from, to] =
      bubble.cx < focusBubble.cx ? [bubble.right, card.left] : [card.right, bubble.left];
    path(`M ${from} ${y} L ${to} ${y}`, kind);
  }

  for (const { union, tiles } of broods) {
    if (tiles.length === 0) continue;
    const partner = partnerGeometry.get(union.id);
    // Stacked below the card, the children hang off the partner instead.
    const originX = partner ? (partner.below ? partner.bubble.cx : (partner.bubble.cx + focusBubble.cx) / 2) : focusBubble.cx;
    const originY = partner
      ? partner.below
        ? partner.outer.bottom
        : Math.max(partner.bubble.bottom, card.bottom) - 8
      : card.bottom;
    const children = tiles.map(bubbleOf);
    const busY = Math.max(
      originY + 10,
      Math.min(...children.map((c) => c.top)) - 22,
    );
    const xs = [...children.map((c) => c.cx), originX];
    path(
      [
        `M ${originX} ${originY} L ${originX} ${busY}`,
        `M ${Math.min(...xs)} ${busY} L ${Math.max(...xs)} ${busY}`,
        ...children.map((c) => `M ${c.cx} ${busY} L ${c.cx} ${c.top}`),
      ].join(' '),
      'wire wire-descent',
    );
  }
}
