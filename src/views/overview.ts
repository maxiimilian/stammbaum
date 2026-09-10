import type { Family } from '../family';
import { layoutFamily, METRICS, type Layout, type NodeBox } from '../layout/layout';
import { photoUrl } from '../data';
import { familyName, initials, lifespan, shortName, avatarHue } from '../ui/format';
import type { Person } from '../parser/types';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MIN_SCALE = 0.15;
const MAX_SCALE = 2.5;

/**
 * The whole tree in one pannable, zoomable SVG. Built once and kept alive, so
 * you come back from a person view to exactly the spot you left.
 */
export class OverviewView {
  readonly element: HTMLElement;
  private readonly svg: SVGSVGElement;
  private readonly viewport: SVGGElement;
  private readonly layout: Layout;
  private readonly nodeElements = new Map<string, SVGGElement>();
  private scale = 1;
  private translate = { x: 0, y: 0 };
  private highlighted: string | undefined;

  constructor(
    private readonly family: Family,
    private readonly onSelect: (id: string) => void,
  ) {
    this.layout = layoutFamily(family.graph);
    this.element = document.createElement('div');
    this.element.className = 'overview';

    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.setAttribute('class', 'tree');
    this.viewport = document.createElementNS(SVG_NS, 'g');
    this.svg.append(this.viewport);
    this.element.append(this.svg);

    this.viewport.append(this.drawLinks(), this.drawNodes());
    this.bindPointer();
    this.element.append(this.buildControls());
  }

  /** Called whenever the view becomes visible. */
  activate(): void {
    if (this.scale === 1 && this.translate.x === 0 && this.translate.y === 0) this.fit();
    else this.apply();
  }

  fit(): void {
    const box = this.svg.getBoundingClientRect();
    if (box.width === 0) return;
    const scale = clamp(
      Math.min(box.width / this.layout.width, box.height / this.layout.height),
      MIN_SCALE,
      1.1,
    );
    this.scale = scale;
    this.translate = {
      x: (box.width - this.layout.width * scale) / 2,
      y: (box.height - this.layout.height * scale) / 2,
    };
    this.apply();
  }

  /** Centres one bubble and gives it the plumbob, used by search. */
  highlight(id: string): void {
    const node = this.layout.nodes.get(id);
    if (!node) return;
    const box = this.svg.getBoundingClientRect();
    this.scale = clamp(Math.max(this.scale, 0.9), MIN_SCALE, MAX_SCALE);
    this.translate = {
      x: box.width / 2 - node.x * this.scale,
      y: box.height / 2 - node.y * this.scale,
    };
    this.apply();
    if (this.highlighted) this.nodeElements.get(this.highlighted)?.classList.remove('is-focused');
    this.nodeElements.get(id)?.classList.add('is-focused');
    this.highlighted = id;
  }

  private zoomBy(factor: number, originX?: number, originY?: number): void {
    const box = this.svg.getBoundingClientRect();
    const cx = originX ?? box.width / 2;
    const cy = originY ?? box.height / 2;
    const next = clamp(this.scale * factor, MIN_SCALE, MAX_SCALE);
    const ratio = next / this.scale;
    this.translate = {
      x: cx - (cx - this.translate.x) * ratio,
      y: cy - (cy - this.translate.y) * ratio,
    };
    this.scale = next;
    this.apply();
  }

  private apply(): void {
    this.viewport.setAttribute(
      'transform',
      `translate(${this.translate.x} ${this.translate.y}) scale(${this.scale})`,
    );
  }

  // ---- drawing ------------------------------------------------------------

