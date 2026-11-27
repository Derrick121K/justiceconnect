import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function PracticeMattersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  if (!isSupabaseConfigured) redirect("/jcstudio");
  const params = await searchParams;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  let query = db.from("practice_matters").select("id,matter_number,title,client_name,status,priority,due_on,updated_at").order("updated_at", { ascending: false }).limit(100);
  if (params.q?.trim()) query = query.ilike("title", `%${params.q.trim().replaceAll("%", "").replaceAll("_", "\\_")}%`);
  const { data: matters, error } = await query;
  return <main className="jcstudio-page"><header className="jcstudio-page-head"><Link href="/jcstudio"><ArrowLeft size={16}/> JCStudio overview</Link><div><span className="eyebrow dark">PRIVATE PRACTICE WORKSPACE</span><h1>Matter management</h1><p>Internal firm matters are separate from public marketplace enquiries.</p></div><Link href="/jcstudio/matters/new" className="btn btn-gold"><Plus size={15}/> Open matter</Link></header>
    {error ? <div className="jcstudio-notice">The Studio database migration is not available yet. Matter records cannot be loaded.</div> : <><form className="jcstudio-search" method="get"><Search size={16}/><input name="q" defaultValue={params.q} placeholder="Search matter number, title or client"/><button>Search</button></form>
    <section className="jcstudio-panel"><div className="jcstudio-panel-head"><h2>All matters you are authorised to access</h2><span>{matters?.length ?? 0} records</span></div>
      {matters?.length ? <div className="jcstudio-matter-list">{matters.map((m) => <Link href={`/jcstudio/matters/${m.id}`} className="jcstudio-matter-row" key={m.id}><div><small>{m.matter_number} · {m.client_name}</small><strong>{m.title}</strong><span>{m.priority} priority {m.due_on ? "· Due " + m.due_on : ""}</span></div><span className="status-pill">{m.status.replaceAll("_"," ")}</span></Link>)}</div> : <div className="jcstudio-empty"><p>No matters are currently visible to your account.</p><Link href="/jcstudio/matters/new" className="btn btn-gold">Open first matter</Link></div>}
    </section></>}
  </main>;
}
