import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseFamily } from '../src/parser/parse';
import { unionId } from '../src/parser/types';

const sample = readFileSync(new URL('../data/family.md', import.meta.url), 'utf8');

describe('parseFamily', () => {
  it('reads the title from the first markdown heading', () => {
    expect(parseFamily(sample).title).toBe('Familie Bauer');
  });

  it('ignores prose outside the family block', () => {
    const graph = parseFamily('# T\n\nperson ghost "Ghost"\n\n```family\nperson real "Real"\n```\n');
    expect([...graph.people.keys()]).toEqual(['real']);
  });

  it('parses people with quoted names and attributes', () => {
    const graph = parseFamily(sample);
    expect(graph.people.get('heinrich')).toMatchObject({
      name: 'Heinrich Bauer',
      born: '1931-04-02',
      died: '2011-08-17',
      photo: 'heinrich.svg',
      note: 'Baute das Haus in Lindau.',
    });
    expect(graph.people.get('elisabeth')?.maiden).toBe('Vogt');
  });

  it('parses partnerships with children on one line', () => {
    const union = parseFamily(sample).unions.find((u) => u.id === unionId(['klaus', 'sabine']));
    expect(union).toMatchObject({ married: '1984-06-09', divorced: '1996', children: ['nina', 'jonas'] });
  });

  it('models remarriage as a second union', () => {
    const graph = parseFamily(sample);
    const klaus = graph.unions.filter((u) => u.partners.includes('klaus'));
    expect(klaus.map((u) => u.partners)).toEqual([
      ['klaus', 'sabine'],
      ['klaus', 'carmen'],
    ]);
  });

  it('merges statements about the same union, in either partner order', () => {
    const graph = parseFamily('```family\na + b married=1990\nb + a -> c\na + b -> d\n```');
    expect(graph.unions).toHaveLength(1);
    expect(graph.unions[0]).toMatchObject({ married: '1990', children: ['c', 'd'] });
  });

  it('supports a single parent and the children= attribute', () => {
    const graph = parseFamily('```family\nperson a "A"\na children=b, c\n```');
    expect(graph.unions[0]).toMatchObject({ partners: ['a'], children: ['b', 'c'] });
  });

  it('tolerates missing spaces around + and ->', () => {
    const graph = parseFamily('```family\na+b->c\n```');
    expect(graph.unions[0]).toMatchObject({ partners: ['a', 'b'], children: ['c'] });
  });

  it('creates stubs for undeclared people and warns', () => {
    const graph = parseFamily('```family\nperson a "A"\na + b -> c\n```');
    expect(graph.people.get('b')).toMatchObject({ name: 'b', stub: true });
    expect(graph.warnings.map((w) => w.message)).toContain('no "person" declaration for "b"');
  });

  it('warns about unknown attributes instead of throwing', () => {
    const graph = parseFamily('```family\nperson a "A" height=180\n```');
    expect(graph.warnings[0]?.message).toBe('unknown person attribute "height"');
  });

  it('has no warnings for the shipped sample data', () => {
    expect(parseFamily(sample).warnings).toEqual([]);
  });
});
