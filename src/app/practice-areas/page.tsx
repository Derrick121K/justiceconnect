import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type PracticeAreaRow = {
  id: string;
  name: string;
  slug: string;
};

export default async function PracticeAreas() {
  let areas: PracticeAreaRow[] = [];
  if (isSupabaseConfigured) {
    const db = await createClient();
    const { data } = await db
      .from("practice_areas")
      .select("id,name,description,slug")
      .eq("is_active", true)
      .order("sort_order");
    areas = (data ?? []) as PracticeAreaRow[];
  }

  return (
    <main className="directory-page">
      <SiteHeader />
      <section className="directory-hero">
        <div className="wrap">
          <div className="eyebrow">LEGAL SERVICES</div>
          <h1>
            Find expertise for <em>your matter.</em>
          </h1>
          <p>Explore legal practice areas recognised across South Africa.</p>
        </div>
      </section>
      <section className="wrap directory-results">
        <div className="practice-grid">
          {areas.map((area) => (
            <Link
              className="practice-card"
              href={`/lawyers?practice=${encodeURIComponent(area.slug)}`}
              key={area.id}
            >
              <span>{area.name}</span>
              <span>→</span>
            </Link>
          ))}
        </div>
        {!areas.length && (
          <div className="empty-state">
            Practice areas will appear after the database migrations and seed data are installed.
          </div>
        )}
      </section>
    </main>
  );
}
