import { describe, expect, it } from "vitest";
import { readAll, readByIds } from "./read-all";

describe("complete paginated reads", () => {
  it("loads more than 1000 rows even when the server caps pages at 137", async () => {
    const rows = Array.from({ length: 1234 }, (_, id) => ({ id }));
    const result = await readAll(async (from, to) => ({ data: rows.slice(from, Math.min(to + 1, from + 137)), error: null }));
    expect(result.data).toEqual(rows);
  });
  it("batches long parent ID lists, removes duplicates, and loads every child's page", async () => {
    const ids = Array.from({ length: 205 }, (_, id) => String(id));
    const result = await readByIds([...ids, "1"], async (chunk, from, to) => {
      expect(chunk.length).toBeLessThanOrEqual(100);
      const rows = chunk.flatMap(id => Array.from({ length: 12 }, (_, n) => `${id}:${n}`));
      return { data: rows.slice(from, to + 1), error: null };
    });
    expect(result.data).toHaveLength(2460);
    expect(new Set(result.data).size).toBe(2460);
  });
  it("rejects partial results on a later page error", async () => {
    await expect(readAll(async from => from === 0 ? { data: [1], error: null } : { data: null, error: { message: "offline" } }))
      .rejects.toMatchObject({ message: "offline" });
  });
});
