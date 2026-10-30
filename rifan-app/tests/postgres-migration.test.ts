import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createTestApi } from "./database";
import { openDatabase } from "../server/database";
import { migrateSqliteToPostgres } from "../server/db/migrate";
import { ensureBootstrapAdmin } from "../server/bootstrap";
test(
  "SQLite migration preserves identities, credentials, binary files, history and exact original source data",
  { skip: !process.env.RIFAN_TEST_POSTGRES_URL },
  async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "rifan-migration-"));
    const file = path.join(directory, "source.sqlite");
    const source = await openDatabase(file);
    const target = await createTestApi({ filename: ":memory:", demo: false });
    try {
      await source.put("workspace", "farmers", {
        id: "unchanged-farmer-id",
        firstName: "AMINA",
        lastName: "BELLO",
        primaryPhone: "08012345678",
        country: "Nigeria",
        state: "Kebbi",
        lga: "Birnin Kebbi",
        gender: "Female",
        bvn: "01234567890",
        farmSize: 2,
      });
      await ensureBootstrapAdmin(source, {
        BOOTSTRAP_ADMIN_PASSWORD: "fixture-bootstrap-password-123",
      });
      const raw = '{"Name": "Original  source", "Phone": "8.12345E+09"}';
      await source.db
        .prepare(
          "INSERT INTO source_records(batch_id,space,source_row,raw,status,reason) VALUES(?,?,?,?,?,?)",
        )
        .run(
          "source-batch",
          "workspace",
          4,
          raw,
          "Invalid",
          "Original diagnostic",
        );
      await source.db
        .prepare(
          "INSERT INTO files(id,space,farmer_id,name,mime,data,created) VALUES(?,?,?,?,?,?,?)",
        )
        .run(
          "file-id",
          "workspace",
          "unchanged-farmer-id",
          "fixture.bin",
          "application/octet-stream",
          Buffer.from([0, 255, 0, 65]),
          new Date().toISOString(),
        );
      assert.ok(target.databaseUrl);
      const plan = await migrateSqliteToPostgres(file, target.databaseUrl, {
        dryRun: true,
      });
      assert.equal(plan.counts.records, 1);
      assert.equal((await target.store.all("workspace", "farmers")).length, 0);
      const migrated = await migrateSqliteToPostgres(file, target.databaseUrl);
      assert.equal(migrated.verified, true);
      assert.equal(
        (await target.store.get("workspace", "farmers", "unchanged-farmer-id"))
          ?.bvn,
        "01234567890",
      );
      assert.equal(
        (await target.store.db.prepare("SELECT raw FROM source_records").get())
          .raw,
        raw,
      );
      const before = await source.db
          .prepare("SELECT hash,salt FROM users")
          .get(),
        after = await target.store.db
          .prepare("SELECT hash,salt FROM users")
          .get();
      assert.ok(after.hash === before.hash && after.salt === before.salt);
      assert.deepEqual(
        Buffer.from(
          (await target.store.db.prepare("SELECT data FROM files").get()).data,
        ),
        Buffer.from([0, 255, 0, 65]),
      );
      const repeated = await migrateSqliteToPostgres(file, target.databaseUrl);
      assert.equal(repeated.alreadyMigrated, true);
      await source.put("workspace", "farmers", {
        id: "different",
        firstName: "CHANGED",
      });
      await assert.rejects(
        migrateSqliteToPostgres(file, target.databaseUrl),
        /different source/,
      );
      assert.equal((await target.store.all("workspace", "farmers")).length, 1);
    } finally {
      await source.db.close();
      await target.store.db.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test("an empty or unrelated SQLite file is rejected before connecting to a migration target", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "rifan-empty-source-"),
  );
  try {
    const file = path.join(directory, "empty.sqlite");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(file, "");
    await assert.rejects(
      migrateSqliteToPostgres(
        file,
        "postgresql://fixture:fixture@127.0.0.1:1/unused?sslmode=disable",
      ),
      /not a RIFAN|not a database/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
