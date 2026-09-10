/** A single human being in the tree. */
export interface Person {
  id: string;
  name: string;
  /** Free-form, but ISO-ish (`1956`, `1956-04`, `1956-04-02`) renders best. */
  born?: string;
  died?: string;
  /** File name inside `data/photos/`, e.g. `heinrich.jpg`. */
  photo?: string;
  /** Maiden name, shown in the detail view as "geb. Vogt". */
  maiden?: string;
  /** Nickname — what the family actually calls them. */
  nick?: string;
  note?: string;
  /** True when the person was only referenced by a relation, never declared. */
  stub?: boolean;
}

/** A partnership. Divorce and remarriage are modelled as separate unions. */
export interface Union {
  id: string;
  /** One or two people. A single partner means "other parent unknown". */
  partners: string[];
  married?: string;
  divorced?: string;
  children: string[];
}

export interface Diagnostic {
  line: number;
  message: string;
  text: string;
}

export interface FamilyGraph {
  title: string;
  people: Map<string, Person>;
  unions: Union[];
  warnings: Diagnostic[];
}

/** Stable id for a partnership, independent of the order partners were written. */
export function unionId(partners: string[]): string {
  return [...partners].sort().join('+');
}
