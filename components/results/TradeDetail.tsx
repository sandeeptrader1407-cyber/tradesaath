'use client';

import { useState, useMemo } from 'react';
import { useAnalysisStore, Trade } from '@/lib/analysisStore';

interface TradeDetailProps {
  activeTrade: number;
  freeLimit?: number;
}

function parseMarkdownBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/);
  return parts.map((part, idx) => {
    if (idx % 2 === 0) {
      return part;
    }
    return <strong key={idx}>{part}</strong>;
  });
}

interface DetailSection {
  key: string;
  label: string;
  icon: string;
  content?: string;
  borderColor: string;
}

export default function TradeDetail({ activeTrade, freeLimit = 1 }: TradeDetailProps) {
  const { trades } = useAnalysisStore();
  const [expandedTradeIndex, setExpandedTradeIndex] = useState<number>(0);
  const [tradeNotes, setTradeNotes] = useState<Record<number, string>>({});

  const isLocked = (index: number): boolean => index >= freeLimit;

  // Get tag styling
  const getTagStyling = (tag?: string): { bg: string; color: string; label: string } => {
    switch (tag?.toLowerCase()) {
      case 'win':
        return { bg: 'bg-[var(--green)]', color: 'text-white', label: 'Win' };
      case 'fomo':
        return { bg: 'bg-[var(--gold)]', color: 'text-black', label: 'FOMO' };
      case 'rvg':
        return { bg: 'bg-[#f597c0]', color: 'text-white', label: 'RVG' };
      case 'avg':
        return { bg: 'bg-[var(--red)]', color: 'text-white', label: 'AVG' };
      case 'pnc':
        return { bg: 'bg-[var(--purple)]', color: 'text-white', label: 'PNC' };
      case 'vs':
        return { bg: 'bg-[#ff9500]', color: 'text-white', label: 'VS' };
      default:
        return { bg: 'bg-[var(--s3)]', color: 'text-[var(--text2)]', label: tag || 'Unknown' };
    }
  };

  // Get side badge styling
  const getSideBadgeColor = (side: string): { bg: string; text: string } => {
    const upperSide = side?.toUpperCase();
    if (upperSide === 'BUY') {
      return { bg: 'bg-[var(--green)]', text: 'text-white' };
    }
    return { bg: 'bg-[var(--red)]', text: 'text-white' };
  };

  // Format P&L
  const formatPnl = (pnl: number): string => {
    const sign = pnl >= 0 ? '+' : '';
    return `${sign}₹${Math.abs(Math.round(pnl)).toLocaleString('en-IN')}`;
  };

  const getDetailSections = (trade: Trade): DetailSection[] => {
    return [
      {
        key: 'quick_summary',
        label: 'Quick Summary',
        icon: '✓',
        content: trade.quick_summary,
        borderColor: 'border-[var(--accent)]',
      },
      {
        key: 'technical_analysis',
        label: 'Technical Analysis',
        icon: '📊',
        content: trade.technical_analysis,
        borderColor: 'border-[var(--blue)]',
      },
      {
        key: 'psychology_coaching',
        label: 'Psychology Coaching',
        icon: '🧠',
        content: trade.psychology_coaching,
        borderColor: 'border-[var(--purple)]',
      },
      {
        key: 'counterfactual',
        label: 'Counterfactual',
        icon: '🔄',
        content: trade.counterfactual,
        borderColor: 'border-[var(--accent)]',
      },
    ];
  };

  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-[var(--muted)]">
        <p>No trades to display</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {trades.map((trade, idx) => {
        const locked = isLocked(idx);
        const isExpanded = expandedTradeIndex === idx;
        const sideColors = getSideBadgeColor(trade.side);
        const tagStyling = getTagStyling(trade.tag);
        const detailSections = getDetailSections(trade);

        return (
          <div key={idx} className="mb-4">
            {/* Trade card header (clickable) */}
            <div
              onClick={() => !locked && setExpandedTradeIndex(isExpanded ? -1 : idx)}
              className={`bg-[var(--s1)] border border-[var(--border)] rounded-xl p-4 cursor-pointer transition-all ${
                locked ? 'cursor-not-allowed' : 'hover:border-[var(--border2)]'
              }`}
            >
              <div className="flex items-center justify-between">
                {/* Left: Trade number, time, symbol, side */}
                <div className="flex items-center gap-4 flex-1">
                  <div className="min-w-fit">
                    <div className="text-xs font-bold text-[var(--text)] mb-1">
                      Trade #{idx + 1}
                    </div>
                    <div className="text-xs font-jetbrains-mono text-[var(--text2)]">
                      {trade.entry_time}
                    </div>
                  </div>

                  <div className="h-8 w-px bg-[var(--border)]" />

                  <div>
                    <div className="text-sm font-bold text-[var(--text)] mb-2">
                      {trade.symbol}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] px-3 py-1 rounded-full font-bold ${sideColors.bg} ${sideColors.text}`}>
                        {trade.side?.toUpperCase()}
                      </span>
                      <span className="text-xs text-[var(--text2)]">
                        Qty: {trade.quantity}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: P&L, tag, chevron */}
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div
                      className={`font-fraunces font-bold text-2xl ${
                        trade.pnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'
                      }`}
                    >
                      {formatPnl(trade.pnl)}
                    </div>
                    {trade.tag && (
                      <div className={`text-[10px] px-2.5 py-1 rounded-full mt-2 font-bold ${tagStyling.bg} ${tagStyling.color}`}>
                        {tagStyling.label}
                      </div>
                    )}
                  </div>

                  {/* Chevron */}
                  <div className="text-[var(--text2)] text-xl">
                    {isExpanded ? '▾' : '▸'}
                  </div>
                </div>
              </div>
            </div>

            {/* Expanded details */}
            <div
              className="overflow-hidden transition-all duration-300"
              style={{
                maxHeight: isExpanded ? '2000px' : '0',
                opacity: isExpanded ? 1 : 0,
              }}
            >
              <div className={`bg-[var(--s1)] border border-t-0 border-[var(--border)] rounded-b-xl p-4 relative ${locked ? 'blur-sm' : ''}`}>
                {/* Detail sections */}
                <div className="space-y-4">
                  {detailSections.map((section) => {
                    if (!section.content) return null;
                    return (
                      <div key={section.key} className={`pl-4 py-3 border-l-4 ${section.borderColor}`}>
                        <h3 className="text-xs font-bold text-[var(--text)] mb-2">
                          {section.icon} {section.label}
                        </h3>
                        <div className="text-sm text-[var(--text2)] leading-relaxed">
                          {parseMarkdownBold(section.content)}
                        </div>
                      </div>
                    );
                  })}

                  {/* Trade Notes textarea */}
                  <div className="mt-4">
                    <label className="text-xs font-bold text-[var(--text)] mb-2 block">
                      📝 Trade Notes
                    </label>
                    <textarea
                      disabled={locked}
                      placeholder="Your notes for this trade…"
                      value={tradeNotes[idx] || ''}
                      onChange={(e) =>
                        setTradeNotes({ ...tradeNotes, [idx]: e.target.value })
                      }
                      className="w-full text-sm bg-[var(--s2)] border border-[var(--border)] rounded-lg p-3 text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--border2)] resize-none"
                      rows={3}
                    />
                  </div>
                </div>

                {/* Locked overlay */}
                {locked && (
                  <div className="absolute inset-0 rounded-b-xl bg-black/30 flex flex-col items-center justify-center gap-2">
                    <div className="text-3xl">🔒</div>
                    <div className="text-sm font-bold text-white text-center">
                      Upgrade to unlock
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
