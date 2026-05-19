import SignupForm from './_components/signup-form';

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-start justify-center bg-muted/30">
      <div className="w-full max-w-sm mx-auto mt-16 px-4 pb-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">SalesTrack</h1>
          <p className="text-muted-foreground mt-1">Create your account</p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}
