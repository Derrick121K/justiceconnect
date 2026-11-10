import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import {
  acceptPractitionerInterest,
  shareMatterWithPractitioner,
} from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { firstRelated, type Related } from "@/lib/types/relations";

type PractitionerCandidate = {
  practitioner_id: string;
  public_name: string;
  practitioner_type: string;
  practice_area_names: string[] | null;
};

type CaseInterestRow = {
  id: string;
  status: string;
  introductory_message: string | null;
  practitioners: Related<{ public_name: string | null }>;
};

type MatterDisclosureRow = {
  practitioner_id: string;
  revoked_at: string | null;
};

export default async function MatterDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { id } = await params;
  const notice = await searchParams;
  if (!isSupabaseConfigured) redirect("/login");

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");

  const { data: matter } = await db
    .from("legal_matters")
    .select(
      "id,reference_code,title,public_summary,province_id,consultation_mode,urgency,status,created_at",
    )
    .eq("id", id)
    .eq("client_user_id", user.id)
    .maybeSingle();
  if (!matter) notFound();

  const [
    { data: candidateData },
    { data: interestData },
    { data: disclosureData },
  ] = await Promise.all([
    db.rpc("find_matter_practitioner_candidates", {
      target_matter: id,
      result_limit: 30,
    }),
    db
      .from("case_interests")
      .select(
        "id,status,introductory_message,submitted_at,practitioners(id,public_name,practitioner_type)",
      )
      .eq("matter_id", id)
      .order("submitted_at", { ascending: false }),
    db
      .from("matter_disclosures")
      .select("practitioner_id,shared_at,revoked_at")
      .eq("matter_id", id),
  ]);

  const candidates = (candidateData ?? []) as PractitionerCandidate[];
  const interests = (interestData ?? []) as CaseInterestRow[];
  const disclosures = (disclosureData ?? []) as MatterDisclosureRow[];
  const shared = new Set(
    disclosures.filter((disclosure) => !disclosure.revoked_at).map((disclosure) => disclosure.practitioner_id),
  );

  return (
    <main className="workspace-page">
      <div className="wrap workspace-content">
        <Link href="/dashboard" className="text-link">
          <ArrowLeft size={15} /> Back to workspace
        </Link>
        <div className="workspace-heading">
          <div>
            <div className="eyebrow dark">{matter.reference_code}</div>
            <h1>{matter.title}</h1>
            <p>
              Enquiry status: {matter.status.replaceAll("_", " ")} · {matter.urgency} urgency
            </p>
          </div>
          <span className="privacy-chip">
            <ShieldCheck size={14} /> Private matter
          </span>
        </div>

        {notice.error && <p className="form-alert error">{notice.error}</p>}
        {notice.message && <p className="form-alert success">{notice.message}</p>}

        <div className="workspace-grid">
          <section className="workspace-main">
            <div className="dash-card">
              <h2>Initial matching summary</h2>
              <p>{matter.public_summary}</p>
              <small className="form-hint">
                This summary is shared only with practitioners you explicitly select below.
              </small>
            </div>

            <div className="dash-card">
              <h2>Suitable verified practitioners</h2>
              <p>
                Select who may receive your limited matter summary. This does not share
                confidential details or documents.
              </p>
              {candidates.length ? (
                candidates.map((practitioner) => (
                  <div className="matter-row" key={practitioner.practitioner_id}>
                    <div>
                      <b>{practitioner.public_name}</b>
                      <small>
                        {practitioner.practitioner_type.replaceAll("_", " ")} · {(
                          practitioner.practice_area_names ?? []
                        ).join(", ")}
                      </small>
                    </div>
                    {shared.has(practitioner.practitioner_id) ? (
                      <span className="status-pill status-engaged">Summary shared</span>
                    ) : (
                      <form action={shareMatterWithPractitioner}>
                        <input type="hidden" name="matter_id" value={id} />
                        <input
                          type="hidden"
                          name="practitioner_id"
                          value={practitioner.practitioner_id}
                        />
                        <button className="btn btn-navy btn-small">Share summary</button>
                      </form>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty-inline">
                  No verified practitioners match this matter yet. Try remote consultation
                  or review your selected practice area.
                </div>
              )}
            </div>
          </section>

          <aside className="workspace-side">
            <div className="dash-card">
              <h2>Expressions of interest</h2>
              {interests.length ? (
                interests.map((interest) => {
                  const practitioner = firstRelated(interest.practitioners);
                  return (
                    <div className="notification-row" key={interest.id}>
                      <b>{practitioner?.public_name ?? "Verified practitioner"}</b>
                      <p>
                        {interest.introductory_message ||
                          "The practitioner is interested in discussing this enquiry."}
                      </p>
                      <small>{interest.status.replaceAll("_", " ")}</small>
                      {interest.status !== "invited_to_contact" && (
                        <form action={acceptPractitionerInterest}>
                          <input type="hidden" name="interest_id" value={interest.id} />
                          <button className="btn btn-gold btn-small">Invite to contact</button>
                        </form>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="empty-inline">No practitioners have responded yet.</div>
              )}
            </div>
            <div className="dash-card">
              <h2>Privacy boundary</h2>
              <p>
                Confidential details, identity information and uploaded documents are not
                shared during initial matching. Contact is opened only after you select a
                practitioner.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
