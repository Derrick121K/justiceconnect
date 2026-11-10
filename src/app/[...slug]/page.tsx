import Link from "next/link";
import { ArrowLeft, Scale, ShieldCheck } from "lucide-react";

const labels: Record<string, string> = {
  lawyers: "Find a legal professional", firms: "Law firm directory", "practice-areas": "Legal practice areas",
  "cases/new": "Submit a legal enquiry", login: "Sign in to JusticeConnect", register: "Create your account",
  "professionals/join": "Join as a legal professional", "firm-solutions": "Solutions for law firms",
  verification: "Professional verification", locations: "Explore South African locations",
  about: "About JusticeConnect", privacy: "Privacy information", terms: "Terms of use",
};

export default async function ModuleLanding({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = slug.join("/");
  const title = labels[path] ?? slug.map((part) => part.replaceAll("-", " ")).join(" / ");
  return <main className="module-page">
    <div className="module-card">
      <div className="module-brand"><Scale size={24}/><span>JusticeConnect</span></div>
      <div className="module-rule"/>
      <div className="module-kicker"><ShieldCheck size={14}/> SOUTH AFRICAN LEGAL NETWORK</div>
      <h1>{title}</h1>
      <p>This module is included in the JusticeConnect implementation plan. Its secure workflow is being built and will be enabled after identity, privacy and access-control checks are completed.</p>
      <p className="module-note">No legal matter has been submitted and no account action has been performed on this page.</p>
      <Link className="module-back" href="/"><ArrowLeft size={16}/> Return to JusticeConnect</Link>
    </div>
  </main>;
}
