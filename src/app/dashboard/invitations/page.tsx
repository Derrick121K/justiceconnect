import { redirect } from "next/navigation";
import { acceptFirmInvitation } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { firstRelated, type Related } from "@/lib/types/relations";

type InvitationRow = {
  id: string;
  firm_role: string;
  law_firms: Related<{ legal_name: string | null }>;
};

export default async function Invitations({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  if (!isSupabaseConfigured) redirect("/login");

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await db
    .from("firm_members")
    .select("id,firm_id,firm_role,status,created_at,law_firms(legal_name)")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  const invitations = (data ?? []) as InvitationRow[];

  return (
    <main className="workspace-page">
      <div className="wrap workspace-content">
        <div className="eyebrow dark">ORGANISATION ACCESS</div>
        <h1>Firm invitations</h1>
        {params.error && <p className="form-alert error">{params.error}</p>}
        {params.message && <p className="form-alert success">{params.message}</p>}
        {invitations.length ? (
          invitations.map((invitation) => {
            const firm = firstRelated(invitation.law_firms);
            return (
              <div className="dash-card" key={invitation.id}>
                <h2>{firm?.legal_name ?? "Law firm"}</h2>
                <p>Invited as: {invitation.firm_role}</p>
                <form action={acceptFirmInvitation}>
                  <input type="hidden" name="membership_id" value={invitation.id} />
                  <button className="btn btn-gold">Accept invitation</button>
                </form>
              </div>
            );
          })
        ) : (
          <div className="empty-state">
            <b>No pending invitations</b>
            <p>Firm invitations will appear here.</p>
          </div>
        )}
      </div>
    </main>
  );
}
