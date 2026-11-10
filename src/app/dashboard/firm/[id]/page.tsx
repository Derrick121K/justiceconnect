import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Building2, MapPin } from "lucide-react";
import { createFirmBranch, inviteFirmMember } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { firstRelated, type Related } from "@/lib/types/relations";

type FirmBranchRow = {
  id: string;
  name: string;
  address_line: string | null;
  places: Related<{ name: string }>;
};

type FirmMemberRow = {
  id: string;
  user_id: string;
  firm_role: string;
  status: string;
};

export default async function FirmWorkspace({
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

  const [
    { data: firm },
    { data: branchData },
    { data: places },
    { data: memberData },
  ] = await Promise.all([
    db
      .from("law_firms")
      .select("id,legal_name,trading_name,description,verification_status,status,email,phone")
      .eq("id", id)
      .maybeSingle(),
    db
      .from("firm_branches")
      .select("id,name,address_line,phone,email,places(name)")
      .eq("firm_id", id)
      .order("is_primary", { ascending: false }),
    db.from("places").select("id,name").not("province_id", "is", null).order("name").limit(500),
    db
      .from("firm_members")
      .select("id,user_id,firm_role,status,created_at")
      .eq("firm_id", id)
      .order("created_at"),
  ]);

  if (!firm) notFound();

  const branches = (branchData ?? []) as FirmBranchRow[];
  const members = (memberData ?? []) as FirmMemberRow[];

  return (
    <main className="workspace-page">
      <div className="wrap workspace-content">
        <Link href="/dashboard" className="text-link">
          ← Workspace
        </Link>
        <div className="workspace-heading">
          <div>
            <div className="eyebrow dark">LAW FIRM WORKSPACE</div>
            <h1>{firm.trading_name || firm.legal_name}</h1>
            <p>
              Verification: {firm.verification_status} · Account: {firm.status}
            </p>
          </div>
          <span className="privacy-chip">
            <Building2 size={14} /> Firm administration
          </span>
        </div>

        {notice.error && <p className="form-alert error">{notice.error}</p>}
        {notice.message && <p className="form-alert success">{notice.message}</p>}

        <div className="workspace-grid">
          <section className="workspace-main">
            <div className="dash-card">
              <h2>Branches and offices</h2>
              {branches.length ? (
                branches.map((branch) => {
                  const place = firstRelated(branch.places);
                  return (
                    <div className="matter-row" key={branch.id}>
                      <div>
                        <b>{branch.name}</b>
                        <small>
                          {branch.address_line ?? "Address not added"} · {place?.name ?? "Location not selected"}
                        </small>
                      </div>
                      <MapPin size={17} />
                    </div>
                  );
                })
              ) : (
                <p className="empty-inline">No branches added yet.</p>
              )}
            </div>

            <div className="dash-card">
              <h2>Firm team</h2>
              {members.map((member) => (
                <div className="matter-row" key={member.id}>
                  <div>
                    <b>{member.firm_role}</b>
                    <small>
                      {member.user_id.slice(0, 8)} · {member.status}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="workspace-side">
            <div className="dash-card">
              <h2>Add a branch</h2>
              <form action={createFirmBranch} className="stack-form">
                <input type="hidden" name="firm_id" value={firm.id} />
                <label>
                  Branch name
                  <input name="name" required maxLength={120} />
                </label>
                <label>
                  Street address
                  <input name="address_line" maxLength={240} />
                </label>
                <label>
                  City or town
                  <select name="place_id" defaultValue="">
                    <option value="">Choose location</option>
                    {places?.map((place) => (
                      <option value={place.id} key={place.id}>
                        {place.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Phone
                  <input name="phone" type="tel" maxLength={40} />
                </label>
                <label>
                  Email
                  <input name="email" type="email" maxLength={254} />
                </label>
                <button className="btn btn-navy">Add branch</button>
              </form>
            </div>

            <div className="dash-card">
              <h2>Invite team member</h2>
              <form action={inviteFirmMember} className="stack-form">
                <input type="hidden" name="firm_id" value={firm.id} />
                <label>
                  Account email
                  <input type="email" name="email" required />
                </label>
                <label>
                  Firm role
                  <select name="firm_role">
                    <option value="practitioner">Practitioner</option>
                    <option value="administrator">Administrator</option>
                    <option value="staff">Staff</option>
                    <option value="read_only">Read only</option>
                  </select>
                </label>
                <button className="btn btn-navy">Send invitation</button>
                <small>
                  Invitees must have a confirmed JusticeConnect account before invitation.
                </small>
              </form>
            </div>

            <div className="dash-card">
              <h2>Verification status</h2>
              <p>
                Your firm is not publicly listed until the compliance team verifies its
                information. Branches remain private until then.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