  private drawLinks(): SVGGElement {
    const group = svgEl('g', { class: 'links' });
    const lanes = assignLanes(this.layout);
    for (const union of this.layout.unions) {
      const partners = union.partners
        .map((id) => this.layout.nodes.get(id))
        .filter((n): n is NodeBox => !!n)
        .sort((a, b) => a.x - b.x);

      const state = union.divorced ? 'divorced' : 'married';
      const [left, right] = partners;
      if (left && right) {
        group.append(
          svgEl('line', {
            class: `link link-${state}`,
            x1: left.x + METRICS.bubbleRadius,
            y1: left.y,
            x2: right.x - METRICS.bubbleRadius,
            y2: right.y,
          }),
        );
        group.append(this.marriageBadge(union.x, union.y, state));
      }

      const children = union.children
        .map((id) => this.layout.nodes.get(id))
        .filter((n): n is NodeBox => !!n);
      if (children.length === 0) continue;

      const busY = union.y + METRICS.rowHeight - 92 + (lanes.get(union.id) ?? 0) * 15;
      const xs = children.map((c) => c.x);
      group.append(
        svgEl('path', {
          class: 'link link-descent',
          d: [
            `M ${union.x} ${union.y + (partners.length > 1 ? 16 : METRICS.bubbleRadius)}`,
            `L ${union.x} ${busY}`,
            `M ${Math.min(...xs, union.x)} ${busY}`,
            `L ${Math.max(...xs, union.x)} ${busY}`,
            ...children.map((c) => `M ${c.x} ${busY} L ${c.x} ${c.y - METRICS.bubbleRadius - 4}`),
          ].join(' '),
        }),
      );
    }
    return group;
  }

  private marriageBadge(x: number, y: number, state: string): SVGGElement {
    const badge = svgEl('g', { class: `badge badge-${state}`, transform: `translate(${x} ${y})` });
    badge.append(svgEl('circle', { r: 13, class: 'badge-disc' }));
    const glyph = svgEl('text', { class: 'badge-glyph', y: 5 });
    glyph.textContent = state === 'divorced' ? '💔' : '💍';
    badge.append(glyph);
    return badge;
  }

  private drawNodes(): SVGGElement {
    const group = svgEl('g', { class: 'nodes' });
    for (const node of [...this.layout.nodes.values()].sort((a, b) => a.y - b.y)) {
      const person = this.family.person(node.id);
      if (!person) continue;
      const element = this.drawNode(person, node);
      this.nodeElements.set(node.id, element);
      group.append(element);
    }
    return group;
  }

  private drawNode(person: Person, node: NodeBox): SVGGElement {
    const r = METRICS.bubbleRadius;
    const group = svgEl('g', {
      class: `node${person.died ? ' is-deceased' : ''}`,
      transform: `translate(${node.x} ${node.y})`,
      tabindex: 0,
      role: 'button',
      'aria-label': person.name,
    });
    group.dataset.id = person.id;

    // Plumbob — the Sims theme shows it on hover/focus, other themes hide it.
    group.append(
      svgEl('path', { class: 'plumbob', d: `M 0 ${-r - 34} L 11 ${-r - 18} L 0 ${-r - 2} L -11 ${-r - 18} Z` }),
    );
    group.append(svgEl('circle', { class: 'bubble-ring', r: r + 4 }));
    group.append(svgEl('circle', { class: 'bubble', r }));

    const url = photoUrl(person);
    if (url) {
      const clipId = `clip-${person.id}`;
      const clip = svgEl('clipPath', { id: clipId });
      clip.append(svgEl('circle', { r: r - 2 }));
      group.append(clip);
      group.append(
        svgEl('image', {
          href: url,
          x: -r + 2,
          y: -r + 2,
          width: (r - 2) * 2,
          height: (r - 2) * 2,
          preserveAspectRatio: 'xMidYMid slice',
          'clip-path': `url(#${clipId})`,
        }),
      );
    } else {
      group.append(
        svgEl('circle', { class: 'bubble-fill', r: r - 2, style: `fill: hsl(${avatarHue(person.id)} 55% 78%)` }),
      );
      const text = svgEl('text', { class: 'bubble-initials', y: 9 });
      text.textContent = initials(person);
      group.append(text);
    }

    const first = svgEl('text', { class: 'node-name', y: r + 24 });
    first.textContent = shortName(person);
    group.append(first);

    const last = familyName(person);
    if (last) {
      const surname = svgEl('text', { class: 'node-surname', y: r + 40 });
      surname.textContent = last;
      group.append(surname);
    }

    const years = lifespan(person);
    if (years) {
      const dates = svgEl('text', { class: 'node-years', y: r + (last ? 56 : 40) });
      dates.textContent = years;
      group.append(dates);
    }
    return group;
  }

