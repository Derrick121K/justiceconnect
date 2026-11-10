export type MatchingCandidate = {
  practitionerId: string;
  practiceAreaIds: string[];
  serviceProvinceIds: number[];
  serviceMunicipalityIds: string[];
  acceptsRemoteMatters: boolean;
  verificationStatus: "verified" | "pending" | "expired" | "rejected" | "suspended";
  isActive: boolean;
};
export type MatchingRequest = {
  practiceAreaIds: string[];
  provinceId: number;
  municipalityId?: string;
  consultationMode: "in_person" | "remote" | "either";
};

/** Eligibility only. It intentionally does not rank by paid placement or promise suitability. */
export function eligiblePractitioners(candidates: MatchingCandidate[], request: MatchingRequest) {
  return candidates.filter((candidate) => {
    if (!candidate.isActive || candidate.verificationStatus !== "verified") return false;
    if (!candidate.practiceAreaIds.some((id) => request.practiceAreaIds.includes(id))) return false;
    const remoteAllowed = request.consultationMode !== "in_person" && candidate.acceptsRemoteMatters;
    const provinceMatch = candidate.serviceProvinceIds.includes(request.provinceId);
    const municipalityMatch = Boolean(request.municipalityId && candidate.serviceMunicipalityIds.includes(request.municipalityId));
    return provinceMatch || municipalityMatch || remoteAllowed;
  });
}
