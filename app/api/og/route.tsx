import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundColor: '#0f1729',
          padding: '60px 80px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Left content */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#00cf82',
                marginRight: '12px',
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
              lineHeight: 1.2,
              marginBottom: '24px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span>AI Trading Psychology</span>
            <span>Analysis</span>
          </div>

          {/* Subtext */}
          <div style={{ fontSize: '20px', color: '#8b95a8', marginBottom: '40px', display: 'flex' }}>
            Upload your tradebook. Get your Decision Quality Score in 60 seconds.
          </div>

          {/* Feature pills */}
          <div style={{ display: 'flex' }}>
            <div
              style={{
                padding: '8px 20px',
                borderRadius: '20px',
                border: '1px solid #00cf82',
                fontSize: '14px',
                fontWeight: 600,
                color: '#00cf82',
                marginRight: '12px',
              }}
            >
              DQS Score
            </div>
            <div
              style={{
                padding: '8px 20px',
                borderRadius: '20px',
                border: '1px solid #00cf82',
                fontSize: '14px',
                fontWeight: 600,
                color: '#00cf82',
                marginRight: '12px',
              }}
            >
              Pattern Detection
            </div>
            <div
              style={{
                padding: '8px 20px',
                borderRadius: '20px',
                border: '1px solid #00cf82',
                fontSize: '14px',
                fontWeight: 600,
                color: '#00cf82',
              }}
            >
              AI Coaching
            </div>
          </div>

          {/* Broker badge */}
          <div
            style={{
              marginTop: '24px',
              fontSize: '14px',
              color: '#8b95a8',
              backgroundColor: '#1a2236',
              padding: '6px 16px',
              borderRadius: '8px',
              display: 'flex',
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
              borderRadius: '110px',
              border: '10px solid #1a5c3f',
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
