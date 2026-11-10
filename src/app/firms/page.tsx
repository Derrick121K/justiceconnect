import Link from "next/link";
import { Building2, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type FirmDirectoryRow = {
  id: string;
  legal_name: string;
  trading_name: string | null;
  description: string | null;
  website_url: string | null;
};

export default async function FirmsPage() {
  let firms: FirmDirectoryRow[] = [];
  if (isSupabaseConfigured) {
    const db = await createClient();
    const { data } = await db
      .from("law_firms")
      .select("id,legal_name,trading_name,description,website_url")
      .eq("verification_status", "verified")
      .eq("status", "active")
      .order("legal_name")
      .limit(60);
    firms = (data ?? []) as FirmDirectoryRow[];
  }

  return (
    <main className="directory-page">
      <SiteHeader />
      <section className="directory-hero">
        <div className="wrap">
          <div className="eyebrow">LAW FIRM DIRECTORY</div>
          <h1>
            Professional practices.<br />
            <em>Connected nationwide.</em>
          </h1>
          <p>Explore verified South African law firms and their public practice information.</p>
          <Link className="btn btn-gold" href="/firms/new">Register your firm</Link>
        </div>
      </section>
      <section className="wrap directory-results">
        <div className="section-heading">
          <div>
            <div className="eyebrow dark">VERIFIED FIRMS</div>
            <h2>{firms.length} firms listed</h2>
          </div>
          <span className="privacy-chip"><ShieldCheck size={14} /> Verified organisations</span>
        </div>
        {firms.length ? (
          <div className="profile-grid">
            {firms.map((firm) => (
              <article className="profile-card" key={firm.id}>
                <div className="profile-avatar"><Building2 /></div>
                <h3>{firm.trading_name || firm.legal_name}</h3>
                <p>{firm.description || "A verified legal practice on JusticeConnect."}</p>
                {firm.website_url && (
                  <a href={firm.website_url} rel="noopener noreferrer" target="_blank">
                    Visit firm website ↗
                  </a>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Building2 size={28} />
            <b>Firm directory is being established</b>
            <p>Verified firms will appear here after compliance review.</p>
            <Link href="/firms/new" className="text-link">Register a law firm →</Link>
          </div>
        )}
      </section>
    </main>
  );
}
