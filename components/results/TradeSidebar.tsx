'use client';

import { useState, useMemo } from 'react';
import { useAnalysisStore } from '@/lib/analysisStore';

type FilterType = 'all' | 'buy' | 'sell' | 'wins' | 'losses';

interface TradeSidebarProps {
  activeTrade: number;
  onSelectTrade: (index: number) => void;
  freeLimit?: number;
}

export default function TradeSidebar({ activeTrade, onSelectTrade, freeLimit = 3 }: TradeSidebarProps) {
  const { trades } = useAnalysisStore();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      switch (activeFilter) {
        case 'buy':   return trade.side?.toUpperCase() === 'BUY';
        case 'sell':  return trade.side?.toUpperCase() === 'SELL';
        case 'wins':  return trade.pnl > 0;
        case 'losses':return trade.pnl < 0;
        default:      return true;
      }
    });
  }, [trades, activeFilter]);

  const cumulativePnl = useMemo(() =>
    filteredTrades.reduce((sum, t) => sum + t.pnl, 0),
    [filteredTrades]
  );

  const getSessionBadge = (entryTime: string): string => {
    if (!entryTime) return 'Afternoon';
    const hour = parseInt(entryTime.split(':')[0], 10);
    if (hour < 12) return 'Morning';
    if (hour < 14) return 'Midday';
    return 'Afternoon';
  };

  const formatPnl = (pnl: number): string => {
    const sign = pnl >= 0 ? '+' : '';
    return `${sign}₹${Math.abs(Math.round(pnl)).toLocaleString('en-IN')}`;
  };

  const isLocked = (index: number): boolean => index >= freeLimit;

  return (
    <div className="flex flex-col max-h-[50vh] md:max-h-[80vh]"
      style={{ background: '#FFFFFF', borderRight: '0.5px solid var(--color-border)' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--color-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--color-ink)' }}>
            Trades
          </span>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>
            {filteredTrades.length}
          </span>
        </div>

        {/* Running P&L */}
        <div style={{
          padding: '7px 10px',
          marginBottom: 8,
          borderRadius: 6,
          background: 'var(--color-surface-raised, rgba(248,246,241,.8))',
          border: '0.5px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-sans)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
            Running P&amp;L
          </span>
          <span style={{
            fontSize: 15,
            fontWeight: 500,
            fontFamily: 'var(--font-mono)',
            color: cumulativePnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)',
          }}>
            {formatPnl(cumulativePnl)}
          </span>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'buy', 'sell', 'wins', 'losses'] as FilterType[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              style={{
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontFamily: 'var(--font-sans)',
                fontWeight: 400,
                cursor: 'pointer',
                border: '0.5px solid',
                background: activeFilter === filter ? 'var(--color-ink)' : 'transparent',
                color: activeFilter === filter ? 'var(--color-canvas)' : 'var(--color-muted)',
                borderColor: activeFilter === filter ? 'var(--color-ink)' : 'var(--color-border)',
                transition: 'all 0.1s',
              }}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Trade list */}
      <div className="flex-1 overflow-y-auto">
        {filteredTrades.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--color-muted)', fontFamily: 'var(--font-sans)' }}>
            No trades match this filter
          </div>
        ) : (
          filteredTrades.map((trade, idx) => {
            const globalIndex = trades.indexOf(trade);
            const locked = isLocked(globalIndex);
            const isActive = activeTrade === globalIndex;

            return (
              <div
                key={idx}
                onClick={() => !locked && onSelectTrade(globalIndex)}
                style={{
                  padding: '10px 14px',
                  borderBottom: '0.5px solid var(--color-border)',
                  borderLeft: isActive ? '3px solid var(--color-ink)' : '3px solid transparent',
                  background: isActive ? 'rgba(26,31,46,.03)' : 'transparent',
                  cursor: locked ? 'not-allowed' : 'pointer',
                  opacity: locked ? 0.55 : 1,
                  transition: 'background 0.1s',
                }}
              >
                {/* Symbol and lock */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 400, color: 'var(--color-ink)' }}>
                    #{globalIndex + 1} {trade.symbol}
                  </span>
                  {locked && (
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--color-muted)' }}>locked</span>
                  )}
                </div>

                {/* Time and session */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>
                    {trade.entry_time}
                  </span>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--color-border)', color: 'var(--color-muted)', fontFamily: 'var(--font-sans)' }}>
                    {getSessionBadge(trade.entry_time)}
                  </span>
                </div>

                {/* Side and P&L */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 400,
                    background: trade.side?.toUpperCase() === 'BUY'
                      ? 'rgba(29,158,117,.1)'
                      : 'rgba(192,57,43,.1)',
                    color: trade.side?.toUpperCase() === 'BUY'
                      ? 'var(--color-profit)'
                      : 'var(--color-loss)',
                  }}>
                    {trade.side?.toUpperCase()}
                  </span>
                  <span style={{
                    fontSize: 13,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 500,
                    color: trade.pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)',
                  }}>
                    {formatPnl(trade.pnl)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
