import { describe, expect, it } from "vitest";
import {
  isDateOnly,
  isEmail,
  isSouthAfricanLocalDateTime,
  isUuid,
  readFormText,
} from "../src/lib/form-data";

describe("server action form-data helpers", () => {
  it("reads only text form entries and trims whitespace", () => {
    const form = new FormData();
    form.set("name", "  Example  ");
    form.set("upload", new File(["secret"], "secret.txt"));
    expect(readFormText(form, "name")).toBe("Example");
    expect(readFormText(form, "upload")).toBe("");
    expect(readFormText(form, "missing")).toBe("");
  });

  it("accepts canonical UUIDs and rejects malformed identifiers", () => {
    expect(isUuid("9f9e3f5d-2f0e-4c65-9a40-6a3f9a1d0001")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("")).toBe(false);
  });

  it("validates email addresses with a bounded length", () => {
    expect(isEmail("user@example.co.za")).toBe(true);
    expect(isEmail("user@example")).toBe(false);
    expect(isEmail("user @example.co.za")).toBe(false);
    expect(isEmail(`${"a".repeat(250)}@example.co.za`)).toBe(false);
  });

  it("rejects impossible calendar dates", () => {
    expect(isDateOnly("2026-11-27")).toBe(true);
    expect(isDateOnly("2026-02-29")).toBe(false);
    expect(isDateOnly("2024-02-29")).toBe(true);
  });

  it("validates South African local consultation date/time input", () => {
    expect(isSouthAfricanLocalDateTime("2026-11-27T14:30")).toBe(true);
    expect(isSouthAfricanLocalDateTime("2026-02-30T14:30")).toBe(false);
    expect(isSouthAfricanLocalDateTime("2026-11-27T25:30")).toBe(false);
    expect(isSouthAfricanLocalDateTime("2026-11-27 14:30")).toBe(false);
  });
});
