const stats = [
  { label: "Total Trades", value: "—" },
  { label: "Win Rate", value: "—" },
  { label: "Avg P&L", value: "—" },
  { label: "Discipline Score", value: "—" },
];

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white px-6 py-16">
      <div className="max-w-5xl mx-auto flex flex-col gap-10">
        <div>
          <h1 className="text-3xl font-bold text-blue-400 mb-1">Dashboard</h1>
          <p className="text-slate-400">Your trading performance & psychology overview.</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-1">
              <span className="text-xs text-slate-400">{s.label}</span>
              <span className="text-2xl font-bold text-white">{s.value}</span>
            </div>
          ))}
        </div>

        {/* Chart placeholder */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 min-h-[220px]">
          <span className="text-slate-500 text-sm">Equity curve chart — coming soon</span>
          <a href="/upload" className="text-blue-400 text-sm hover:underline">Upload trades to see your data</a>
        </div>

        {/* Psychology breakdown placeholder */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 flex flex-col gap-4">
          <h2 className="font-semibold text-white">Psychology Breakdown</h2>
          <p className="text-slate-500 text-sm">Upload and analyse your trades to see your bias scores here.</p>
          <a href="/upload" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-full text-center transition-colors">
            Get Your Report
          </a>
        </div>
      </div>
    </main>
  );
}
