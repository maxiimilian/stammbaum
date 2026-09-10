import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseFamily } from '../src/parser/parse';
import { layoutFamily, METRICS } from '../src/layout/layout';

const sample = readFileSync(new URL('../data/family.md', import.meta.url), 'utf8');
const graph = parseFamily(sample);
const layout = layoutFamily(graph);

describe('layoutFamily', () => {
  it('places every person exactly once', () => {
    expect(layout.nodes.size).toBe(graph.people.size);
  });

  it('puts children strictly below both of their parents', () => {
    for (const union of layout.unions) {
      const parentY = Math.max(...union.partners.map((p) => layout.nodes.get(p)!.y));
      for (const child of union.children) {
        expect(layout.nodes.get(child)!.y).toBeGreaterThan(parentY);
      }
    }
  });

  it('keeps partners on the same row', () => {
    for (const union of layout.unions) {
      const rows = new Set(union.partners.map((p) => layout.nodes.get(p)!.generation));
      expect(rows.size).toBe(1);
    }
  });

  it('never overlaps two bubbles on the same row', () => {
    const rows = new Map<number, number[]>();
    for (const node of layout.nodes.values()) {
      rows.set(node.generation, [...(rows.get(node.generation) ?? []), node.x]);
    }
    for (const xs of rows.values()) {
      const sorted = [...xs].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThanOrEqual(METRICS.nodeWidth);
      }
    }
  });

  it('reports bounds that contain every bubble', () => {
    for (const node of layout.nodes.values()) {
      expect(node.x).toBeGreaterThan(0);
      expect(node.x).toBeLessThan(layout.width);
      expect(node.y).toBeLessThan(layout.height);
    }
  });

  it('is deterministic', () => {
    const again = layoutFamily(parseFamily(sample));
    for (const [id, node] of layout.nodes) expect(again.nodes.get(id)!.x).toBe(node.x);
  });
});
