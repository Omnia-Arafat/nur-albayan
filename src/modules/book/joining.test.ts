import { describe, expect, it } from "vitest";

import { joinRuns } from "./joining";

const ZWJ = "‍";

describe("joinRuns", () => {
  it("joins a coloured run to the letter before it when they connect", () => {
    expect(joinRuns(["حَ", "لۡ"])).toEqual([`حَ${ZWJ}`, `${ZWJ}لۡ`]);
  });

  it("leaves a boundary after a letter that never joins forward", () => {
    expect(joinRuns(["رَ", "نۡ"])).toEqual(["رَ", "نۡ"]);
    expect(joinRuns(["ٱ", "لۡقَمَرُ"])).toEqual(["ٱ", "لۡقَمَرُ"]);
  });

  it("leaves word boundaries alone", () => {
    expect(joinRuns(["مِن ", "رَّحِيمٍ"])).toEqual(["مِن ", "رَّحِيمٍ"]);
  });

  it("looks past marks to the letters on each side", () => {
    expect(joinRuns(["يَ", "بۡ", "حَثُ"])).toEqual([
      `يَ${ZWJ}`,
      `${ZWJ}بۡ${ZWJ}`,
      `${ZWJ}حَثُ`,
    ]);
  });
});
