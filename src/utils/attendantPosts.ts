import type { ShiftAttendantPost } from '@/types/entities';

export function parseAttendantPosts(raw: unknown): ShiftAttendantPost[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: ShiftAttendantPost[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const rec = row as { name?: unknown; machineNumber?: unknown };
    const name = typeof rec.name === 'string' ? rec.name.trim().replace(/\s+/g, ' ') : '';
    const machineNumber =
      typeof rec.machineNumber === 'string' ? rec.machineNumber.trim().replace(/^M/i, '') : '';
    if (!name || !machineNumber) {
      continue;
    }
    out.push({ name, machineNumber });
  }
  return out;
}

export function machineTag(machineNumber: string): string {
  const n = machineNumber.trim().replace(/^M/i, '');
  return n ? `M${n}` : '—';
}

export function formatAttendantPostLabel(post: ShiftAttendantPost): string {
  return `${machineTag(post.machineNumber)} · ${post.name}`;
}

export function attendantPostChipLabels(posts: ShiftAttendantPost[]): string[] {
  return [...posts]
    .sort((a, b) => {
      const byMachine = a.machineNumber.localeCompare(b.machineNumber, undefined, { numeric: true });
      if (byMachine !== 0) {
        return byMachine;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    })
    .map(formatAttendantPostLabel);
}

export function formatAttendantPostsLine(posts: ShiftAttendantPost[]): string {
  return attendantPostChipLabels(posts).join(', ');
}

export function groupAttendantPostsByMachine(
  posts: ShiftAttendantPost[],
): { machineNumber: string; names: string[] }[] {
  const map = new Map<string, string[]>();
  for (const p of posts) {
    const m = p.machineNumber.trim().replace(/^M/i, '');
    const name = p.name.trim();
    if (!m || !name) {
      continue;
    }
    const list = map.get(m) ?? [];
    if (!list.some((n) => n.toLowerCase() === name.toLowerCase())) {
      list.push(name);
    }
    map.set(m, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([machineNumber, names]) => ({
      machineNumber,
      names: names.sort((x, y) => x.localeCompare(y, undefined, { sensitivity: 'base' })),
    }));
}

/** Pair names to machines from a combined label such as "M1, M2". */
export function postsFromNamesAndMachineLabel(
  names: string[],
  machineLabel: string,
): ShiftAttendantPost[] {
  const machines = machineLabel
    .split(/[,;]+/)
    .map((x) => x.trim().replace(/^M/i, ''))
    .filter(Boolean);
  return pairAttendantsToMachines(names, machines);
}

/** Pair ticked people to selected machines (one person per machine when counts match). */
export function pairAttendantsToMachines(names: string[], machineNumbers: string[]): ShiftAttendantPost[] {
  const people = names.map((n) => n.trim().replace(/\s+/g, ' ')).filter(Boolean);
  const machines = machineNumbers.map((m) => m.trim().replace(/^M/i, '')).filter(Boolean);
  if (people.length === 0 || machines.length === 0) {
    return [];
  }
  if (machines.length === 1) {
    return people.map((name) => ({ name, machineNumber: machines[0] }));
  }
  if (people.length === 1) {
    return machines.map((machineNumber) => ({ name: people[0], machineNumber }));
  }
  const posts: ShiftAttendantPost[] = [];
  const paired = Math.min(people.length, machines.length);
  for (let i = 0; i < paired; i += 1) {
    posts.push({ name: people[i], machineNumber: machines[i] });
  }
  for (let i = paired; i < people.length; i += 1) {
    posts.push({ name: people[i], machineNumber: machines[machines.length - 1] });
  }
  for (let i = paired; i < machines.length; i += 1) {
    posts.push({ name: people[people.length - 1], machineNumber: machines[i] });
  }
  return posts;
}

export function uniqueMachineNumbersFromNozzles(
  selectedNozzleIds: Iterable<string>,
  nozzles: { id: string; machineNumber: string }[],
): string[] {
  const nums = new Set<string>();
  for (const id of selectedNozzleIds) {
    const nozzle = nozzles.find((n) => n.id === id);
    const m = nozzle?.machineNumber.trim().replace(/^M/i, '');
    if (m) {
      nums.add(m);
    }
  }
  return [...nums].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
