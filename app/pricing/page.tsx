const plans = [
  {
    name: "Free",
    price: "₹0",
    period: "forever",
    features: ["1 trade analysis/month", "Basic psychology report", "Trade journal (10 entries)"],
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Pro",
    price: "₹499",
    period: "per month",
    features: ["Unlimited trade analyses", "Deep psychology report", "Unlimited journal", "Emotion tracking", "Priority support"],
    cta: "Start Pro",
    highlight: true,
  },
  {
    name: "Elite",
    price: "₹1499",
    period: "per month",
    features: ["Everything in Pro", "1-on-1 AI coaching session", "Custom bias alerts", "Advanced dashboard", "Early access to features"],
    cta: "Go Elite",
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold mb-3">Simple, Transparent Pricing</h1>
          <p className="text-slate-400">Choose the plan that fits your trading journey.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-8 flex flex-col gap-5 border ${
                plan.highlight
                  ? "bg-blue-600/20 border-blue-500"
                  : "bg-white/5 border-white/10"
              }`}
            >
              {plan.highlight && (
                <span className="text-xs font-bold tracking-widest uppercase text-blue-400 bg-blue-400/10 px-3 py-1 rounded-full self-start">
                  Most Popular
                </span>
              )}
              <h2 className="text-xl font-bold">{plan.name}</h2>
              <div>
                <span className="text-4xl font-extrabold">{plan.price}</span>
                <span className="text-slate-400 ml-2 text-sm">/{plan.period}</span>
              </div>
              <ul className="flex flex-col gap-2 text-sm text-slate-300">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-blue-400">✓</span> {f}
                  </li>
                ))}
              </ul>
              <button
                className={`mt-auto py-3 rounded-full font-semibold transition-colors ${
                  plan.highlight
                    ? "bg-blue-600 hover:bg-blue-500 text-white"
                    : "border border-white/20 hover:border-white/40"
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
