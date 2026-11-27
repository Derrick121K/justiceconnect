import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowUpRight, FileCheck2 } from "lucide-react";
import { convertAcceptedMandate } from "@/app/jcstudio/actions";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function JCStudioIntakePage({searchParams}:{searchParams:Promise<{error?:string}>}) {
  const params=await searchParams;
  if(!isSupabaseConfigured) redirect("/jcstudio");
  const db=await createClient(); const {data:{user}}=await db.auth.getUser(); if(!user) redirect("/login");
  const [{data:practitioner},{data:memberships}] = await Promise.all([
    db.from("practitioners").select("id").eq("user_id",user.id).maybeSingle(),
    db.from("firm_members").select("firm_id,status,firm_role,law_firms(status,verification_status)").eq("user_id",user.id).eq("status","active"),
  ]);
  const eligibleFirmIds=(memberships??[]).filter(m=>{
    const f=Array.isArray(m.law_firms)?m.law_firms[0]:m.law_firms;
    return f?.status==="active" && f.verification_status==="verified" && ["owner","administrator"].includes(m.firm_role);
  }).map(m=>m.firm_id);
  const filters=[];
  if(practitioner?.id) filters.push("practitioner_id.eq."+practitioner.id);
  if(eligibleFirmIds.length) filters.push("firm_id.in.("+eligibleFirmIds.join(",")+")");
  const {data:mandates,error}=filters.length?await db.from("mandates").select("id,matter_id,firm_id,practitioner_id,engagement_status,created_at").eq("engagement_status","active").or(filters.join(",")).order("created_at",{ascending:false}):{data:[],error:null};
  return <main className="jcstudio-page"><header className="jcstudio-page-head"><Link href="/jcstudio"><ArrowLeft size={16}/> JCStudio overview</Link><div><span className="eyebrow dark">CONNECTED CLIENT INTAKE</span><h1>Accepted mandates</h1><p>Move client-authorised work from JusticeConnect into your private practice workspace.</p></div></header>
    {params.error&&<p className="form-alert error">{params.error}</p>}
    <section className="jcstudio-panel"><div className="jcstudio-panel-head"><h2>Ready for Studio conversion</h2><span>{mandates?.length??0} active mandates</span></div>
      <p className="jcstudio-panel-intro">Only mandates with an active acceptance status are eligible. The database verifies the client enquiry, instructed practitioner and firm before creating a Studio record.</p>
      {error?<p className="jcstudio-notice">The mandate list could not be loaded. Check your practitioner or firm access.</p>:mandates?.length?<div className="jcstudio-matter-list">{mandates.map(m=><div className="jcstudio-matter-row" key={m.id}><div><small>MANDATE {m.id.slice(0,8).toUpperCase()} · {new Date(m.created_at).toLocaleDateString("en-ZA")}</small><strong>Accepted JusticeConnect instruction</strong><span>Client details remain private until this authorised conversion completes.</span></div><form action={convertAcceptedMandate}><input type="hidden" name="mandate_id" value={m.id}/><input type="hidden" name="firm_id" value={m.firm_id??""}/><button className="btn btn-gold btn-small" type="submit">Create Studio matter <ArrowUpRight size={14}/></button></form></div>)}</div>:<div className="jcstudio-empty"><FileCheck2 size={27}/><strong>No active accepted mandates</strong><p>When a client accepts a practitioner or firm mandate in JusticeConnect, the eligible instruction will appear here for conversion.</p><Link href="/dashboard" className="btn btn-outline-dark">Go to JusticeConnect</Link></div>}
    </section>
  </main>;
}
