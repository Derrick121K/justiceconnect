import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { firstRelated, type Related } from "@/lib/types/relations";

type NamedRelation = Related<{ name: string | null }>;
type PractitionerProfileRow = {
  id: string;
  public_name: string;
  practitioner_type: string;
  biography: string | null;
  years_experience: number | null;
  accepts_remote_matters: boolean;
  practitioner_practice_areas: Array<{
    practice_areas: Related<{ name: string | null }>;
  }> | null;
  practitioner_service_areas: Array<{
    provinces: NamedRelation;
    municipalities: NamedRelation;
    places: NamedRelation;
  }> | null;
};

export default async function LawyerProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isSupabaseConfigured) notFound();

  const db = await createClient();
  const { data } = await db
    .from("practitioners")
    .select(
      "id,public_name,practitioner_type,biography,years_experience,accepts_remote_matters,practitioner_practice_areas(practice_areas(name)),practitioner_service_areas(provinces(name),municipalities(name),places(name))",
    )
    .eq("id", id)
    .eq("verification_status", "verified")
    .eq("profile_visibility", true)
    .maybeSingle();
  if (!data) notFound();

  const profile = data as PractitionerProfileRow;
  const areas = (profile.practitioner_practice_areas ?? [])
    .map((link) => firstRelated(link.practice_areas)?.name)
    .filter((name): name is string => Boolean(name));
  const locations = (profile.practitioner_service_areas ?? [])
    .flatMap((serviceArea) => [
      firstRelated(serviceArea.provinces)?.name,
      firstRelated(serviceArea.municipalities)?.name,
      firstRelated(serviceArea.places)?.name,
    ])
    .filter((name): name is string => Boolean(name));

  return (
    <main className="directory-page">
      <SiteHeader />
      <section className="wrap directory-results">
        <Link href="/lawyers" className="text-link">
          <ArrowLeft size={15} /> Back to directory
        </Link>
        <article className="profile-detail">
          <div className="profile-avatar">{profile.public_name.slice(0, 1).toUpperCase()}</div>
          <div className="profile-verified">
            <ShieldCheck size={14} /> Professional verification recorded
          </div>
          <h1>{profile.public_name}</h1>
          <p className="profile-type">{profile.practitioner_type.replaceAll("_", " ")}</p>
          <p>{profile.biography || "No public biography has been provided."}</p>
          <h2>Practice areas</h2>
          <div className="tag-list">
            {areas.map((area) => <span key={area}>{area}</span>)}
          </div>
          <h2>Service coverage</h2>
          <p>
            {locations.length
              ? Array.from(new Set(locations)).join(" · ")
              : "Coverage details available on enquiry"}
          </p>
          <p>
            {profile.years_experience ?? 0} years&apos; experience · {profile.accepts_remote_matters
              ? "Remote matters accepted"
              : "Remote availability not listed"}
          </p>
          <div className="form-alert">
            A verification indicator is not a guarantee of competence, good standing,
            availability or legal outcome. Confirm suitability and engagement terms directly.
          </div>
          <Link href="/register" className="btn btn-gold">Create an account to connect</Link>
        </article>
      </section>
    </main>
  );
}
