"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SAFE_ACTION_ERROR, isDateOnly, isEmail, isSouthAfricanLocalDateTime, isUuid, readFormText } from "@/lib/form-data";

const value = readFormText;

export async function signIn(form: FormData) {
  const supabase = await createClient();
  const email = value(form, "email");
  const password = value(form, "password");
  if (!isEmail(email) || password.length < 1 || password.length > 128) redirect("/login?error=Enter%20a%20valid%20email%20and%20password");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent("Sign-in failed. Check your details and try again.")}`);
  redirect("/dashboard");
}

export async function signUp(form: FormData) {
  const supabase = await createClient();
  const name = value(form, "display_name");
  const email = value(form, "email").toLowerCase();
  const password = value(form, "password");
  if (name.length < 2 || name.length > 120 || !isEmail(email) || password.length < 12 || password.length > 128) {
    redirect("/register?error=Use%20a%20valid%20email%2C%20name%20and%20password%20of%20at%20least%2012%20characters");
  }
  const { error } = await supabase.auth.signUp({
    email, password,
    options: { data: { display_name: name } },
  });
  if (error) redirect(`/register?error=${encodeURIComponent("Account registration could not be completed. Check your details and try again.")}`);
  redirect("/login?message=Check%20your%20email%20to%20confirm%20your%20account");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function createLegalMatter(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?message=Sign%20in%20to%20submit%20a%20private%20legal%20enquiry");

  const title = value(form, "title");
  const summary = value(form, "public_summary");
  const confidential = value(form, "confidential_details");
  const provinceId = Number(value(form, "province_id"));
  const placeId = value(form, "place_id") || null;
  const practiceAreaId = value(form, "practice_area_id");
  const mode = value(form, "consultation_mode");
  const urgency = value(form, "urgency");
  if (title.length < 8 || title.length > 160 || summary.length < 30 || summary.length > 5000 || confidential.length > 10000 ||
      !Number.isInteger(provinceId) || provinceId < 1 || provinceId > 9 || !isUuid(practiceAreaId) || (placeId !== null && !isUuid(placeId)) ||
      !new Set<string>(["in_person", "remote", "either"]).has(mode) || !new Set<string>(["low", "normal", "urgent", "critical"]).has(urgency) ||
      value(form, "matching_consent") !== "yes") {
    redirect("/cases/new?error=Please%20complete%20all%20required%20fields%20and%20consent");
  }

  if (placeId) {
    const { data: place } = await supabase.from("places").select("id").eq("id", placeId).eq("province_id", provinceId).maybeSingle();
    if (!place) redirect("/cases/new?error=The%20selected%20city%20or%20town%20must%20belong%20to%20the%20selected%20province");
  }
  const { data: matter, error } = await supabase.from("legal_matters").insert({
    client_user_id: user.id, title, public_summary: summary,
    confidential_details: confidential || null, province_id: provinceId,
    place_id: placeId, consultation_mode: mode, urgency, status: "draft",
  }).select("id").single();
  if (error || !matter) redirect(`/cases/new?error=${encodeURIComponent(SAFE_ACTION_ERROR)}`);

  const { error: categoryError } = await supabase.from("matter_practice_areas").insert({ matter_id: matter.id, practice_area_id: practiceAreaId });
  if (categoryError) redirect(`/cases/new?error=${encodeURIComponent(SAFE_ACTION_ERROR)}`);

  const { error: submitError } = await supabase.rpc("submit_legal_matter", {
    target_matter: matter.id,
    notice_version: "justiceconnect-privacy-2026-11-v1",
  });
  if (submitError) redirect(`/cases/new?error=${encodeURIComponent(SAFE_ACTION_ERROR)}`);
  redirect(`/dashboard?submitted=${encodeURIComponent(matter.id)}`);
}

export async function createPractitionerProfile(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const name = value(form, "public_name");
  const type = value(form, "practitioner_type");
  const bio = value(form, "biography");
  const years = Number(value(form, "years_experience") || 0);
  if (name.length < 2 || name.length > 120 || bio.length > 3000 || !Number.isInteger(years) || years < 0 || years > 80 ||
      !new Set<string>(["attorney", "advocate", "candidate_attorney", "candidate_legal_practitioner", "other"]).has(type)) {
    redirect("/professionals/join?error=Check%20your%20profile%20details");
  }
  const profileFields = {
    public_name: name, biography: bio || null,
    years_experience: years, accepts_remote_matters: value(form, "remote") === "yes",
  };
  const practiceAreaIds = form.getAll("practice_area_ids").filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim());
  const rawProvinceIds = form.getAll("province_ids").filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim());
  const provinceIds = rawProvinceIds.map(Number);
  const placeIds = form.getAll("place_ids").filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim());
  if (practiceAreaIds.length < 1 || practiceAreaIds.length > 20 || !practiceAreaIds.every(isUuid) || provinceIds.length < 1 || provinceIds.length > 9 || !provinceIds.every((n) => Number.isInteger(n) && n >= 1 && n <= 9) || placeIds.length > 100 || !placeIds.every(isUuid)) redirect("/professionals/join?error=Select%20at%20least%20one%20practice%20area%20and%20province");
  if (placeIds.length) {
    const { data: selectedPlaces } = await supabase.from("places").select("id,province_id").in("id", [...new Set(placeIds)]);
    if (!selectedPlaces || selectedPlaces.length !== new Set(placeIds).size || selectedPlaces.some((place) => !place.province_id || !provinceIds.includes(place.province_id))) {
      redirect("/professionals/join?error=Each%20selected%20city%20must%20belong%20to%20a%20province%20you%20serve");
    }
  }
  const { data: existing } = await supabase.from("practitioners").select("id").eq("user_id", user.id).maybeSingle();
  let practitionerId: string;
  if (existing) {
    const { error } = await supabase.from("practitioners").update(profileFields).eq("id", existing.id);
    if (error) redirect(`/professionals/join?error=${encodeURIComponent(SAFE_ACTION_ERROR)}`);
    practitionerId = existing.id;
  } else {
    const { data, error } = await supabase.from("practitioners").insert({ ...profileFields, practitioner_type: type, user_id: user.id, profile_visibility: false, verification_status: "not_started" }).select("id").single();
    if (error || !data) redirect(`/professionals/join?error=${encodeURIComponent(SAFE_ACTION_ERROR)}`);
    practitionerId = data.id;
  }
  const { error: coverageError } = await supabase.rpc("save_practitioner_coverage", {
    target_practitioner: practitionerId,
    selected_practice_areas: [...new Set(practiceAreaIds)],
    selected_provinces: [...new Set(provinceIds)],
    selected_places: [...new Set(placeIds)],
  });
  if (coverageError) redirect(`/professionals/join?error=${encodeURIComponent(SAFE_ACTION_ERROR)}`);
  redirect("/dashboard?message=Practitioner%20profile%20submitted%20for%20verification");
}

export async function createFirm(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const legalName = value(form, "legal_name");
  const email = value(form, "email");
  const phone = value(form, "phone");
  if (legalName.length < 3 || legalName.length > 180 || (email && !isEmail(email)) || value(form, "trading_name").length > 180 || phone.length > 40 || value(form, "description").length > 3000) redirect("/firms/new?error=Enter%20valid%20firm%20details");
  const { data: firm, error } = await supabase.from("law_firms").insert({
    legal_name: legalName, trading_name: value(form, "trading_name") || null,
    email: email || null, phone: phone || null, description: value(form, "description") || null,
    created_by: user.id, verification_status: "pending", status: "pending",
  }).select("id").single();
  if (error || !firm) redirect(`/firms/new?error=${encodeURIComponent(SAFE_ACTION_ERROR)}`);
  redirect(`/dashboard/firm/${firm.id}?message=Firm%20submitted%20for%20verification`);
}

export async function sendMessage(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const conversationId = value(form, "conversation_id");
  const body = value(form, "body");
  if (!isUuid(conversationId) || body.length < 1 || body.length > 10000) redirect("/messages?error=Message%20must%20be%20between%201%20and%2010000%20characters");
  const { error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_user_id: user.id, body });
  if (error) redirect(`/messages?error=${encodeURIComponent(SAFE_ACTION_ERROR)}`);
  redirect(`/messages?conversation=${conversationId}`);
}

export async function shareMatterWithPractitioner(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const matterId = value(form, "matter_id");
  const practitionerId = value(form, "practitioner_id");
  if (!isUuid(matterId) || !isUuid(practitionerId)) redirect("/dashboard?error=Invalid%20matter%20or%20practitioner");
  const { error } = await supabase.rpc("share_matter_with_practitioner", { target_matter: matterId, target_practitioner: practitionerId });
  if (error) redirect(`/dashboard/matters/${matterId}?error=${encodeURIComponent(SAFE_ACTION_ERROR)}`);
  redirect(`/dashboard/matters/${matterId}?message=Limited%20summary%20shared%20with%20the%20selected%20practitioner`);
}

export async function expressInterest(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const disclosureId = value(form, "disclosure_id");
  const intro = value(form, "introductory_message");
  if (!isUuid(disclosureId) || intro.length > 2000) redirect("/dashboard/opportunities?error=Check%20your%20submission");
  const { error } = await supabase.rpc("practitioner_express_interest", { target_disclosure: disclosureId, intro: intro || null });
  if (error) redirect(`/dashboard/opportunities?error=${encodeURIComponent(SAFE_ACTION_ERROR)}`);
  redirect("/dashboard/opportunities?message=Your%20expression%20of%20interest%20was%20sent");
}

export async function acceptPractitionerInterest(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const interestId = value(form, "interest_id");
  if (!isUuid(interestId)) redirect("/dashboard?error=Invalid%20request");
  const { data, error } = await supabase.rpc("client_accept_practitioner_interest", { target_interest: interestId });
  if (error || !isUuid(data)) redirect(`/dashboard?error=${encodeURIComponent(SAFE_ACTION_ERROR)}`);
  redirect(`/messages?conversation=${data}`);
}

export async function reviewCredential(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const credentialId = value(form, "credential_id");
  const decision = value(form, "decision");
  const expiryInput = value(form, "expires_at");
  const expiry = expiryInput || null;
  if (!isUuid(credentialId) || !new Set(["verified", "rejected"]).has(decision) || (expiry !== null && !isDateOnly(expiry))) redirect("/admin?error=Check%20the%20review%20details");
  const { error } = await supabase.rpc("review_practitioner_credential", { target_credential: credentialId, decision, expiry });
  if (error) redirect(`/admin?error=${encodeURIComponent(SAFE_ACTION_ERROR)}`);
  redirect("/admin?message=Credential%20review%20saved");
}

export async function reviewPractitioner(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const practitionerId = value(form, "practitioner_id");
  const decision = value(form, "decision");
  if (!isUuid(practitionerId) || !new Set(["verified", "rejected", "suspended"]).has(decision)) redirect("/admin?error=Check%20the%20review%20details");
  const { error } = await supabase.rpc("review_practitioner", { target_practitioner: practitionerId, decision });
  if (error) redirect(`/admin?error=${encodeURIComponent(SAFE_ACTION_ERROR)}`);
  redirect("/admin?message=Practitioner%20review%20saved");
}

export async function reviewFirm(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const firmId = value(form, "firm_id");
  const decision = value(form, "decision");
  if (!isUuid(firmId) || !new Set(["verified", "rejected", "suspended"]).has(decision)) redirect("/admin?error=Check%20the%20review%20details");
  const { error } = await supabase.rpc("review_law_firm", { target_firm: firmId, decision });
  if (error) redirect(`/admin?error=${encodeURIComponent(SAFE_ACTION_ERROR)}`);
  redirect("/admin?message=Firm%20review%20saved");
}

export async function submitCredential(form: FormData) {
  const { encryptCredential } = await import("@/lib/credential-crypto");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: practitioner } = await supabase.from("practitioners").select("id").eq("user_id", user.id).maybeSingle();
  if (!practitioner) redirect("/professionals/join?error=Create%20your%20practitioner%20profile%20first");
  const credentialType = value(form, "credential_type");
  const registration = value(form, "registration_number");
  const issuer = value(form, "issuing_body");
  const expiresInput = value(form, "expires_at");
  const expires = expiresInput || null;
  if (!/^[a-z0-9_-]{3,60}$/i.test(credentialType) || registration.length < 2 || registration.length > 100 || issuer.length < 2 || issuer.length > 160 || (expires !== null && !isDateOnly(expires))) {
    redirect("/professionals/credentials?error=Enter%20valid%20credential%20details");
  }
  let encrypted: string;
  try { encrypted = encryptCredential(registration); }
  catch (error) { redirect(`/professionals/credentials?error=${encodeURIComponent(SAFE_ACTION_ERROR)}`); }
  const { error } = await supabase.from("practitioner_credentials").insert({
    practitioner_id: practitioner.id, credential_type: credentialType, issuing_body: issuer,
    registration_number_encrypted: encrypted, expires_at: expires,
    verification_status: "pending",
  });
  if (error) redirect(`/professionals/credentials?error=${encodeURIComponent(SAFE_ACTION_ERROR)}`);
  redirect("/dashboard?message=Credential%20submitted%20for%20secure%20verification");
}

export async function requestConsultation(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const conversationId = value(form, "conversation_id");
  const startsAt = value(form, "starts_at");
  const mode = value(form, "mode");
  const parsed = isSouthAfricanLocalDateTime(startsAt) ? new Date(`${startsAt}:00+02:00`) : new Date(Number.NaN);
  if (!isUuid(conversationId) || !isSouthAfricanLocalDateTime(startsAt) || Number.isNaN(parsed.getTime()) || !new Set<string>(["in_person", "remote", "either"]).has(mode)) redirect("/consultations?error=Choose%20a%20valid%20date%20and%20time");
  const { error } = await supabase.rpc("request_consultation", { target_conversation: conversationId, requested_start: parsed.toISOString(), requested_mode: mode });
  if (error) redirect(`/consultations?error=${encodeURIComponent(SAFE_ACTION_ERROR)}`);
  redirect("/consultations?message=Consultation%20request%20sent");
}

export async function respondConsultation(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const consultationId = value(form, "consultation_id");
  const decision = value(form, "decision");
  if (!isUuid(consultationId) || !new Set(["confirmed", "cancelled"]).has(decision)) redirect("/consultations?error=Invalid%20consultation%20response");
  const { error } = await supabase.rpc("respond_to_consultation", { target_consultation: consultationId, decision });
  if (error) redirect(`/consultations?error=${encodeURIComponent(SAFE_ACTION_ERROR)}`);
  redirect("/consultations?message=Consultation%20updated");
}

export async function createFirmBranch(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const firmId = value(form, "firm_id");
  const name = value(form, "name");
  const placeId = value(form, "place_id") || null;
  if (!isUuid(firmId) || name.length < 2 || name.length > 120 || (placeId !== null && !isUuid(placeId)) || value(form, "address_line").length > 300 || value(form, "phone").length > 40 || (value(form, "email") && !isEmail(value(form, "email")))) redirect(`/dashboard/firm/${firmId}?error=Enter%20a%20valid%20branch%20name`);
  const { error } = await supabase.from("firm_branches").insert({
    firm_id: firmId, name, address_line: value(form, "address_line") || null,
    place_id: placeId, phone: value(form, "phone") || null, email: value(form, "email") || null,
  });
  if (error) redirect(`/dashboard/firm/${firmId}?error=${encodeURIComponent(SAFE_ACTION_ERROR)}`);
  redirect(`/dashboard/firm/${firmId}?message=Branch%20created`);
}

export async function inviteFirmMember(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const firmId = value(form, "firm_id");
  const email = value(form, "email").toLowerCase();
  const role = value(form, "firm_role");
  if (!isUuid(firmId) || !isEmail(email) || !new Set(["administrator", "practitioner", "staff", "read_only"]).has(role)) redirect(`/dashboard/firm/${firmId}?error=Enter%20a%20valid%20email`);
  const { error } = await supabase.rpc("invite_firm_member", { target_firm: firmId, invite_email: email, requested_role: role });
  if (error) redirect(`/dashboard/firm/${firmId}?error=${encodeURIComponent(SAFE_ACTION_ERROR)}`);
  redirect(`/dashboard/firm/${firmId}?message=Invitation%20sent`);
}

export async function acceptFirmInvitation(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const membershipId = value(form, "membership_id");
  if (!isUuid(membershipId)) redirect("/dashboard/invitations?error=Invalid%20invitation");
  const { error } = await supabase.rpc("accept_firm_invitation", { target_membership: membershipId });
  if (error) redirect(`/dashboard/invitations?error=${encodeURIComponent(SAFE_ACTION_ERROR)}`);
  redirect("/dashboard/invitations?message=Invitation%20accepted");
}
