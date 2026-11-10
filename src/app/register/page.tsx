import Link from "next/link";
import { signUp } from "@/app/actions";
import { FormError, FormShell } from "@/components/form-shell";
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
 const { error } = await searchParams;
 return <FormShell title="Create your account" intro="Start with a secure account. You can later create a client profile, practitioner profile or law firm workspace." footer={<>Already registered? <Link href="/login">Sign in</Link></>}>
  <FormError error={error}/><form action={signUp} className="stack-form"><label>Full name<input name="display_name" autoComplete="name" minLength={2} maxLength={160} required/></label><label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required/></label><label>Password<input name="password" type="password" minLength={12} autoComplete="new-password" required/><small>At least 12 characters. Use a unique password.</small></label><label className="check-line"><input type="checkbox" required/> I have read the <Link href="/privacy">privacy information</Link> and understand account verification.</label><button className="btn btn-navy">Create account</button><p className="form-hint">Email confirmation may be required before you can sign in.</p></form>
 </FormShell>;
}
