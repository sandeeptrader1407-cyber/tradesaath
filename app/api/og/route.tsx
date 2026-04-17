import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          background: 'linear-gradient(135deg, #0a0f1e 0%, #141c30 100%)',
          padding: '60px 80px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Left content */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#00cf82',
              }}
            />
            <span style={{ fontSize: '32px', fontWeight: 700, color: '#ffffff' }}>TradeSaath</span>
          </div>

          {/* Headline */}
          <div
            style={{
              fontSize: '48px',
              fontWeight: 700,
              color: '#ffffff',
              lineHeight: 1.15,
              marginBottom: '24px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span>AI Trading Psychology</span>
            <span>Analysis</span>
          </div>

          {/* Subtext */}
          <div style={{ fontSize: '20px', color: '#8b95a8', marginBottom: '40px', lineHeight: 1.5 }}>
            Upload your tradebook. Get your Decision Quality Score in 60 seconds.
          </div>

          {/* Feature pills */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {['DQS Score', 'Pattern Detection', 'AI Coaching'].map((label) => (
              <div
                key={label}
                style={{
                  padding: '8px 20px',
                  borderRadius: '20px',
                  border: '1px solid rgba(0,207,130,0.4)',
                  background: 'rgba(0,207,130,0.08)',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#00cf82',
                }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Broker badge */}
          <div
            style={{
              marginTop: '24px',
              fontSize: '14px',
              color: '#8b95a8',
              background: 'rgba(255,255,255,0.05)',
              padding: '6px 16px',
              borderRadius: '8px',
              display: 'flex',
              width: 'fit-content',
            }}
          >
            Works with 21+ Brokers
          </div>
        </div>

        {/* Right: DQS circle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '280px',
          }}
        >
          <div
            style={{
              width: '220px',
              height: '220px',
              borderRadius: '50%',
              border: '10px solid rgba(0,207,130,0.2)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: '64px', fontWeight: 700, color: '#ffffff' }}>65</span>
            <span style={{ fontSize: '16px', fontWeight: 500, color: '#8b95a8' }}>DQS Score</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
