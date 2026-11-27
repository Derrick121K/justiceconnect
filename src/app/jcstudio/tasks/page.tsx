import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { updatePracticeTask } from "@/app/jcstudio/actions";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function JCStudioTasksPage({searchParams}:{searchParams:Promise<{updated?:string;error?:string}>}) {
  const params=await searchParams;
  if(!isSupabaseConfigured) redirect("/jcstudio");
  const db=await createClient(); const {data:{user}}=await db.auth.getUser(); if(!user) redirect("/login");
  const {data:tasks,error}=await db.from("practice_tasks").select("id,matter_id,title,status,priority,due_at,task_type").eq("assigned_to",user.id).order("due_at",{ascending:true}).limit(100);
  const matterIds=[...new Set((tasks??[]).map(t=>t.matter_id))];
  const {data:matters}=matterIds.length?await db.from("practice_matters").select("id,matter_number,title").in("id",matterIds):{data:[]};
  const matterMap=new Map((matters??[]).map(m=>[m.id,m]));
  return <main className="jcstudio-page"><header className="jcstudio-page-head"><Link href="/jcstudio"><ArrowLeft size={16}/> JCStudio overview</Link><div><span className="eyebrow dark">WORK ALLOCATION</span><h1>My tasks</h1><p>Tasks assigned to your secure practice workspace account.</p></div></header>
    {params.updated&&<p className="form-alert success">Task status updated.</p>}{params.error&&<p className="form-alert error">{params.error}</p>}
    <section className="jcstudio-panel"><div className="jcstudio-panel-head"><h2>Assigned tasks</h2><span>{tasks?.length??0} items</span></div>
      {error?<p className="jcstudio-notice">Task data is not available yet. Confirm the JCStudio database migration is applied.</p>:tasks?.length?<div className="jcstudio-task-list">{tasks.map(t=>{const matter=matterMap.get(t.matter_id);return <div className="jcstudio-task" key={t.id}><div><b>{t.title}</b><small>{matter?.matter_number??"Matter"} · {matter?.title??"Private file"} · {t.priority} · {t.due_at?new Date(t.due_at).toLocaleDateString("en-ZA"):"No deadline"}</small></div><form action={updatePracticeTask}><input type="hidden" name="task_id" value={t.id}/><input type="hidden" name="matter_id" value={t.matter_id}/><select name="status" defaultValue={t.status} aria-label={`Status for ${t.title}`}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="done">Done</option><option value="cancelled">Cancelled</option></select><button className="text-button-dark" type="submit">Update</button>{matter&&<Link href={`/jcstudio/matters/${matter.id}`} aria-label="Open matter"><CheckCircle2 size={17}/></Link>}</form></div>})}</div>:<div className="jcstudio-empty"><CheckCircle2 size={24}/><strong>No tasks assigned</strong><p>Tasks allocated to you across your matters will appear here.</p></div>}
    </section>
  </main>;
}
