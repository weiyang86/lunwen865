import { ClientLoginForm } from '@/components/client/client-login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string; mode?: string }>;
}) {
  const params = await searchParams;
  return (
    <ClientLoginForm
      redirect={params.redirect || '/'}
      sessionError={params.error === 'session'}
      initialMode={params.mode === 'register' ? 'register' : 'login'}
    />
  );
}
