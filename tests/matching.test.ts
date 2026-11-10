import { describe, expect, it } from "vitest";
import { eligiblePractitioners, type MatchingCandidate } from "../src/lib/matching";

const candidate = (overrides: Partial<MatchingCandidate> = {}): MatchingCandidate => ({
  practitionerId: "p1", practiceAreaIds: ["labour"], serviceProvinceIds: [6],
  serviceMunicipalityIds: ["emalahleni"], acceptsRemoteMatters: false,
  verificationStatus: "verified", isActive: true, ...overrides,
});
const request = { practiceAreaIds: ["labour"], provinceId: 6, municipalityId: "emalahleni", consultationMode: "in_person" as const };

describe("eligiblePractitioners", () => {
  it("includes verified active local practitioners with matching expertise", () => expect(eligiblePractitioners([candidate()], request)).toHaveLength(1));
  it("excludes unverified and inactive practitioners", () => expect(eligiblePractitioners([candidate({ verificationStatus: "pending" }), candidate({ practitionerId: "p2", isActive: false })], request)).toHaveLength(0));
  it("excludes practitioners without matching expertise", () => expect(eligiblePractitioners([candidate({ practiceAreaIds: ["family"] })], request)).toHaveLength(0));
  it("allows a verified remote practitioner for remote enquiries", () => {
    const remote = candidate({ serviceProvinceIds: [1], serviceMunicipalityIds: [], acceptsRemoteMatters: true });
    expect(eligiblePractitioners([remote], { ...request, consultationMode: "remote" })).toHaveLength(1);
  });
  it("does not use remote eligibility for in-person-only enquiries", () => {
    const remote = candidate({ serviceProvinceIds: [1], serviceMunicipalityIds: [], acceptsRemoteMatters: true });
    expect(eligiblePractitioners([remote], request)).toHaveLength(0);
  });
});
