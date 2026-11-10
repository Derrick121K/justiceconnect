import { describe, expect, it } from "vitest";
import { legalEnquirySchema, practitionerProfileSchema } from "../src/lib/validation";

const validMatter = {
  title: "Unfair dismissal after disciplinary hearing",
  description: "I was dismissed after a disciplinary hearing and need advice about the process and my options.",
  provinceId: 6,
  practiceAreaIds: ["9f9e3f5d-2f0e-4c65-9a40-6a3f9a1d0001"],
  consultationMode: "either",
  urgency: "normal",
  consentToMatching: true,
};

describe("legalEnquirySchema", () => {
  it("accepts a complete enquiry with explicit matching consent", () => expect(legalEnquirySchema.safeParse(validMatter).success).toBe(true));
  it("rejects missing consent", () => expect(legalEnquirySchema.safeParse({ ...validMatter, consentToMatching: false }).success).toBe(false));
  it("rejects invalid province identifiers", () => expect(legalEnquirySchema.safeParse({ ...validMatter, provinceId: 99 }).success).toBe(false));
});

describe("practitionerProfileSchema", () => {
  it("accepts valid province coverage and practice areas", () => expect(practitionerProfileSchema.safeParse({
    displayName: "Example Practitioner", practitionerType: "attorney", practiceAreaIds: validMatter.practiceAreaIds,
    provinceIds: [6, 3], acceptsRemoteMatters: true,
  }).success).toBe(true));
  it("rejects profiles without practice areas", () => expect(practitionerProfileSchema.safeParse({
    displayName: "Example Practitioner", practitionerType: "attorney", practiceAreaIds: [], provinceIds: [6], acceptsRemoteMatters: false,
  }).success).toBe(false));
});