  private buildControls(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'zoom-bar';
    const buttons: Array<[string, string, () => void]> = [
      ['−', 'Herauszoomen', () => this.zoomBy(1 / 1.3)],
      ['⛶', 'Ganzen Baum zeigen', () => this.fit()],
      ['+', 'Hineinzoomen', () => this.zoomBy(1.3)],
    ];
    for (const [glyph, label, action] of buttons) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip';
      button.textContent = glyph;
      button.title = label;
      button.setAttribute('aria-label', label);
      button.addEventListener('click', action);
      bar.append(button);
    }
    return bar;
  }

  // ---- interaction --------------------------------------------------------

  private bindPointer(): void {
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchDistance = 0;
    let moved = 0;
    // Pointer capture retargets pointerup at the <svg>, so remember what was
    // actually pressed.
    let pressed: string | undefined;

    this.svg.addEventListener('pointerdown', (event) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.svg.setPointerCapture(event.pointerId);
      if (pointers.size === 2) pinchDistance = distance(pointers);
      moved = 0;
      pressed = (event.target as Element | null)?.closest<SVGGElement>('.node')?.dataset.id;
    });

    this.svg.addEventListener('pointermove', (event) => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      const point = { x: event.clientX, y: event.clientY };
      pointers.set(event.pointerId, point);

      if (pointers.size === 2) {
        const next = distance(pointers);
        if (pinchDistance > 0) {
          const box = this.svg.getBoundingClientRect();
          const centre = midpoint(pointers);
          this.zoomBy(next / pinchDistance, centre.x - box.left, centre.y - box.top);
        }
        pinchDistance = next;
        moved = 99;
        return;
      }
      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      moved += Math.abs(dx) + Math.abs(dy);
      this.translate = { x: this.translate.x + dx, y: this.translate.y + dy };
      this.element.classList.add('is-panning');
      this.apply();
    });

    const release = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinchDistance = 0;
      this.element.classList.remove('is-panning');
      if (moved < 6 && pressed) this.onSelect(pressed);
      pressed = undefined;
    };
    this.svg.addEventListener('pointerup', release);
    this.svg.addEventListener('pointercancel', release);

    this.svg.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        const box = this.svg.getBoundingClientRect();
        this.zoomBy(Math.exp(-event.deltaY * 0.0015), event.clientX - box.left, event.clientY - box.top);
      },
      { passive: false },
    );

    this.svg.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const id = (event.target as Element | null)?.closest<SVGGElement>('.node')?.dataset.id;
      if (!id) return;
      event.preventDefault();
      this.onSelect(id);
    });
  }
}

/**
 * Two families in the same generation whose children sit side by side would
 * otherwise draw their horizontal bus at exactly the same height and read as a
 * single line. Overlapping buses get their own lane.
 */
function assignLanes(layout: Layout): Map<string, number> {
  const spans = layout.unions
    .map((union) => {
      const xs = [...union.children, ...union.partners]
        .map((id) => layout.nodes.get(id)?.x)
        .filter((x): x is number => x !== undefined);
      return { union, from: Math.min(...xs), to: Math.max(...xs) };
    })
    .filter((span) => span.union.children.length > 0)
    .sort((a, b) => a.from - b.from);

  const lanes = new Map<string, number>();
  const ends = new Map<string, number[]>();
  for (const span of spans) {
    const row = String(span.union.y);
    const taken = ends.get(row) ?? [];
    let lane = taken.findIndex((end) => end < span.from - 10);
    if (lane === -1) lane = taken.length;
    taken[lane] = span.to;
    ends.set(row, taken);
    lanes.set(span.union.id, lane);
  }
  return lanes;
}

function distance(pointers: Map<number, { x: number; y: number }>): number {
  const [a, b] = [...pointers.values()];
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
}

function midpoint(pointers: Map<number, { x: number; y: number }>): { x: number; y: number } {
  const [a, b] = [...pointers.values()];
  return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : { x: 0, y: 0 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function svgEl<K extends keyof SVGElementTagNameMap>(
  name: K,
  attributes: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}
