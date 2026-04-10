'use client';

import { useState } from 'react';

interface PaywallGateProps {
  tradeCount: number;
}

export default function PaywallGate({ tradeCount }: PaywallGateProps) {
  const [selectedPlan, setSelectedPlan] = useState(0);

  const plans = [
    {
      name: 'Single Report',
      price: '99',
      period: 'one-time',
      description: 'all trades',
      badge: null,
    },
    {
      name: 'Pro Monthly',
      price: '799',
      period: '/month',
      description: 'unlimited',
      badge: null,
    },
    {
      name: 'Pro Yearly',
      price: '499',
      period: '/month',
      description: 'unlimited',
      badge: 'Save 38%',
    },
  ];

  return (
    <div
      className="rounded-xl p-8 border border-[var(--border)]"
      style={{
        background: `linear-gradient(135deg, rgba(157, 122, 247, 0.08) 0%, var(--bg) 100%)`,
      }}
    >
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-fraunces text-[var(--text)] mb-3">
          Unlock {tradeCount - 1} More Trades
        </h2>
        <p className="text-sm md:text-base text-[var(--text2)]">
          Get detailed analysis for all your trades, psychology coaching, and actionable insights to improve your trading performance.
        </p>
      </div>

      {/* Price Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {plans.map((plan, idx) => {
          const isSelected = selectedPlan === idx;

          return (
            <div
              key={idx}
              onClick={() => setSelectedPlan(idx)}
              className={`rounded-xl bg-[var(--s2)] p-5 cursor-pointer transition-all border-2 ${
                isSelected ? 'border-[var(--accent)]' : 'border-[var(--border)]'
              }`}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="mb-3">
                  <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-[var(--green)] bg-opacity-20 text-[var(--green)]">
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Plan Name */}
              <h3 className="text-base font-outfit font-semibold text-[var(--text)] mb-2">
                {plan.name}
              </h3>

              {/* Price */}
              <div className="mb-3">
                <span className="text-2xl font-jetbrains-mono font-bold text-[var(--accent)]">
                  ₹{plan.price}
                </span>
                <span className="text-xs text-[var(--text2)] ml-1">
                  {plan.period}
                </span>
              </div>

              {/* Description */}
              <p className="text-xs text-[var(--text2)]">
                {plan.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* CTA Button */}
      <div className="flex justify-center">
        <button
          style={{
            backgroundColor: 'var(--accent)',
            color: 'var(--bg)',
          }}
          className="font-semibold rounded-xl px-8 py-3 transition-all hover:opacity-90 active:scale-95"
        >
          Unlock Full Report →
        </button>
      </div>
    </div>
  );
}
