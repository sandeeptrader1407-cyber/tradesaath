import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center gap-6">
      <div className="text-center mb-2">
        <span className="text-2xl font-bold text-blue-400">TradeSaath</span>
        <p className="text-slate-400 text-sm mt-1">Create your free account</p>
      </div>
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        redirectUrl="/dashboard"
      />
    </main>
  )
}
