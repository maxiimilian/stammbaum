import type { Family } from './family';
import { unionStatus, type Person, type UnionStatus } from './parser/types';
import { shortName } from './ui/format';

/**
 * What `to` is to `from`, in German: "Tante", "Cousine 2. Grades", "Mann der
 * Cousine". Blood relations are named from the nearest common ancestor; in-laws
 * are one partnership away from a blood relative. Anyone further out is
 * `undefined`.
 */
export function relation(family: Family, from: string, to: string): string | undefined {
  const target = family.person(to);
  if (!target) return undefined;
  const kin = blood(family, from, to);
  if (kin) return say(bloodTerm(kin), target);
  return partnerOfRelative(family, from, target) ?? relativeOfPartner(family, from, target);
}

// ---- blood ----------------------------------------------------------------

/** Generations from `from` up to the common ancestor, and from there down to `to`. */
interface Blood {
  up: number;
  down: number;
  half: boolean;
}

function blood(family: Family, from: string, to: string): Blood | undefined {
  const theirs = ancestry(family, to);
  let best: Blood | undefined;
  for (const [id, up] of ancestry(family, from)) {
    const down = theirs.get(id);
    if (down === undefined || (best && best.up + best.down <= up + down)) continue;
    best = { up, down, half: false };
  }
  // Siblings from different partnerships share one parent, not both.
  if (best?.up === 1 && best.down === 1) {
    best.half = family.parentUnion(from) !== family.parentUnion(to);
  }
  return best;
}

/** Everyone above `id`, by how many generations up they are — `id` itself at 0. */
function ancestry(family: Family, id: string): Map<string, number> {
  const depth = new Map([[id, 0]]);
  // A Map iterator also visits entries added while it runs: breadth-first for free.
  for (const [current, generation] of depth) {
    for (const parent of family.parents(current)) {
      if (!depth.has(parent.id)) depth.set(parent.id, generation + 1);
    }
  }
  return depth;
}

function bloodTerm({ up, down, half }: Blood): Term {
  if (up === 0 && down === 0) return SELF;
  if (down === 0) return prefixed(PARENT, greatPrefix(up - 1));
  if (up === 0) return down === 1 ? CHILD : prefixed(GRANDCHILD, capitalize('ur'.repeat(down - 2)));
  if (up === 1 && down === 1) return half ? prefixed(SIBLING, 'Halb') : SIBLING;
  if (down === 1) return prefixed(UNCLE, greatPrefix(up - 2));
  if (up === 1) return prefixed(NEPHEW, greatPrefix(down - 2));
  const degree = Math.min(up, down) - 1;
  const removed = Math.abs(up - down);
  if (degree === 1 && removed === 0) return COUSIN;
  // A cousin's child and a parent's cousin — the colloquial word for both.
  if (degree === 1 && removed === 1) return prefixed(COUSIN, 'Groß');
  return suffixed(COUSIN, ` ${degree}. Grades${removed > 0 ? `, ${removed}× entfernt` : ''}`);
}

// ---- in-laws --------------------------------------------------------------

/** `to` is, or was, the partner of one of `from`'s blood relatives. */
function partnerOfRelative(family: Family, from: string, to: Person): string | undefined {
  const link = closest(family.partnerships(to.id), (partner) => blood(family, from, partner.id));
  if (!link) return undefined;
  const { kin, partner: relative, status } = link;
  if (kin.up === 0 && kin.down === 0) return say(status === 'married' ? SPOUSE : PARTNER[status], to);
  if (!ended(status)) {
    if (kin.up === 1 && kin.down === 0) return say(STEP_PARENT, to);
    if (kin.up === 0 && kin.down === 1) return say(CHILD_IN_LAW, to);
    if (kin.up === 1 && kin.down === 1) return say(SIBLING_IN_LAW, to);
    // The aunt's husband is an uncle too.
    if (kin.down === 1) return say(bloodTerm(kin), to);
  }
  return `${say(PARTNER[status], to)} ${of(bloodTerm(kin), relative)}`;
}

/** `to` is a blood relative of `from`'s partner, current or former. */
function relativeOfPartner(family: Family, from: string, to: Person): string | undefined {
  const link = closest(family.partnerships(from), (partner) => blood(family, partner.id, to.id));
  if (!link) return undefined;
  const { kin, partner, status } = link;
  const ex = ended(status) ? 'Ex-' : '';
  if (kin.up === 1 && kin.down === 0) return say(prefixed(PARENT_IN_LAW, ex), to);
  if (kin.up === 1 && kin.down === 1) return say(prefixed(SIBLING_IN_LAW, ex), to);
  if (kin.up === 0 && kin.down === 1 && !ex) return say(STEP_CHILD, to);
  return `${say(bloodTerm(kin), to)} ${of(PARTNER[status], partner)}`;
}

