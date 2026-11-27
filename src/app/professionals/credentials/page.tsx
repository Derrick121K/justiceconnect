import Link from "next/link";
import { redirect } from "next/navigation";
import { submitCredential } from "@/app/actions";
import { FormError, FormShell } from "@/components/form-shell";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { currentSouthAfricanDate } from "@/lib/form-data";

type CredentialRow = {
  id: string;
  credential_type: string;
  issuing_body: string | null;
  verification_status: string;
  expires_at: string | null;
  created_at: string;
};

const credentialLabels: Record<string, string> = {
  lpc_registration: "LPC registration",
  candidate_registration: "Candidate registration",
  admission: "Admission / enrolment",
  ffc: "Fidelity Fund Certificate (FFC)",
};

function credentialStatus(credential: CredentialRow, today: string): string {
  if (credential.expires_at && credential.expires_at < today) {
    return "Expired — replacement required";
  }
  if (credential.verification_status === "pending") return "Awaiting compliance review";
  if (credential.verification_status === "verified") return "Verified";
  if (credential.verification_status === "rejected") return "Not approved";
  return credential.verification_status.replaceAll("_", " ");
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export default async function CredentialsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;
  if (!isSupabaseConfigured) redirect("/login");

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");

  const { data: practitioner } = await db
    .from("practitioners")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!practitioner) redirect("/professionals/join");

  const { data } = await db
    .from("practitioner_credentials")
    .select("id,credential_type,issuing_body,verification_status,expires_at,created_at")
    .eq("practitioner_id", practitioner.id)
    .order("created_at", { ascending: false });

  const credentials = (data ?? []) as CredentialRow[];
  const today = currentSouthAfricanDate();

  return (
    <FormShell
      title="Professional credentials"
      intro="Submit current registration or professional evidence for an independent compliance review. Registration numbers are encrypted before storage."
    >
      <FormError error={error} />
      {message && <p className="form-alert success">{message}</p>}

      <form action={submitCredential} className="stack-form">
        <label>
          Credential type
          <select name="credential_type" defaultValue="lpc_registration" required>
            <option value="lpc_registration">LPC registration / proof of enrolment</option>
            <option value="candidate_registration">Candidate legal practitioner registration</option>
            <option value="admission">Admission / enrolment</option>
            <option value="ffc">Fidelity Fund Certificate (FFC)</option>
          </select>
        </label>
        <label>
          Issuing body
          <input
            name="issuing_body"
            defaultValue="Legal Practice Council"
            maxLength={160}
            required
          />
        </label>
        <label>
          Registration or certificate number
          <input
            name="registration_number"
            maxLength={100}
            autoComplete="off"
            required
          />
        </label>
        <label>
          Expiry date (if applicable)
          <input name="expires_at" type="date" min={today} />
        </label>
        <p className="form-hint">
          Use the expiry date printed on the current document. FFCs are issued for a particular year and must be valid for the relevant period.
        </p>
        <div className="form-alert">
          An FFC is a separate certificate for specified trust-account practices. It does not replace proof that you have been admitted and enrolled as a legal practitioner. Do not submit identity numbers, passwords or another person&apos;s registration details.
        </div>
        <button className="btn btn-navy">Submit credential securely</button>
      </form>

      <div className="auth-footer">
        <b>Submitted credentials</b>
        {credentials.length ? (
          credentials.map((credential) => {
            const expired = Boolean(credential.expires_at && credential.expires_at < today);
            return (
              <div className="notification-row" key={credential.id}>
                <b>{credentialLabels[credential.credential_type] ?? "Professional credential"}</b>
                <p>{credential.issuing_body ?? "Issuing body not supplied"}</p>
                <small>
                  {credentialStatus(credential, today)}
                  {credential.expires_at ? ` · Expires ${formatDate(credential.expires_at)}` : ""}
                </small>
                {expired && (
                  <p className="form-hint">
                    This submission is retained in your history, but it cannot be approved as a current credential. Submit a replacement with a valid expiry date.
                  </p>
                )}
              </div>
            );
          })
        ) : (
          <p>No credentials submitted yet.</p>
        )}
        <Link href="/dashboard">Return to workspace</Link>
      </div>
    </FormShell>
  );
}
