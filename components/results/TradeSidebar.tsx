'use client';

import { useState, useMemo } from 'react';
import { useAnalysisStore, Trade } from '@/lib/analysisStore';

type FilterType = 'all' | 'buy' | 'sell' | 'wins' | 'losses';

interface TradeSidebarProps {
  activeTrade: number;
  onSelectTrade: (index: number) => void;
  freeLimit?: number;
}

export default function TradeSidebar({ activeTrade, onSelectTrade, freeLimit = 1 }: TradeSidebarProps) {
  const { trades } = useAnalysisStore();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Filter trades based on active filter
  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      switch (activeFilter) {
        case 'buy':
          return trade.side?.toUpperCase() === 'BUY';
        case 'sell':
          return trade.side?.toUpperCase() === 'SELL';
        case 'wins':
          return trade.pnl > 0;
        case 'losses':
          return trade.pnl < 0;
        default:
          return true;
      }
    });
  }, [trades, activeFilter]);

  // Calculate cumulative P&L for visible trades
  const cumulativePnl = useMemo(() => {
    return filteredTrades.reduce((sum, trade) => sum + trade.pnl, 0);
  }, [filteredTrades]);

  // Get session badge based on entry time
  const getSessionBadge = (entryTime: string): string => {
    if (!entryTime) return 'Afternoon';
    const hour = parseInt(entryTime.split(':')[0], 10);
    if (hour < 12) return 'Morning';
    if (hour < 14) return 'Midday';
    return 'Afternoon';
  };

  // Get side badge styling
  const getSideBadgeColor = (side: string): { bg: string; text: string } => {
    const upperSide = side?.toUpperCase();
    if (upperSide === 'BUY') {
      return { bg: 'bg-[var(--green)]', text: 'text-white' };
    }
    return { bg: 'bg-[var(--red)]', text: 'text-white' };
  };

  // Format P&L display
  const formatPnl = (pnl: number): string => {
    const sign = pnl >= 0 ? '+' : '';
    return \`\${sign}₹\${Math.abs(Math.round(pnl)).toLocaleString('en-IN')}\`;
  };

  const isLocked = (index: number): boolean => index >= freeLimit;

  return (
    <div className="hidden md:flex flex-col h-screen bg-[var(--s1)] border-r border-[var(--border)] sticky top-24">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--border)]">
        <h2 className="text-sm font-bold text-[var(--text)] mb-3">
          Trades
          <span className="text-xs text-[var(--text2)] ml-2">
            {filteredTrades.length} order{filteredTrades.length !== 1 ? 's' : ''}
          </span>
        </h2>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'buy', 'sell', 'wins', 'losses'] as FilterType[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={\`px-3 py-1 rounded-full text-xs font-medium transition-colors \${
                activeFilter === filter
                  ? 'bg-[var(--accent)] text-black'
                  : 'bg-[var(--s2)] text-[var(--text2)] hover:bg-[var(--s3)]'
              }\`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Running P&L ticker */}
      <div className="px-5 py-3 bg-[var(--s2)] border-b border-[var(--border)]">
        <div className="text-xs text-[var(--muted)] mb-1">Visible P&L</div>
        <div
          className={\`font-jetbrains-mono font-bold text-lg \${
            cumulativePnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'
          }\`}
        >
          {formatPnl(cumulativePnl)}
        </div>
      </div>

      {/* Scrollable trade list */}
      <div className="flex-1 overflow-y-auto">
        {filteredTrades.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-[var(--muted)]">
            No trades match this filter
          </div>
        ) : (
          filteredTrades.map((trade, idx) => {
            const globalIndex = trades.indexOf(trade);
            const locked = isLocked(globalIndex);
            const sideColors = getSideBadgeColor(trade.side);
            const isActive = activeTrade === globalIndex;

            return (
              <div
                key={idx}
                onClick={() => !locked && onSelectTrade(globalIndex)}
                className={\`px-4 py-3 border-l-4 cursor-pointer transition-colors \${
                  isActive
                    ? 'bg-[var(--s2)] border-l-[var(--accent)]'
                    : 'border-l-transparent hover:bg-[var(--s2)]'
                } \${locked ? 'opacity-50 cursor-not-allowed' : ''}\`}
              >
                {/* Trade number and symbol */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-xs font-bold text-[var(--text)] truncate">
                      #{globalIndex + 1} {trade.symbol}
                    </div>
                  </div>
                  {locked && <span className="text-lg">🔒</span>}
                </div>

                {/* Time and session badge */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-jetbrains-mono text-[var(--text2)]">
                    {trade.entry_time}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--s3)] text-[var(--text2)]">
                    {getSessionBadge(trade.entry_time)}
                  </span>
                </div>

                {/* Side badge */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={\`text-[10px] px-2.5 py-1 rounded-full font-bold \${sideColors.bg} \${sideColors.text}\`}>
                    {trade.side?.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-[var(--text2)]">
                    {trade.quantity} units
                  </span>
                </div>

                {/* P&L and cumulative */}
                <div className="flex justify-between items-end">
                  <div>
                    <div
                      className={\`font-jetbrains-mono font-bold text-sm \${
                        trade.pnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'
                      }\`}
                    >
                      {formatPnl(trade.pnl)}
                    </div>
                    <div className="text-[10px] text-[var(--muted)] mt-1">
                      cumulative {formatPnl(trades.slice(0, globalIndex + 1).reduce((s, t) => s + t.pnl, 0))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
