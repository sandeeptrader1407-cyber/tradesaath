export default function ResultsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white px-6 py-16">
      <div className="max-w-3xl mx-auto flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold text-blue-400 mb-2">Your Psychology Report</h1>
          <p className="text-slate-400">AI analysis of your trading behaviour and emotional patterns.</p>
        </div>

        {/* Placeholder insight cards */}
        {[
          { label: "FOMO", score: 72, desc: "You frequently entered trades late after a breakout, suggesting fear of missing out." },
          { label: "Revenge Trading", score: 45, desc: "Moderate tendency to increase position size after a losing trade." },
          { label: "Overconfidence", score: 60, desc: "Win streaks correlate with oversized positions that hurt your overall P&L." },
          { label: "Discipline Score", score: 55, desc: "Your adherence to your trading plan needs improvement." },
        ].map((item) => (
          <div key={item.label} className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-white">{item.label}</span>
              <span className="text-blue-400 font-bold">{item.score}/100</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2 mb-3">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${item.score}%` }} />
            </div>
            <p className="text-slate-400 text-sm">{item.desc}</p>
          </div>
        ))}

        <a href="/journal" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-full text-center transition-colors">
          Go to Journal
        </a>
      </div>
    </main>
  );
}
