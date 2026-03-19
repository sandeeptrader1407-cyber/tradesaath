export default function UploadPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-xl bg-white/5 border border-white/10 rounded-2xl p-10 flex flex-col gap-6">
        <h1 className="text-3xl font-bold text-blue-400">Upload Your Trades</h1>
        <p className="text-slate-400">Upload a CSV or broker statement and let TradeSaath analyse your trading psychology.</p>

        <div className="border-2 border-dashed border-white/20 rounded-xl p-10 flex flex-col items-center gap-3 text-slate-400 hover:border-blue-400 transition-colors cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12V4m0 0L8 8m4-4l4 4" />
          </svg>
          <span className="text-sm">Drag & drop your file here, or click to browse</span>
          <span className="text-xs text-slate-500">Supports CSV, XLSX, PDF</span>
        </div>

        <button className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-full transition-colors">
          Analyse Trades
        </button>
      </div>
    </main>
  );
}