/** The partnership whose partner is the nearest blood relative. */
function closest(
  partnerships: ReturnType<Family['partnerships']>,
  kinOf: (partner: Person) => Blood | undefined,
): { kin: Blood; partner: Person; status: UnionStatus } | undefined {
  let best: { kin: Blood; partner: Person; status: UnionStatus } | undefined;
  for (const { union, partner } of partnerships) {
    const kin = partner && kinOf(partner);
    if (!partner || !kin || (best && best.kin.up + best.kin.down <= kin.up + kin.down)) continue;
    best = { kin, partner, status: unionStatus(union) };
  }
  return best;
}

function ended(status: UnionStatus): boolean {
  return status === 'divorced' || status === 'separated';
}

// ---- words ----------------------------------------------------------------

/** One word for a man and for a woman, plus a neutral one where German has it. */
interface Term {
  m: string;
  f: string;
  x?: string;
}

const SELF: Term = { m: 'Ich', f: 'Ich', x: 'Ich' };
const PARENT: Term = { m: 'Vater', f: 'Mutter', x: 'Elternteil' };
const CHILD: Term = { m: 'Sohn', f: 'Tochter', x: 'Kind' };
const GRANDCHILD: Term = { m: 'Enkel', f: 'Enkelin', x: 'Enkelkind' };
const SIBLING: Term = { m: 'Bruder', f: 'Schwester', x: 'Geschwister' };
const UNCLE: Term = { m: 'Onkel', f: 'Tante' };
const NEPHEW: Term = { m: 'Neffe', f: 'Nichte' };
const COUSIN: Term = { m: 'Cousin', f: 'Cousine', x: 'Cousin(e)' };
const SPOUSE: Term = { m: 'Ehemann', f: 'Ehefrau', x: 'Ehepartner(in)' };
const STEP_PARENT: Term = { m: 'Stiefvater', f: 'Stiefmutter', x: 'Stiefelternteil' };
const STEP_CHILD: Term = { m: 'Stiefsohn', f: 'Stieftochter', x: 'Stiefkind' };
const PARENT_IN_LAW: Term = { m: 'Schwiegervater', f: 'Schwiegermutter', x: 'Schwiegerelternteil' };
const CHILD_IN_LAW: Term = { m: 'Schwiegersohn', f: 'Schwiegertochter', x: 'Schwiegerkind' };
const SIBLING_IN_LAW: Term = { m: 'Schwager', f: 'Schwägerin' };

const PARTNER: Record<UnionStatus, Term> = {
  married: { m: 'Mann', f: 'Frau', x: 'Ehepartner(in)' },
  together: { m: 'Partner', f: 'Partnerin', x: 'Partner(in)' },
  divorced: { m: 'Ex-Mann', f: 'Ex-Frau', x: 'Ex-Partner(in)' },
  separated: { m: 'Ex-Partner', f: 'Ex-Partnerin', x: 'Ex-Partner(in)' },
};

function say(term: Term, person: Person): string {
  if (person.sex) return term[person.sex];
  // The break opportunity keeps "Großonkel/Großtante" inside a narrow tile.
  return term.x ?? `${term.m}/​${term.f}`;
}

/** "der Cousine", "des Onkels" — or "von Quin" when the file does not say which. */
function of(term: Term, person: Person): string {
  if (person.sex === 'f') return `der ${term.f}`;
  if (person.sex === 'm') return `des ${genitive(term.m)}`;
  return `von ${shortName(person)}`;
}

/** Inflects the first word: Onkel → Onkels, Neffe → Neffen, Mann → Mannes. */
function genitive(phrase: string): string {
  const [head = '', ...rest] = phrase.split(' ');
  const inflected = head.endsWith('e') ? `${head}n` : /mann$/i.test(head) ? `${head}es` : `${head}s`;
  return [inflected, ...rest].join(' ');
}

/** Groß, Urgroß, Ururgroß — one step per generation. */
function greatPrefix(steps: number): string {
  return steps === 0 ? '' : capitalize(`${'ur'.repeat(steps - 1)}groß`);
}

function prefixed(term: Term, prefix: string): Term {
  if (prefix === '') return term;
  // "Ex-Schwager" keeps its capital; "Großonkel" does not.
  const join = (word: string) => prefix + (prefix.endsWith('-') ? word : word.charAt(0).toLowerCase() + word.slice(1));
  return map(term, join);
}

function suffixed(term: Term, suffix: string): Term {
  return map(term, (word) => word + suffix);
}

function map(term: Term, change: (word: string) => string): Term {
  const changed: Term = { m: change(term.m), f: change(term.f) };
  if (term.x !== undefined) changed.x = change(term.x);
  return changed;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
