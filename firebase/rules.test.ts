/**
 * Firestore security-rules tests — run against the local emulator:
 *
 *   pnpm test:rules        (wraps: firebase emulators:exec --only firestore
 *                           "node --import tsx --test firebase/rules.test.ts")
 *
 * Requires Java 21+ on PATH (firebase-tools 15 emulator requirement).
 * Same node:test + tsx runner as functions/src/*.test.ts — NOT jest.
 *
 * Pins the users/{uid}.blobAvatar contract: owner-writable, but bounded to
 * known keys / string types / capped sizes so the world-readable user doc
 * can't be bloated or abused. shapeSeed (`uid:nonce`, ≤64 chars) is the Blob
 * Maker's procedural shape identifier and must round-trip Firestore intact.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

const VALID_CONFIG = {
  colorPreset: "ocean",
  shapePreset: "unique",
  eyesPreset: "classic",
};

let env: RulesTestEnvironment;

before(async () => {
  const [host, port] = (
    process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080"
  ).split(":");
  env = await initializeTestEnvironment({
    projectId: "niyah-rules-test",
    firestore: {
      rules: readFileSync(join(__dirname, "firestore.rules"), "utf8"),
      host,
      port: Number(port),
    },
  });
});

after(async () => {
  await env.cleanup();
});

/** Admin-side seed (bypasses rules) so update tests hit the update branch. */
const seedUser = (uid: string, data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc(`users/${uid}`).set(data);
  });

const asOwner = (uid: string) =>
  env.authenticatedContext(uid).firestore().doc(`users/${uid}`);

describe("users.blobAvatar — owner update", () => {
  it("accepts a full preset config (the shape every client write uses)", async () => {
    await seedUser("u1", { name: "A" });
    await assertSucceeds(
      asOwner("u1").set({ blobAvatar: VALID_CONFIG }, { merge: true }),
    );
  });

  it("accepts a config with a rolled shapeSeed (uid:nonce round-trip)", async () => {
    await seedUser("u2", { name: "A", blobAvatar: VALID_CONFIG });
    await assertSucceeds(
      asOwner("u2").set(
        { blobAvatar: { ...VALID_CONFIG, shapeSeed: "u2:a1b2c3d4e5f60718" } },
        { merge: true },
      ),
    );
  });

  it("rejects unknown keys (no junk-field bloat in the world-readable doc)", async () => {
    await seedUser("u3", { name: "A" });
    await assertFails(
      asOwner("u3").set(
        { blobAvatar: { ...VALID_CONFIG, evil: "x" } },
        { merge: true },
      ),
    );
  });

  it("rejects a non-map blobAvatar", async () => {
    await seedUser("u4", { name: "A" });
    await assertFails(
      asOwner("u4").set({ blobAvatar: "peach" }, { merge: true }),
    );
  });

  it("rejects an oversized shapeSeed (>64 chars)", async () => {
    await seedUser("u5", { name: "A" });
    await assertFails(
      asOwner("u5").set(
        { blobAvatar: { ...VALID_CONFIG, shapeSeed: "x".repeat(65) } },
        { merge: true },
      ),
    );
  });

  it("rejects non-string values (preset and seed)", async () => {
    await seedUser("u6", { name: "A" });
    await assertFails(
      asOwner("u6").set(
        { blobAvatar: { ...VALID_CONFIG, colorPreset: 42 } },
        { merge: true },
      ),
    );
    await assertFails(
      asOwner("u6").set(
        { blobAvatar: { ...VALID_CONFIG, shapeSeed: { nested: true } } },
        { merge: true },
      ),
    );
  });

  it("validates the post-merge map (a partial merge can't sneak junk in)", async () => {
    await seedUser("u7", { name: "A", blobAvatar: VALID_CONFIG });
    await assertFails(
      asOwner("u7").set({ blobAvatar: { evil: "x" } }, { merge: true }),
    );
  });
});

describe("users.blobAvatar — legacy escape hatch", () => {
  it("a pre-rule malformed doc can still write unrelated fields", async () => {
    await seedUser("legacy", { name: "A", blobAvatar: { junkKey: "old" } });
    await assertSucceeds(
      asOwner("legacy").set({ stats: { sessions: 1 } }, { merge: true }),
    );
  });

  it("…but touching blobAvatar forces it valid (repair allowed, junk not)", async () => {
    await seedUser("legacy2", { name: "A", blobAvatar: { junkKey: "old" } });
    await assertFails(
      asOwner("legacy2").set(
        { blobAvatar: { junkKey: "still-bad" } },
        { merge: true },
      ),
    );
    // Full overwrite (no merge inside the map) repairs the doc.
    await assertSucceeds(
      asOwner("legacy2").set({ blobAvatar: VALID_CONFIG }, { merge: false }),
    );
  });
});

describe("users.blobAvatar — create + adjacent rules intact", () => {
  it("profile creation with a valid blobAvatar (+seed) succeeds", async () => {
    await assertSucceeds(
      asOwner("new1").set({
        name: "New User",
        blobAvatar: { ...VALID_CONFIG, shapeSeed: "new1:a1b2c3d4e5f60718" },
      }),
    );
  });

  it("profile creation with a junk blobAvatar fails", async () => {
    await assertFails(
      asOwner("new2").set({
        name: "New User",
        blobAvatar: { ...VALID_CONFIG, evil: "x" },
      }),
    );
  });

  it("non-owners cannot write someone else's blobAvatar", async () => {
    await seedUser("victim", { name: "V", blobAvatar: VALID_CONFIG });
    await assertFails(
      env
        .authenticatedContext("attacker")
        .firestore()
        .doc("users/victim")
        .set({ blobAvatar: VALID_CONFIG }, { merge: true }),
    );
  });

  it("server-only denylist still holds next to the new clause", async () => {
    await seedUser("u8", { name: "A" });
    await assertFails(
      asOwner("u8").set(
        { reputation: { score: 100, level: "forest" } },
        { merge: true },
      ),
    );
  });
});
