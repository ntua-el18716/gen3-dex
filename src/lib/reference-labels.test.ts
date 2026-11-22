import { describe, expect, it } from "vitest";

import { priceText, priorityLabel, targetLabel } from "./reference-labels";

describe("reference labels", () => {
  it("names targets and priority", () => {
    expect(targetLabel("MOVE_TARGET_BOTH")).toBe("Both foes");
    expect(targetLabel("MOVE_TARGET_NEW")).toBeNull();
    expect(priorityLabel(0)).toBeNull();
    expect(priorityLabel(1)).toBe("Priority +1");
    expect(priorityLabel(-6)).toBe("Priority −6");
  });

  it("gives buy and sell prices", () => {
    expect(priceText(3000)).toBe("Buy ₽3,000 · Sells for ₽1,500");
    expect(priceText(0)).toBe("Not sold in shops");
  });
});
