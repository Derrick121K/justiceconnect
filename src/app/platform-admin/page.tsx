import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowLeft, Building2, ShieldCheck, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function PlatformAdministrationPage() {
  if (!isSupabaseConfigured) redirect("/login");
  const db=await createClient(); const {data:{user}}=await db.auth.getUser(); if(!user) redirect("/login");
  const {data:roles}=await db.from("user_roles").select("role").eq("user_id",user.id);
  if(!(roles??[]).some(r=>r.role==="super_admin")) redirect("/dashboard");
  const [{count:users},{count:firms},{count:practitioners},{count:openMatters},{data:audit}] = await Promise.all([
    db.from("profiles").select("id",{count:"exact",head:true}),
    db.from("law_firms").select("id",{count:"exact",head:true}),
    db.from("practitioners").select("id",{count:"exact",head:true}),
    db.from("legal_matters").select("id",{count:"exact",head:true}).not("status","in",'("closed","withdrawn")'),
    db.from("audit_events").select("id,action,resource_type,resource_id,outcome,occurred_at").order("occurred_at",{ascending:false}).limit(15),
  ]);
  return <main className="jcstudio-page"><header className="jcstudio-page-head"><Link href="/jcstudio"><ArrowLeft size={16}/> Product suite</Link><div><span className="eyebrow dark">RESTRICTED OPERATIONS</span><h1>Platform Administration</h1><p>System-level governance and operational oversight. Legal file contents are not displayed here.</p></div></header>
    <div className="jcstudio-stat-grid"><article><span>REGISTERED ACCOUNTS</span><b>{users??0}</b><small>Shared JusticeConnect identity</small><Users/></article><article><span>LAW FIRMS</span><b>{firms??0}</b><small>All firm applications and tenants</small><Building2/></article><article><span>PRACTITIONERS</span><b>{practitioners??0}</b><small>Professional identity records</small><ShieldCheck/></article><article><span>MARKETPLACE MATTERS</span><b>{openMatters??0}</b><small>Count only; no confidential content</small><Activity/></article></div>
    <section className="jcstudio-panel"><div className="jcstudio-panel-head"><h2>Recent system audit events</h2><span>Latest 15</span></div><div className="jcstudio-task-list">{audit?.map(event=><div className="jcstudio-task" key={event.id}><div><b>{event.action}</b><small>{event.resource_type} · {event.resource_id??"—"} · {new Date(event.occurred_at).toLocaleString("en-ZA")}</small></div><span className="status-pill">{event.outcome}</span></div>)}</div></section>
  </main>;
}
