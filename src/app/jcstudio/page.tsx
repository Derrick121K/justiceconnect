import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, BriefcaseBusiness, CalendarDays, CheckCircle2, Clock3, FileText, FolderLock, Plus, Scale, ShieldCheck, Users, Wallet } from "lucide-react";
import { signOut } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { currentSouthAfricanDate } from "@/lib/form-data";

type FirmLink = { firm_id: string; firm_role: string; status: string; law_firms: { legal_name: string; status: string; verification_status: string } | null };

export default async function JCStudioPage() {
  if (!isSupabaseConfigured) return <main className="workspace-page"><div className="wrap workspace-content"><h1>JCStudio setup required</h1><p>Connect the dedicated JusticeConnect Supabase project to enable the legal practice workspace.</p><Link href="/">Return to JusticeConnect</Link></div></main>;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: roleRows }, { data: practitioner }, { data: firmRows }] = await Promise.all([
    db.from("profiles").select("display_name,email").eq("id", user.id).maybeSingle(),
    db.from("user_roles").select("role").eq("user_id", user.id),
    db.from("practitioners").select("id,verification_status,profile_visibility").eq("user_id", user.id).maybeSingle(),
    db.from("firm_members").select("firm_id,firm_role,status,law_firms(legal_name,status,verification_status)").eq("user_id", user.id),
  ]);
  const roles = (roleRows ?? []).map((row) => row.role as string);
  const memberships = (firmRows ?? []) as unknown as FirmLink[];
  const activeFirms = memberships.filter((m) => m.status === "active" && m.law_firms?.status === "active" && m.law_firms.verification_status === "verified");
  const verifiedPractitioner = practitioner?.verification_status === "verified" && practitioner.profile_visibility;
  const eligibleFirmAdmin = activeFirms.some((m) => ["owner", "administrator"].includes(m.firm_role));
  const practitionerCredentials = practitioner ? await db.from("practitioner_credentials")
    .select("id").eq("practitioner_id", practitioner.id).eq("verification_status", "verified")
    .in("credential_type", ["lpc_registration", "candidate_registration", "admission"])
    .or("expires_at.is.null,expires_at.gte." + currentSouthAfricanDate()) : { data: [] };
  const credentialReady = !!practitionerCredentials.data?.length;
  const canOperate = (verifiedPractitioner && credentialReady) || eligibleFirmAdmin || activeFirms.length > 0;
  const hasProfessionalRole = roles.some((role) => ["individual_practitioner", "firm_owner", "firm_admin", "firm_practitioner"].includes(role));
  if (!hasProfessionalRole && !activeFirms.length) redirect("/dashboard");

  const [{ data: matters }, { count: taskCount }, { count: eventCount }, { count: invoiceCount }] = canOperate ? await Promise.all([
    db.from("practice_matters").select("id,matter_number,title,client_name,status,priority,due_on,updated_at").order("updated_at", { ascending: false }).limit(8),
    db.from("practice_tasks").select("id", { count: "exact", head: true }).eq("assigned_to", user.id).in("status", ["todo", "in_progress", "blocked"]),
    db.from("practice_events").select("id", { count: "exact", head: true }).gte("starts_at", new Date().toISOString()).eq("status", "scheduled"),
    db.from("practice_invoices").select("id", { count: "exact", head: true }).in("status", ["draft", "issued", "partially_paid", "overdue"]),
  ]) : [{ data: [] as {id:string;matter_number:string;title:string;client_name:string;status:string;priority:string;due_on:string|null;updated_at:string}[] }, {count:0}, {count:0}, {count:0}];

  const credentialStatus = practitioner?.verification_status ?? "not_started";
  return <main className="jcstudio-shell">
    <aside className="jcstudio-sidebar">
      <Link href="/" className="jcstudio-brand"><span className="brand-mark"><Scale size={19}/></span><span>JCStudio<small>LEGAL PRACTICE SUITE</small></span></Link>
      <div className="jcstudio-side-label">WORKSPACE</div>
      <Link className="jcstudio-nav active" href="/jcstudio"><BriefcaseBusiness size={17}/> Overview</Link>
      <Link className="jcstudio-nav" href="/jcstudio/matters"><FolderLock size={17}/> Matters</Link>
      <Link className="jcstudio-nav" href="/jcstudio/tasks"><CheckCircle2 size={17}/> My tasks</Link>
      <Link className="jcstudio-nav" href="/jcstudio/intake"><ArrowUpRight size={17}/> Accepted mandates</Link>
      <div className="jcstudio-side-label">CONNECTED SYSTEMS</div>
      <Link className="jcstudio-nav" href="/dashboard"><Scale size={17}/> JusticeConnect</Link>
      <Link className="jcstudio-nav" href="/compliance"><ShieldCheck size={17}/> Compliance Centre</Link>
      <Link className="jcstudio-nav" href="/platform-admin"><Users size={17}/> Platform Administration</Link>
      <div className="jcstudio-sidebar-foot"><span>JMSE KAPA HOLDINGS (PTY) LTD</span><small>Secure legal workspace</small></div>
    </aside>
    <section className="jcstudio-main">
      <header className="jcstudio-topbar">
        <div><span className="eyebrow dark">CONNECTED LEGAL OPERATIONS</span><h1>Good day, {profile?.display_name?.split(" ")[0] ?? "Practitioner"}</h1><p>Manage firm matters, work allocation and practice operations.</p></div>
        <div className="jcstudio-top-actions"><span>{profile?.email ?? user.email}</span><form action={signOut}><button className="text-button">Sign out</button></form></div>
      </header>
      <div className="jcstudio-content">
        {!canOperate && <section className="jcstudio-gate"><div><ShieldCheck size={22}/><strong>Practice access is restricted pending verification</strong></div>
          <p>Your JusticeConnect account is connected, but live legal-practice operations require a verified practitioner profile with a current qualifying credential, or an active administrator role in a verified firm.</p>
          <p className="jcstudio-gate-status">Practitioner profile: <b>{credentialStatus.replaceAll("_"," ")}</b> · Qualifying credential: <b>{credentialReady ? "Current" : "Not verified"}</b></p>
          <Link href="/professionals/credentials" className="btn btn-gold">Review professional credentials <ArrowUpRight size={15}/></Link>
        </section>}
        <div className="jcstudio-stat-grid">
          <article><span>ACTIVE MATTERS</span><b>{canOperate ? (matters?.length ?? 0) : "—"}</b><small>Visible to your assigned workspace</small><BriefcaseBusiness/></article>
          <article><span>OPEN TASKS</span><b>{canOperate ? (taskCount ?? 0) : "—"}</b><small>Assigned to your account</small><CheckCircle2/></article>
          <article><span>UPCOMING EVENTS</span><b>{canOperate ? (eventCount ?? 0) : "—"}</b><small>Scheduled practice events</small><CalendarDays/></article>
          <article><span>BILLING ITEMS</span><b>{canOperate ? (invoiceCount ?? 0) : "—"}</b><small>Draft and issued invoices</small><Wallet/></article>
        </div>
        <div className="jcstudio-work-grid">
          <section className="jcstudio-panel">
            <div className="jcstudio-panel-head"><div><span className="eyebrow dark">MATTER MANAGEMENT</span><h2>Recent matters</h2></div>{canOperate && <Link className="jcstudio-text-link" href="/jcstudio/matters">View all <ArrowUpRight size={15}/></Link>}</div>
            {canOperate && matters?.length ? <div className="jcstudio-matter-list">{matters.map((matter) => <Link href={`/jcstudio/matters/${matter.id}`} className="jcstudio-matter-row" key={matter.id}>
              <div><small>{matter.matter_number} · {matter.client_name}</small><strong>{matter.title}</strong><span>{matter.priority} priority {matter.due_on ? "· Due " + matter.due_on : ""}</span></div><span className="status-pill">{matter.status.replaceAll("_"," ")}</span>
            </Link>)}</div> : <div className="jcstudio-empty"><BriefcaseBusiness size={26}/><strong>{canOperate ? "No practice matters yet" : "Your workspace is ready for activation"}</strong><p>{canOperate ? "Open a matter after a new client instruction or convert an accepted marketplace mandate." : "Once verification is complete, your matter, diary, task and billing tools will be enabled."}</p>{canOperate && <Link className="btn btn-gold" href="/jcstudio/matters/new"><Plus size={15}/> Open a matter</Link>}</div>}
          </section>
          <section className="jcstudio-panel">
            <div className="jcstudio-panel-head"><div><span className="eyebrow dark">PRACTICE TOOLS</span><h2>Workspace modules</h2></div></div>
            <div className="jcstudio-tool-list">
              <Link href="/jcstudio/matters"><FolderLock/><span><b>Matter management</b><small>Client records, matter teams, notes and status</small></span><ArrowUpRight/></Link>
              <Link href="/jcstudio/tasks"><CheckCircle2/><span><b>Tasks and deadlines</b><small>Allocation, priorities and completion tracking</small></span><ArrowUpRight/></Link>
              <Link href="/jcstudio/intake"><FileText/><span><b>JusticeConnect intake</b><small>Convert accepted mandates into private matters</small></span><ArrowUpRight/></Link>
              <div className="jcstudio-tool-disabled"><CalendarDays/><span><b>Calendar and court diary</b><small>Database foundation added; interface and sync integration are next</small></span><em>IN BUILD</em></div>
              <div className="jcstudio-tool-disabled"><Clock3/><span><b>Time recording and billing</b><small>Time, invoices and line-item structures are being connected</small></span><em>IN BUILD</em></div>
              <div className="jcstudio-tool-disabled"><Wallet/><span><b>Client payments and trust ledger</b><small>Payment gateway and regulated trust accounting are not enabled</small></span><em>GATED</em></div>
            </div>
          </section>
        </div>
        <section className="jcstudio-connect-strip"><div><ShieldCheck size={20}/><span><b>One account. Four connected products.</b><small>Shared identity, controlled data exchange and role-based access across the JusticeConnect suite.</small></span></div><div>{activeFirms.map((firm) => <span className="jcstudio-firm-chip" key={firm.firm_id}>{firm.law_firms?.legal_name} · {firm.firm_role}</span>)}</div></section>
      </div>
    </section>
  </main>;
}
