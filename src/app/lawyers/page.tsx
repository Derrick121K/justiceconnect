import Link from "next/link";
import { MapPin, Search, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { firstRelated, type Related } from "@/lib/types/relations";

type NamedRelation = Related<{ name: string | null; slug?: string | null }>;
type PractitionerDirectoryRow = {
  id: string;
  public_name: string;
  practitioner_type: string;
  biography: string | null;
  years_experience: number | null;
  accepts_remote_matters: boolean;
  practitioner_service_areas: Array<{
    provinces: NamedRelation;
    municipalities: NamedRelation;
    places: NamedRelation;
  }> | null;
  practitioner_practice_areas: Array<{
    practice_areas: NamedRelation;
  }> | null;
};

function practitionerLocationText(practitioner: PractitionerDirectoryRow): string {
  return (practitioner.practitioner_service_areas ?? [])
    .flatMap((serviceArea) => [
      firstRelated(serviceArea.provinces)?.name,
      firstRelated(serviceArea.municipalities)?.name,
      firstRelated(serviceArea.places)?.name,
    ])
    .filter((name): name is string => Boolean(name))
    .join(" ")
    .toLowerCase();
}

function practitionerPracticeText(practitioner: PractitionerDirectoryRow): string {
  return (practitioner.practitioner_practice_areas ?? [])
    .map((link) => {
      const practiceArea = firstRelated(link.practice_areas);
      return `${practiceArea?.name ?? ""} ${practiceArea?.slug ?? ""}`;
    })
    .join(" ")
    .toLowerCase();
}

export default async function LawyersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; location?: string; practice?: string }>;
}) {
  const { q = "", location = "", practice = "" } = await searchParams;
  let rows: PractitionerDirectoryRow[] = [];

  if (isSupabaseConfigured) {
    const db = await createClient();
    const { data } = await db
      .from("practitioners")
      .select(
        "id,public_name,practitioner_type,biography,years_experience,accepts_remote_matters,practitioner_service_areas(province_id,provinces(name),municipalities(name),places(name)),practitioner_practice_areas(practice_areas(name,slug))",
      )
      .eq("verification_status", "verified")
      .eq("profile_visibility", true)
      .order("public_name")
      .limit(100);

    rows = ((data ?? []) as PractitionerDirectoryRow[]).filter((practitioner) => {
      const queryText = `${practitioner.public_name} ${practitioner.biography ?? ""}`.toLowerCase();
      const queryMatches = !q || queryText.includes(q.toLowerCase());
      const locationText = practitionerLocationText(practitioner);
      const locationMatches =
        !location ||
        locationText.includes(location.toLowerCase()) ||
        practitioner.accepts_remote_matters;
      const practiceMatches =
        !practice || practitionerPracticeText(practitioner).includes(practice.toLowerCase());
      return queryMatches && locationMatches && practiceMatches;
    });
  }

  return (
    <main className="directory-page">
      <SiteHeader />
      <section className="directory-hero">
        <div className="wrap">
          <div className="eyebrow">SOUTH AFRICAN LEGAL NETWORK</div>
          <h1>
            Find the right <em>legal professional.</em>
          </h1>
          <p>
            Search verified practitioner profiles. Verification status is displayed separately
            from qualifications and experience.
          </p>
          <form className="directory-search" action="/lawyers">
            <label>
              <Search size={17} />
              <input name="q" defaultValue={q} placeholder="Name or legal practice" />
            </label>
            <label>
              <MapPin size={17} />
              <input name="location" defaultValue={location} placeholder="City, town or province" />
            </label>
            <button className="btn btn-gold">Search</button>
          </form>
        </div>
      </section>

      <section className="wrap directory-results">
        <div className="section-heading">
          <div>
            <div className="eyebrow dark">PRACTITIONER DIRECTORY</div>
            <h2>{rows.length} matching profiles</h2>
          </div>
          <span className="privacy-chip">
            <ShieldCheck size={14} /> Verified profiles only
          </span>
        </div>

        {!isSupabaseConfigured ? (
          <div className="empty-state">
            <p>
              Directory is ready to connect. Configure Supabase and populate verified
              practitioner profiles to publish results.
            </p>
          </div>
        ) : rows.length ? (
          <div className="profile-grid">
            {rows.map((practitioner) => {
              const practiceNames = (practitioner.practitioner_practice_areas ?? [])
                .map((link) => firstRelated(link.practice_areas)?.name)
                .filter((name): name is string => Boolean(name));
              return (
                <article className="profile-card" key={practitioner.id}>
                  <div className="profile-avatar">
                    {practitioner.public_name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="profile-verified">
                    <ShieldCheck size={14} /> LPC verification recorded
                  </div>
                  <h3>
                    <Link href={`/lawyers/${practitioner.id}`}>{practitioner.public_name}</Link>
                  </h3>
                  <p className="profile-type">
                    {practitioner.practitioner_type.replaceAll("_", " ")}
                  </p>
                  <p>
                    {practitioner.biography ||
                      "This practitioner has not added a public biography."}
                  </p>
                  <div className="profile-meta">
                    {practitioner.years_experience ?? 0} years&apos; experience · {practitioner.accepts_remote_matters
                      ? "Remote matters accepted"
                      : "Contact for availability"}
                  </div>
                  <small className="form-hint">{practiceNames.join(" · ")}</small>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <Search size={28} />
            <b>No verified profiles found</b>
            <p>Try another search, or check again as more practitioners complete verification.</p>
            <Link href="/professionals/join" className="text-link">
              Are you a practitioner? Join the network →
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
