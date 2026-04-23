import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return new Response('Unauthorized', { status: 401 })

    const sb = getSupabaseAdmin()

    const { data: sessions } = await sb
      .from('trade_sessions')
      .select('trade_date, detected_broker, trade_count, net_pnl, win_rate, win_count, loss_count, detected_market, created_at')
      .eq('user_id', userId)
      .order('trade_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    const header = 'Session Date,Broker,Market,Trades,Net PnL,Win Rate,Wins,Losses,Created At\n'

    const rows = (sessions ?? []).map((s) => {
      const cols = [
        s.trade_date || '',
        (s.detected_broker || 'Unknown').replace(/,/g, ';'),
        (s.detected_market || '').replace(/,/g, ';'),
        s.trade_count ?? 0,
        Number(s.net_pnl ?? 0).toFixed(2),
        Number(s.win_rate ?? 0).toFixed(2),
        s.win_count ?? 0,
        s.loss_count ?? 0,
        s.created_at || '',
      ]
      return cols.join(',')
    })

    const csv = header + rows.join('\n')
    const filename = `tradesaath-sessions-${new Date().toISOString().split('T')[0]}.csv`

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return new Response('Export failed', { status: 500 })
  }
}
