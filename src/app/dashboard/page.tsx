import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BriefcaseBusiness,
  Building2,
  FilePlus2,
  Scale,
  ShieldCheck,
  Users,
} from "lucide-react";
import { signOut } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { firstRelated, type Related } from "@/lib/types/relations";

type FirmMembershipRow = {
  firm_id: string;
  firm_role: string;
  status: string;
  law_firms: Related<{
    legal_name: string | null;
    verification_status: string | null;
  }>;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; submitted?: string }>;
}) {
  const params = await searchParams;
  if (!isSupabaseConfigured) {
    return (
      <main className="workspace-page">
        <div className="wrap">
          <h1>Workspace setup required</h1>
          <p>Configure Supabase in your environment to enable secure accounts and dashboards.</p>
          <Link href="/">Return home</Link>
        </div>
      </main>
    );
  }

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: profile },
    { data: matters },
    { data: practitioner },
    { data: firmData },
    { data: notifications },
  ] = await Promise.all([
    db.from("profiles").select("display_name,email,status").eq("id", user.id).maybeSingle(),
    db
      .from("legal_matters")
      .select("id,reference_code,title,status,urgency,created_at")
      .eq("client_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    db
      .from("practitioners")
      .select("id,public_name,verification_status")
      .eq("user_id", user.id)
      .maybeSingle(),
    db
      .from("firm_members")
      .select("firm_id,firm_role,status,law_firms(legal_name,verification_status)")
      .eq("user_id", user.id),
    db
      .from("notifications")
      .select("id,title,body,created_at,read_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const firmMemberships = (firmData ?? []) as FirmMembershipRow[];

  return (
    <main className="workspace-page">
      <header className="workspace-top">
        <div className="wrap workspace-top-inner">
          <Link href="/" className="brand">
            <span className="brand-mark"><Scale size={20} /></span>
            <span>Justice<span>Connect</span></span>
          </Link>
          <div>
            <span>{profile?.display_name ?? user.email}</span>
            <form action={signOut}>
              <button className="text-button">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <div className="wrap workspace-content">
        {params.message && <p className="form-alert success">{params.message}</p>}
        {params.submitted && (
          <p className="form-alert success">
            Your enquiry has been submitted. Reference: {params.submitted.slice(0, 8).toUpperCase()}
          </p>
        )}

        <div className="workspace-heading">
          <div>
            <div className="eyebrow dark">YOUR PRIVATE WORKSPACE</div>
            <h1>Hello, {profile?.display_name?.split(" ")[0] ?? "there"}.</h1>
            <p>Manage your legal connections and activity from one secure place.</p>
          </div>
          <Link href="/cases/new" className="btn btn-gold">
            <FilePlus2 size={16} /> New legal enquiry
          </Link>
        </div>

        <div className="workspace-grid">
          <section className="workspace-main">
            <div className="dash-card">
              <div className="dash-card-head">
                <div>
                  <h2>Your legal enquiries</h2>
                  <p>Private matters submitted from your account.</p>
                </div>
                <span className="dash-count">{matters?.length ?? 0}</span>
              </div>
              {matters?.length ? (
                <div className="matter-list">
                  {matters.map((matter) => (
                    <div className="matter-row" key={matter.id}>
                      <div>
                        <Link href={`/dashboard/matters/${matter.id}`}>
                          <b>{matter.title}</b>
                        </Link>
                        <small>
                          {matter.reference_code} · {new Date(matter.created_at).toLocaleDateString("en-ZA")}
                        </small>
                      </div>
                      <span className={`status-pill status-${matter.status}`}>
                        {matter.status.replaceAll("_", " ")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <BriefcaseBusiness size={28} />
                  <b>No enquiries yet</b>
                  <p>When you submit a legal enquiry, its status and next steps will appear here.</p>
                  <Link href="/cases/new" className="text-link">Submit your first enquiry →</Link>
                </div>
              )}
            </div>

            <div className="dash-card">
              <div className="dash-card-head">
                <div>
                  <h2>Recent notifications</h2>
                  <p>Updates about your account and legal matters.</p>
                </div>
                <span className="dash-count">{notifications?.length ?? 0}</span>
              </div>
              {notifications?.length ? (
                notifications.map((notification) => (
                  <div className="notification-row" key={notification.id}>
                    <b>{notification.title}</b>
                    <p>{notification.body}</p>
                    <small>{new Date(notification.created_at).toLocaleString("en-ZA")}</small>
                  </div>
                ))
              ) : (
                <div className="empty-inline">You&apos;re all caught up.</div>
              )}
            </div>
          </section>

          <aside className="workspace-side">
            <div className="dash-card">
              <h2>Professional workspace</h2>
              {practitioner ? (
                <>
                  <div className="verification-line">
                    <ShieldCheck size={18} />
                    <div>
                      <b>{practitioner.public_name}</b>
                      <small>
                        Verification: {practitioner.verification_status.replaceAll("_", " ")}
                      </small>
                    </div>
                  </div>
                  <p className="form-hint">
                    Public discovery remains disabled until professional verification is completed.
                  </p>
                  <Link className="quick-link" href="/professionals/credentials">
                    Submit professional credentials →
                  </Link>
                  <Link className="quick-link" href="/dashboard/opportunities">
                    View shared case opportunities →
                  </Link>
                </>
              ) : (
                <>
                  <p>
                    Are you a legal practitioner? Create a profile and submit credentials for review.
                  </p>
                  <Link href="/professionals/join" className="btn btn-navy btn-full">
                    Create practitioner profile
                  </Link>
                </>
              )}
            </div>

            <div className="dash-card">
              <h2>Law firm workspace</h2>
              {firmMemberships.length ? (
                firmMemberships.map((membership) => {
                  const firm = firstRelated(membership.law_firms);
                  return (
                    <Link
                      className="firm-mini"
                      href={`/dashboard/firm/${membership.firm_id}`}
                      key={membership.firm_id}
                    >
                      <Building2 size={18} />
                      <div>
                        <b>{firm?.legal_name ?? "Law firm"}</b>
                        <small>
                          {membership.firm_role} · {firm?.verification_status ?? "status unavailable"}
                        </small>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <>
                  <p>Manage a legal practice, team and office locations.</p>
                  <Link href="/firms/new" className="btn btn-outline-dark btn-full">
                    Register a law firm
                  </Link>
                </>
              )}
            </div>

            <div className="dash-card">
              <h2>Quick links</h2>
              <Link className="quick-link" href="/lawyers"><Users size={16} /> Find legal professionals</Link>
              <Link className="quick-link" href="/practice-areas"><Scale size={16} /> Browse practice areas</Link>
              <Link className="quick-link" href="/messages"><Scale size={16} /> Secure messages</Link>
              <Link className="quick-link" href="/consultations"><Scale size={16} /> Consultations</Link>
              <Link className="quick-link" href="/dashboard/invitations"><Scale size={16} /> Firm invitations</Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
