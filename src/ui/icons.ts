const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Small stroked icons in the Material Symbols spirit, drawn inline so the
 * offline build stays a single file with no font to load.
 */
const PATHS = {
  back: ['M20 12H4', 'M10 6l-6 6 6 6'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M16.2 16.2 21 21'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  fit: ['M4 9V5a1 1 0 0 1 1-1h4', 'M20 9V5a1 1 0 0 0-1-1h-4', 'M4 15v4a1 1 0 0 0 1 1h4', 'M20 15v4a1 1 0 0 1-1 1h-4'],
  theme: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 3v18a9 9 0 0 0 0-18z'],
  person: ['M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4.5 21a7.5 7.5 0 0 1 15 0'],
} as const;

export type IconName = keyof typeof PATHS;

export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', `icon icon-${name}`);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of PATHS[name]) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    // The second half of the theme glyph is the filled side of the contrast disc.
    if (name === 'theme' && d.startsWith('M12 3v18')) path.setAttribute('class', 'icon-solid');
    svg.append(path);
  }
  return svg;
}

/** A Material-style icon button with an accessible label. */
export function iconButton(name: IconName, label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-button';
  button.title = label;
  button.setAttribute('aria-label', label);
  button.append(icon(name));
  return button;
}
