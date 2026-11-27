import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileText, Plus, ShieldCheck } from "lucide-react";
import { createPracticeNote, createPracticeTask, updatePracticeTask } from "@/app/jcstudio/actions";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function PracticeMatterDetailPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;created?:string;converted?:string;note?:string;task?:string}>}) {
  const {id}=await params; const query=await searchParams;
  if(!isSupabaseConfigured) redirect("/jcstudio");
  const db=await createClient(); const {data:{user}}=await db.auth.getUser(); if(!user) redirect("/login");
  const {data:matter}=await db.from("practice_matters").select("id,matter_number,title,client_name,client_email,practice_area,confidential_description,status,priority,confidentiality,due_on,opened_on,firm_id,created_at").eq("id",id).maybeSingle();
  if(!matter) notFound();
  const [{data:notes},{data:tasks},{data:firm}] = await Promise.all([
    db.from("practice_matter_notes").select("id,note_type,body,created_at,author_user_id").eq("matter_id",id).order("created_at",{ascending:false}).limit(30),
    db.from("practice_tasks").select("id,title,status,priority,due_at,assigned_to,task_type").eq("matter_id",id).order("due_at",{ascending:true}).limit(30),
    matter.firm_id ? db.from("law_firms").select("legal_name").eq("id",matter.firm_id).maybeSingle() : Promise.resolve({data:null}),
  ]);
  return <main className="jcstudio-page"><header className="jcstudio-page-head"><Link href="/jcstudio/matters"><ArrowLeft size={16}/> All matters</Link><div><span className="eyebrow dark">{matter.matter_number} · {firm?.legal_name ?? "Independent practice"}</span><h1>{matter.title}</h1><p>{matter.client_name} {matter.client_email ? "· "+matter.client_email : ""}</p></div><span className="status-pill">{matter.status.replaceAll("_"," ")}</span></header>
    {(query.error||query.created||query.converted||query.note||query.task)&&<p className="form-alert success">{query.error ?? (query.converted?"Accepted mandate converted into a private practice matter.":query.created?"Private practice matter created.":query.note?"Internal note added.":"Task created.")}</p>}
    <div className="jcstudio-detail-grid"><section className="jcstudio-panel"><div className="jcstudio-panel-head"><h2>Matter information</h2><span className="status-pill">{matter.priority} priority</span></div><div className="jcstudio-detail-facts"><div><small>CLIENT</small><b>{matter.client_name}</b></div><div><small>PRACTICE AREA</small><b>{matter.practice_area}</b></div><div><small>OPENED</small><b>{matter.opened_on}</b></div><div><small>TARGET DATE</small><b>{matter.due_on ?? "Not set"}</b></div><div><small>CONFIDENTIALITY</small><b>{matter.confidentiality}</b></div><div><small>MATTER STATUS</small><b>{matter.status.replaceAll("_"," ")}</b></div></div>{matter.confidential_description&&<div className="jcstudio-description"><small>INTERNAL DESCRIPTION</small><p>{matter.confidential_description}</p></div>}<p className="jcstudio-form-privacy"><ShieldCheck size={15}/> Internal matter record. Access is enforced by database row-level security.</p></section>
      <section className="jcstudio-panel"><div className="jcstudio-panel-head"><h2>Tasks</h2><span>{tasks?.length??0}</span></div>
        <form action={createPracticeTask} className="jcstudio-inline-form"><input type="hidden" name="matter_id" value={id}/><label>Task title<input name="title" required minLength={2} maxLength={200} placeholder="Add a task"/></label><div className="form-two"><label>Priority<select name="priority" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label>Due date<input name="due_date" type="date"/></label></div><button className="btn btn-gold" type="submit"><Plus size={14}/> Add task</button></form>
        <div className="jcstudio-task-list">{tasks?.map(t=><div className="jcstudio-task" key={t.id}><div><b>{t.title}</b><small>{t.priority} · {t.due_at?new Date(t.due_at).toLocaleDateString("en-ZA"):"No due date"}</small></div><form action={updatePracticeTask}><input type="hidden" name="task_id" value={t.id}/><input type="hidden" name="matter_id" value={id}/><select name="status" defaultValue={t.status} aria-label={`Status for ${t.title}`}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="done">Done</option><option value="cancelled">Cancelled</option></select><button className="text-button-dark" type="submit">Save</button></form></div>)}</div>
      </section>
      <section className="jcstudio-panel jcstudio-notes-panel"><div className="jcstudio-panel-head"><h2>Internal matter notes</h2><span>{notes?.length??0}</span></div>
        <form action={createPracticeNote} className="jcstudio-inline-form"><input type="hidden" name="matter_id" value={id}/><label>Note type<select name="note_type" defaultValue="attendance"><option value="attendance">Attendance note</option><option value="research">Research</option><option value="strategy">Strategy</option><option value="client_instruction">Client instruction</option><option value="internal">Internal</option></select></label><label>Note<textarea name="body" rows={4} required maxLength={30000} placeholder="Add a confidential internal note"/></label><button className="btn btn-gold" type="submit"><Plus size={14}/> Save note</button></form>
        <div className="jcstudio-note-list">{notes?.map(n=><article key={n.id}><small>{n.note_type.replaceAll("_"," ")} · {new Date(n.created_at).toLocaleString("en-ZA")}</small><p>{n.body}</p></article>)}</div>
      </section>
    </div>
  </main>;
}
