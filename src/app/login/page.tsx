import Link from "next/link";
import { signIn } from "@/app/actions";
import { FormError, FormShell } from "@/components/form-shell";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  return <FormShell title="Welcome back" intro="Sign in to access your legal enquiries, professional workspace and secure messages." footer={<>New to JusticeConnect? <Link href="/register">Create an account</Link></>}>
    <FormError error={params.error} message={params.message}/>
    <form action={signIn} className="stack-form"><label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254}/></label><label>Password<input name="password" type="password" autoComplete="current-password" required/></label><button className="btn btn-navy" type="submit">Sign in securely</button><p className="form-hint">Use the email address associated with your confirmed account.</p></form>
  </FormShell>;
}
