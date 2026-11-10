import Link from "next/link";
import { Scale, ShieldCheck } from "lucide-react";

export function FormShell({ title, intro, children, footer }: { title: string; intro: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return <main className="auth-page"><div className="auth-card"><Link href="/" className="auth-brand"><span className="brand-mark"><Scale size={22}/></span><b>JusticeConnect</b></Link><div className="auth-kicker"><ShieldCheck size={14}/> PRIVATE SOUTH AFRICAN LEGAL NETWORK</div><h1>{title}</h1><p className="auth-intro">{intro}</p>{children}{footer && <div className="auth-footer">{footer}</div>}</div></main>;
}

export function FormError({ error, message }: { error?: string; message?: string }) {
  return <>{error && <p className="form-alert error" role="alert">{error}</p>}{message && <p className="form-alert success" role="status">{message}</p>}</>;
}
