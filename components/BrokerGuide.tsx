'use client'

import { useState } from 'react'

const GUIDES = [
  {
    category: 'Indian Brokers',
    brokers: [
      { name: 'Zerodha', steps: 'Console → Reports → Tradebook → Download CSV' },
      { name: 'Angel One', steps: 'My Account → Trade Book → Download' },
      { name: 'Upstox', steps: 'Reports → Trade History → Export CSV' },
      { name: 'Groww', steps: 'Orders → Trade History → Download' },
      { name: 'Dhan', steps: 'Reports → Trade Book → Download CSV' },
      { name: '5paisa', steps: 'Reports → Trade Book → Export' },
      { name: 'ICICI Direct', steps: 'Portfolio → Equity → Trade Book → Download' },
      { name: 'Kotak', steps: 'Reports → Trade Book → Download CSV' },
      { name: 'Fyers', steps: 'Reports → Trade Book → Download CSV' },
    ],
  },
  {
    category: 'US Brokers',
    brokers: [
      { name: 'Interactive Brokers', steps: 'Reports → Flex Queries → Trade Confirmation → CSV' },
      { name: 'TD Ameritrade', steps: 'History & Statements → Transactions → Export' },
      { name: 'Robinhood', steps: 'Account → Statements → Download CSV' },
      { name: 'Webull', steps: 'More → Order History → Export' },
      { name: 'Fidelity', steps: 'Accounts → History → Download' },
    ],
  },
  {
    category: 'Forex',
    brokers: [
      { name: 'MetaTrader 4/5', steps: 'Account History tab → Right-click → Save as Report (CSV)' },
      { name: 'cTrader', steps: 'History → Export → CSV' },
    ],
  },
  {
    category: 'Crypto',
    brokers: [
      { name: 'Binance', steps: 'Orders → Trade History → Export' },
      { name: 'WazirX', steps: 'Funds → Transaction History → Export' },
      { name: 'CoinDCX', steps: 'Portfolio → Trade History → Download' },
      { name: 'Bybit', steps: 'Orders → Trade History → Export CSV' },
    ],
  },
]

export default function BrokerGuide() {
  const [open, setOpen] = useState(false)

  return (
    <div className="broker-guide">
      <button
        className="broker-guide-toggle"
        onClick={() => setOpen(!open)}
      >
        <span>Need help downloading your trade file?</span>
        <span className={`faq-arrow${open ? ' open' : ''}`}>&#9662;</span>
      </button>
      {open && (
        <div className="broker-guide-body">
          {GUIDES.map((cat) => (
            <div key={cat.category} className="broker-guide-cat">
              <div className="broker-guide-cat-name">{cat.category}</div>
              <div className="broker-guide-list">
                {cat.brokers.map((b) => (
                  <div key={b.name} className="broker-guide-item">
                    <span className="broker-guide-name">{b.name}</span>
                    <span className="broker-guide-steps">{b.steps}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 8 }}>
            For any other broker: download your trade book / trade history as CSV. We need at minimum: date, symbol, buy/sell, price, and quantity.
          </div>
        </div>
      )}
    </div>
  )
}
