import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";

describe("PostgreSQL migrations, transactions and RLS", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = new PGlite();
    // Minimal Supabase auth contract; application tables/functions/policies are
    // installed from the real migrations, with no replacement save logic.
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to anon, authenticated;
    `);
    for (const file of readdirSync("supabase/migrations").filter(f => f.endsWith(".sql")).sort()) {
      // gen_random_uuid is built into PostgreSQL; PGlite needs no pgcrypto extension.
      const sql = readFileSync(`supabase/migrations/${file}`, "utf8")
        .replace("create extension if not exists pgcrypto;", "");
      await db.exec(sql);
    }
  }, 30000);
  afterAll(async () => { await db?.close(); });
  it("preserves old sets and parents on failure, rejects cross-user writes and saves all fields", async () => {
    await db.exec(readFileSync("supabase/verification/workout_save.sql", "utf8"));
  });
  it("keeps goal review rollover atomic and isolated", async () => {
    await db.exec(readFileSync("supabase/verification/goal_reviews.sql", "utf8"));
  });
});
