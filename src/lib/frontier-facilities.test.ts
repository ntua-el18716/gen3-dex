import { describe, expect, it } from "vitest";

import { FRONTIER_FACILITIES } from "@/db/schema";

import { FACILITIES, facilityInfo } from "./frontier-facilities";

describe("Frontier facilities", () => {
  it("describes every facility in the schema, in game order", () => {
    expect(FACILITIES.map((f) => f.key)).toEqual([...FRONTIER_FACILITIES]);
  });

  it("looks facilities up by key", () => {
    expect(facilityInfo("factory")?.kind).toBe("factory");
    expect(facilityInfo("nope")).toBeUndefined();
  });
});
