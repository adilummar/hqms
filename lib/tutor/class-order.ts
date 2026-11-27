// Class pickers on tutor pages list every class of a track, but a class teacher mainly works with
// their own class: it goes first (and becomes the default selection); other classes stay available.

export type OwnableClass = { id: string; name: string; tutorId: string | null };

/** The caller's own classes first, the rest after, each group sorted by name. */
export function ownClassesFirst<T extends OwnableClass>(list: T[], userId: string | null | undefined): T[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, undefined, { numeric: true });
  const mine = list.filter((c) => !!userId && c.tutorId === userId).sort(byName);
  const others = list.filter((c) => !userId || c.tutorId !== userId).sort(byName);
  return [...mine, ...others];
}

export function classLabel(c: OwnableClass, userId: string | null | undefined): string {
  return userId && c.tutorId === userId ? `${c.name} (My class)` : c.name;
}
