type Page<T> = { data: T[] | null; error: { message: string; code?: string } | null };

// Every caller supplies a deterministic order ending in the unique primary key.
// Continue until empty, even when the server caps a page below our requested size.
export async function readAll<T>(query: (from: number, to: number) => PromiseLike<Page<T>>): Promise<{ data: T[]; error: null }> {
  const data: T[] = [];
  for (;;) {
    const page = await query(data.length, data.length + 499);
    if (page.error) throw page.error;
    if (!page.data?.length) return { data, error: null };
    data.push(...page.data);
  }
}

// Bound URL length as well as response size for parent/child queries.
export async function readByIds<T>(ids: string[], query: (ids: string[], from: number, to: number) => PromiseLike<Page<T>>) {
  const data: T[] = [];
  const uniqueIds = [...new Set(ids)];
  for (let i = 0; i < uniqueIds.length; i += 100) {
    const chunk = uniqueIds.slice(i, i + 100);
    data.push(...(await readAll((from, to) => query(chunk, from, to))).data);
  }
  return { data, error: null };
}
