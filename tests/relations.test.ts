import { describe, expect, it } from "vitest";
import { firstRelated } from "../src/lib/types/relations";

describe("firstRelated", () => {
  it("returns a single embedded record", () => {
    expect(firstRelated({ name: "Gauteng" })).toEqual({ name: "Gauteng" });
  });

  it("returns the first record from an embedded array", () => {
    expect(firstRelated([{ name: "Gauteng" }, { name: "Mpumalanga" }])).toEqual({
      name: "Gauteng",
    });
  });

  it("returns null for an empty array or null relation", () => {
    expect(firstRelated([] as { name: string }[])).toBeNull();
    expect(firstRelated(null)).toBeNull();
  });
});
