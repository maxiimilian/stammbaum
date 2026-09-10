import familyMarkdown from '../data/family.md?raw';
import { parseFamily } from './parser/parse';
import type { FamilyGraph, Person } from './parser/types';

// Bundled at build time so the offline single-file build needs no network.
const photos = import.meta.glob('../data/photos/*.{jpg,jpeg,png,webp,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const byFileName = new Map(
  Object.entries(photos).map(([path, url]) => [path.split('/').pop()!, url]),
);

export function loadFamily(): FamilyGraph {
  return parseFamily(familyMarkdown);
}

export function photoUrl(person: Person): string | undefined {
  return person.photo ? byFileName.get(person.photo) : undefined;
}
