import LoginForm from './_components/login-form';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-start justify-center bg-muted/30">
      <div className="w-full max-w-sm mx-auto mt-24 px-4">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">SalesTrack</h1>
          <p className="text-muted-foreground mt-1">Sign in to SalesTrack</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
