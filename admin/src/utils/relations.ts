/** The parts of a collection this file needs (CollectionInfo from api/collections fits). */
type RelationSource = {
  uid: string;
  displayName: string;
  relations: { target: string; required: boolean }[];
};

export type RelationLabel = {
  label: string;
  required: boolean;
  /** False when the admin may not read the related collection. */
  accessible: boolean;
};

/**
 * The collections an entry of `collection` points to, once each:
 * Order → Customer, Product. Types that are not shown in the Content Manager are left out.
 */
export function describeRelations(
  collection: RelationSource,
  all: RelationSource[],
  canRead: (uid: string) => boolean = () => true
): RelationLabel[] {
  const byUid = new Map(all.map((c) => [c.uid, c]));
  const seen = new Map<string, RelationLabel>();
  for (const rel of collection.relations) {
    const target = byUid.get(rel.target);
    // Targets that are not shown in the Content Manager (e.g. a plugin's role type) cannot be picked on the create screen.
    if (!target) continue;
    const label = target.displayName;
    const existing = seen.get(rel.target);
    if (existing) {
      existing.required = existing.required || rel.required;
    } else {
      seen.set(rel.target, { label, required: rel.required, accessible: canRead(rel.target) });
    }
  }
  return [...seen.values()];
}

export function formatRelations(relations: RelationLabel[]): string {
  if (relations.length === 0) return 'No relations';
  const parts = relations.map((r) => {
    const notes = [r.required ? 'required' : '', r.accessible ? '' : 'no access'].filter(Boolean);
    return notes.length ? `${r.label} (${notes.join(', ')})` : r.label;
  });
  return `→ ${parts.join(', ')}`;
}
