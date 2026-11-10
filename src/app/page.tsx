import Link from "next/link";
import {
  ArrowRight,
  Building2,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  FileText,
  Gavel,
  Landmark,
  MapPin,
  Menu,
  Scale,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";

const practices = [
  "Family & divorce",
  "Labour & employment",
  "Criminal defence",
  "Commercial disputes",
  "Property & conveyancing",
  "Personal injury",
  "Immigration",
  "Wills & estates",
];

const practiceIcons = [
  Users,
  BriefcaseBusiness,
  Gavel,
  Building2,
  Landmark,
  ShieldCheck,
  FileText,
  Scale,
];

const provinces = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
];

const steps = [
  {
    n: "01",
    title: "Tell us what you need",
    text: "Share a few details about your legal issue through a private, guided intake.",
  },
  {
    n: "02",
    title: "Find relevant professionals",
    text: "Explore practitioners by practice area, province, location and service preference.",
  },
  {
    n: "03",
    title: "Connect with confidence",
    text: "Review professional credentials and choose who you want to contact.",
  },
];

export default function Home() {
  return (
    <main>
      <div className="topline">
        <span>JUSTICECONNECT</span>
        <span>LEGAL SERVICES, CONNECTED ACROSS SOUTH AFRICA</span>
        <span>EN · ZAR</span>
      </div>

      <header className="nav wrap">
        <a className="brand" href="#top">
          <span className="brand-mark"><Scale size={22} /></span>
          <span>
            Justice<span>Connect</span>
            <small> SOUTH AFRICA</small>
          </span>
        </a>
        <nav className="nav-links">
          <a href="#find">Find a lawyer</a>
          <a href="#how">How it works</a>
          <a href="#firms">For law firms</a>
          <a href="#resources">Legal resources</a>
        </nav>
        <div className="nav-actions">
          <Link className="login" href="/login">Log in</Link>
          <Link className="btn btn-gold btn-small" href="/register">
            Join JusticeConnect <ArrowRight size={15} />
          </Link>
        </div>
        <details className="mobile-nav">
          <summary aria-label="Open navigation"><Menu /></summary>
          <nav>
            <Link href="/lawyers">Find a lawyer</Link>
            <a href="#how">How it works</a>
            <Link href="/firms">For law firms</Link>
            <Link href="/practice-areas">Legal resources</Link>
            <Link href="/login">Log in</Link>
          </nav>
        </details>
      </header>

      <section className="hero" id="top">
        <div className="hero-glow" />
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <div className="eyebrow"><span /> A MORE CONNECTED LEGAL LANDSCAPE</div>
            <h1>
              When the law matters,<br />
              <em>start with the right</em><br />
              connection.
            </h1>
            <p className="hero-lede">
              Find legal professionals. Connect with law firms. Take the next step with
              clarity — wherever you are in South Africa.
            </p>
            <div className="hero-ctas">
              <a className="btn btn-gold" href="#find">
                Find legal assistance <ArrowRight size={17} />
              </a>
              <Link className="btn btn-outline" href="/professionals/join">
                I&apos;m a legal professional
              </Link>
            </div>
            <div className="trust-row">
              <ShieldCheck size={17} />
              <span>Professional verification pathways</span>
              <i />
              <span>Nationwide discovery</span>
            </div>
          </div>

          <div className="hero-panel">
            <div className="panel-top">
              <span>YOUR SEARCH STARTS HERE</span>
              <span className="live-dot">● Nationwide</span>
            </div>
            <div className="panel-title">Find the legal support you need.</div>
            <form className="search-card" action="/lawyers" method="get">
              <label>
                <span>WHAT DO YOU NEED HELP WITH?</span>
                <div className="field">
                  <Search size={18} />
                  <input name="q" placeholder="e.g. Unfair dismissal, divorce..." />
                </div>
              </label>
              <label>
                <span>WHERE DO YOU NEED HELP?</span>
                <div className="field">
                  <MapPin size={18} />
                  <input name="location" placeholder="City, town or suburb" />
                  <ChevronDown size={16} />
                </div>
              </label>
              <button className="btn btn-navy search-submit" type="submit">
                Search legal professionals <ArrowRight size={16} />
              </button>
              <p className="privacy-note">
                <ShieldCheck size={14} /> Your initial search is private. Your details are not published.
              </p>
            </form>
            <div className="panel-foot">
              <span><b>9</b> provinces</span>
              <span><b>1</b> connected legal network</span>
              <span><b>∞</b> possibilities</span>
            </div>
          </div>
        </div>
        <div className="hero-bottom wrap">
          <span>BUILT FOR SOUTH AFRICA</span>
          <div className="province-strip">
            {provinces.map((province) => <span key={province}>{province}</span>)}
          </div>
        </div>
      </section>

      <section className="section wrap" id="find">
        <div className="section-heading">
          <div>
            <div className="eyebrow dark">FIND THE RIGHT EXPERTISE</div>
            <h2>Legal support for <em>real life.</em></h2>
          </div>
          <Link className="text-link" href="/practice-areas">
            Explore all practice areas <ArrowRight size={16} />
          </Link>
        </div>
        <div className="practice-grid">
          {practices.map((practice, index) => {
            const PracticeIcon = practiceIcons[index] ?? Scale;
            return (
              <Link
                className="practice-card"
                href={`/lawyers?practice=${encodeURIComponent(practice)}`}
                key={practice}
              >
                <span className="practice-icon"><PracticeIcon /></span>
                <span>{practice}</span>
                <ArrowRight size={16} />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="how-section" id="how">
        <div className="wrap how-grid">
          <div>
            <div className="eyebrow">A CLEARER WAY FORWARD</div>
            <h2>
              From uncertainty<br />
              to <em>the next step.</em>
            </h2>
            <p className="muted">
              Legal matters can feel complicated. JusticeConnect makes it easier to
              understand your options and find professionals whose expertise and location
              fit your needs.
            </p>
            <Link href="/cases/new" className="btn btn-gold">
              Submit a legal enquiry <ArrowRight size={16} />
            </Link>
          </div>
          <div className="steps">
            {steps.map((step) => (
              <div className="step" key={step.n}>
                <span>{step.n}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
                <CheckCircle2 size={19} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section wrap" id="firms">
        <div className="firm-banner">
          <div className="firm-art">
            <Scale size={94} strokeWidth={0.8} />
            <div className="art-ring" />
          </div>
          <div className="firm-copy">
            <div className="eyebrow dark">FOR LEGAL PROFESSIONALS</div>
            <h2>
              Build your practice.<br />
              <em>Broaden your reach.</em>
            </h2>
            <p>
              Give your practice a professional home. Manage your profile, showcase your
              areas of expertise and connect with people seeking legal assistance.
            </p>
            <div className="firm-actions">
              <Link className="btn btn-navy" href="/professionals/join">
                Create a professional profile <ArrowRight size={16} />
              </Link>
              <Link className="text-link" href="/firms">Explore firm solutions</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="province-section" id="resources">
        <div className="wrap">
          <div className="section-heading">
            <div>
              <div className="eyebrow dark">ONE COUNTRY. NINE PROVINCES.</div>
              <h2>Legal discovery, <em>nationwide.</em></h2>
              <p className="muted">
                Search by province, city or town. Find local professionals or connect remotely.
              </p>
            </div>
            <Link className="text-link" href="/locations">
              Explore locations <ArrowRight size={16} />
            </Link>
          </div>
          <div className="province-grid">
            {provinces.map((province, index) => (
              <Link
                href={`/locations/${province.toLowerCase().replaceAll(" ", "-")}`}
                key={province}
              >
                <span>0{index + 1}</span>
                {province}
                <ArrowRight size={15} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="closing">
        <div className="wrap closing-inner">
          <Scale size={30} />
          <h2>
            Good legal outcomes begin<br />
            with <em>informed connections.</em>
          </h2>
          <p>Take the first step towards finding the right legal support.</p>
          <Link className="btn btn-gold" href="/cases/new">
            Get started <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap footer-main">
          <div className="brand footer-brand">
            <span className="brand-mark"><Scale size={21} /></span>
            <span>
              Justice<span>Connect</span>
              <small> SOUTH AFRICA</small>
            </span>
          </div>
          <div>
            <b>Explore</b>
            <Link href="/lawyers">Find a lawyer</Link>
            <Link href="/firms">Law firms</Link>
            <Link href="/practice-areas">Practice areas</Link>
          </div>
          <div>
            <b>For professionals</b>
            <Link href="/professionals/join">Join the network</Link>
            <Link href="/firm-solutions">Firm solutions</Link>
            <Link href="/verification">Verification</Link>
          </div>
          <div>
            <b>Platform</b>
            <Link href="/about">About us</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms of use</Link>
          </div>
        </div>
        <div className="wrap footer-bottom">
          <span>© 2026 JusticeConnect. A JMSE KAPA HOLDINGS (PTY) LTD platform.</span>
          <span>Designed for South Africa · English (South Africa)</span>
        </div>
      </footer>
    </main>
  );
}
