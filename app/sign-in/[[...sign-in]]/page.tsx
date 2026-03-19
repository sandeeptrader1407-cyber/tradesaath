import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center gap-6">
      <div className="text-center mb-2">
        <span className="text-2xl font-bold text-blue-400">TradeSaath</span>
        <p className="text-slate-400 text-sm mt-1">Sign in to your account</p>
      </div>
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        redirectUrl="/dashboard"
      />
    </main>
  )
}
