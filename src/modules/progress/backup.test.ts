import { describe, expect, it } from "vitest";

import { backupOf, deviceBackup, linkedTo, newProfile, restoreBackup } from "./local";

const day = new Date(2026, 9, 16);
const rec = (best: number, stars: number) => ({
  bestScore: best,
  latestScore: best,
  cumulativeScore: best,
  stars,
  completedCount: 1,
});

describe("device backup", () => {
  const a = {
    ...newProfile("a", "A", { kind: "letter", value: "x" }, "color.blue", day),
    records: { "41": rec(10, 1) },
  };
  const b = newProfile("b", "B", { kind: "letter", value: "y" }, "color.red", day);

  it("round-trips through JSON and validates", () => {
    const file = JSON.parse(JSON.stringify(backupOf({ v: 1, activeId: "a", profiles: [a, b] }, day)));
    expect(deviceBackup.safeParse(file).success).toBe(true);
    expect(deviceBackup.safeParse({ ...file, kind: "other" }).success).toBe(false);
  });

  it("adds new profiles and keeps the better record of one already here", () => {
    const here = linkedTo({ ...a, records: { "41": rec(6, 3) } }, "s1", day);
    const backup = backupOf({ v: 1, activeId: "a", profiles: [a, b] }, day);
    const r = restoreBackup({ v: 1, activeId: "a", profiles: [here] }, backup);
    expect(r).toMatchObject({ added: 1, merged: 1 });
    expect(r.state.profiles.map((p) => p.id)).toEqual(["a", "b"]);
    expect(r.state.profiles[0].records["41"]).toMatchObject({ bestScore: 10, stars: 3 });
    // The device's own account link stays; a restored profile starts unlinked.
    expect(r.state.profiles[0].link?.studentId).toBe("s1");
    expect(r.state.profiles[1].link).toBeUndefined();
  });
});
