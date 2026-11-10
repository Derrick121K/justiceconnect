import { z } from "zod";

export const legalEnquirySchema = z.object({
  title: z.string().trim().min(8).max(160),
  description: z.string().trim().min(30).max(5000),
  provinceId: z.number().int().min(1).max(9),
  municipalityId: z.string().uuid().optional(),
  practiceAreaIds: z.array(z.string().uuid()).min(1).max(5),
  consultationMode: z.enum(["in_person", "remote", "either"]),
  urgency: z.enum(["low", "normal", "urgent", "critical"]),
  consentToMatching: z.literal(true),
});
export type LegalEnquiryInput = z.infer<typeof legalEnquirySchema>;

export const practitionerProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  practitionerType: z.enum(["attorney", "advocate", "candidate_attorney", "candidate_legal_practitioner", "other"]),
  practiceAreaIds: z.array(z.string().uuid()).min(1).max(20),
  provinceIds: z.array(z.number().int().min(1).max(9)).min(1).max(9),
  acceptsRemoteMatters: z.boolean(),
});
export type PractitionerProfileInput = z.infer<typeof practitionerProfileSchema>;
