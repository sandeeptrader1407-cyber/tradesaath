import Navbar from '@/components/Navbar'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
      <Navbar />

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-28 gap-6">
        <span className="text-xs font-semibold tracking-widest uppercase text-blue-400 bg-blue-400/10 px-4 py-1.5 rounded-full">
          AI Trading Psychology Coach
        </span>
        <h1 className="text-5xl sm:text-6xl font-extrabold leading-tight max-w-3xl">
          Trade Smarter.<br />
          <span className="text-blue-400">Think Clearer.</span>
        </h1>
        <p className="text-slate-400 max-w-xl text-lg">
          Upload your trade journal. Get deep AI-powered psychological insights to fix emotional
          biases, improve discipline, and grow as a trader.
        </p>
        <div className="flex gap-4 mt-4">
          <a
            href="/upload"
            className="bg-blue-600 hover:bg-blue-500 px-7 py-3 rounded-full font-semibold transition-colors"
          >
            Analyse My Trades
          </a>
          <a
            href="/pricing"
            className="border border-white/20 hover:border-white/40 px-7 py-3 rounded-full font-semibold transition-colors"
          >
            See Pricing
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 px-8 pb-24">
        {[
          { title: 'Upload Trades', desc: 'Import your broker statement or CSV trade log in seconds.', href: '/upload' },
          { title: 'AI Insights', desc: 'Get a personalised psychology report — FOMO, revenge trading, overconfidence & more.', href: '/results' },
          { title: 'Trade Journal', desc: 'Log emotions, rate trades, and track your growth over time.', href: '/journal' },
        ].map((f) => (
          <a
            key={f.title}
            href={f.href}
            className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-6 transition-colors"
          >
            <h3 className="text-lg font-semibold mb-2 text-white">{f.title}</h3>
            <p className="text-slate-400 text-sm">{f.desc}</p>
          </a>
        ))}
      </section>
    </main>
  )
}
