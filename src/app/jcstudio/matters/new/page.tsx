import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { createPracticeMatter } from "@/app/jcstudio/actions";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { currentSouthAfricanDate } from "@/lib/form-data";

type FirmRow = { firm_id: string; firm_role: string; status: string; law_firms: { id:string; legal_name:string; status:string; verification_status:string } | null };
type QualifiedFirmPractitioner = { user_id:string; display_name:string };

export default async function NewPracticeMatterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  if (!isSupabaseConfigured) redirect("/jcstudio");
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const [{data:practitioner},{data:firmData}] = await Promise.all([
    db.from("practitioners").select("id,verification_status,profile_visibility").eq("user_id",user.id).maybeSingle(),
    db.from("firm_members").select("firm_id,firm_role,status,law_firms(id,legal_name,status,verification_status)").eq("user_id",user.id),
  ]);
  const firms = (firmData ?? []) as unknown as FirmRow[];
  const eligibleFirms = firms.filter(f=>f.status==="active" && f.law_firms?.status==="active" && f.law_firms.verification_status==="verified" && ["owner","administrator","practitioner"].includes(f.firm_role));
  const {data:credentials} = practitioner ? await db.from("practitioner_credentials").select("id").eq("practitioner_id",practitioner.id).eq("verification_status","verified").in("credential_type",["lpc_registration","candidate_registration","admission"]).or("expires_at.is.null,expires_at.gte."+currentSouthAfricanDate()) : {data:[]};
  const practitionerReady = practitioner?.verification_status==="verified" && practitioner.profile_visibility && !!credentials?.length;
  const firmAdminMemberships = eligibleFirms.filter(f=>["owner","administrator"].includes(f.firm_role));
  const qualifiedLists = await Promise.all(firmAdminMemberships.map(async firm => {
    const {data} = await db.rpc("list_qualified_firm_practitioners",{target_firm:firm.firm_id});
    return (data ?? []).map((person:QualifiedFirmPractitioner)=>({
      user_id:person.user_id,
      label:person.display_name+" · "+(firm.law_firms?.legal_name ?? "Verified firm"),
    }));
  }));
  const responsibleOptions = qualifiedLists.flat();
  const firmAdminReady = eligibleFirms.some(f=>["owner","administrator"].includes(f.firm_role));
  if (!practitionerReady && !firmAdminReady) return <main className="jcstudio-page"><header className="jcstudio-page-head"><Link href="/jcstudio"><ArrowLeft size={16}/> JCStudio</Link><div><span className="eyebrow dark">ACCESS CONTROL</span><h1>Opening a practice matter</h1></div></header><section className="jcstudio-gate"><ShieldCheck size={24}/><h2>Verification required</h2><p>Opening live practice matters is restricted until your practitioner profile and current qualifying credential are verified, or you have administrator access to an active verified firm.</p><Link href="/professionals/credentials" className="btn btn-gold">Manage credentials</Link></section></main>;
  return <main className="jcstudio-page"><header className="jcstudio-page-head"><Link href="/jcstudio/matters"><ArrowLeft size={16}/> Matters</Link><div><span className="eyebrow dark">NEW CLIENT FILE</span><h1>Open a practice matter</h1><p>Use this for a newly instructed matter. Convert JusticeConnect enquiries only after an accepted mandate.</p></div></header>
    <form action={createPracticeMatter} className="jcstudio-form">
      {params.error && <p className="form-alert error">{params.error}</p>}
      <label>Firm workspace<select name="firm_id" defaultValue={eligibleFirms[0]?.firm_id ?? ""}><option value="">Independent practice</option>{eligibleFirms.map(f=><option key={f.firm_id} value={f.firm_id}>{f.law_firms?.legal_name} · {f.firm_role}</option>)}</select><small>Only active, verified firms appear here. Independent practice requires verified practitioner eligibility.</small></label>
      <label>Responsible practitioner<select name="responsible_user_id" defaultValue={responsibleOptions[0]?.user_id ?? ""}><option value="">Select a verified firm practitioner</option>{responsibleOptions.map(person=><option key={person.user_id} value={person.user_id}>{person.label}</option>)}</select><small>Required for firm matters opened by owners or administrators. The selected practitioner must be an active member of the firm with a current verified qualifying LPC registration or admission credential.</small></label>
      <div className="form-two"><label>Client / organisation<input name="client_name" required minLength={2} maxLength={160} placeholder="Client full name or organisation"/></label><label>Client email<input name="client_email" type="email" maxLength={254} placeholder="client@example.co.za"/></label></div>
      <label>Matter title<input name="title" required minLength={8} maxLength={180} placeholder="e.g. Commercial lease dispute"/></label>
      <div className="form-two"><label>Practice area<input name="practice_area" defaultValue="General" minLength={2} maxLength={120}/></label><label>Priority<select name="priority" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label></div>
      <label>Internal matter description<textarea name="description" rows={6} maxLength={30000} placeholder="Confidential internal description and instructions"/></label>
      <label>Target date<input name="due_on" type="date"/></label>
      <p className="jcstudio-form-privacy"><ShieldCheck size={16}/> This creates a private internal matter. Client enquiries, mandate status and public profile information are not exposed through this form.</p>
      <div className="jcstudio-form-actions"><Link className="btn btn-outline-dark" href="/jcstudio/matters">Cancel</Link><button className="btn btn-gold" type="submit">Create private matter</button></div>
    </form>
  </main>;
}
