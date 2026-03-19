export default function JournalPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white px-6 py-16">
      <div className="max-w-3xl mx-auto flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold text-blue-400 mb-2">Trade Journal</h1>
          <p className="text-slate-400">Log your trades, emotions, and reflections to track your psychological growth.</p>
        </div>

        {/* New entry form */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-white">New Entry</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Symbol</label>
              <input className="bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="e.g. NIFTY" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">P&L (₹)</label>
              <input type="number" className="bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="e.g. 2500" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Emotion before trade</label>
            <select className="bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="">Select emotion</option>
              <option>Confident</option>
              <option>Anxious</option>
              <option>FOMO</option>
              <option>Calm</option>
              <option>Greedy</option>
              <option>Fearful</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Reflection / Notes</label>
            <textarea rows={3} className="bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none" placeholder="What did you learn from this trade?" />
          </div>
          <button className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-full transition-colors">
            Save Entry
          </button>
        </div>

        {/* Past entries placeholder */}
        <div className="flex flex-col gap-4">
          <h2 className="font-semibold text-slate-300">Recent Entries</h2>
          <div className="text-slate-500 text-sm text-center py-10 border border-dashed border-white/10 rounded-2xl">
            No journal entries yet. Add your first trade above.
          </div>
        </div>
      </div>
    </main>
  );
}
