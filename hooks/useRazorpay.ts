'use client'

import { useState, useCallback } from 'react'

interface RazorpayOptions {
  plan?: string
  email?: string
  onSuccess?: () => void
  onError?: (error: string) => void
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void }
  }
}

/** Check if we're in Razorpay test mode based on the public key */
export function isRazorpayTestMode(): boolean {
  const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || ''
  return key.startsWith('rzp_test_')
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export function useRazorpay() {
  const [loading, setLoading] = useState(false)
  const [paid, setPaid] = useState(false)

  const testMode = isRazorpayTestMode()

  const pay = useCallback(async ({ plan = 'single', email, onSuccess, onError }: RazorpayOptions = {}) => {
    setLoading(true)

    try {
      // Load Razorpay script
      const loaded = await loadRazorpayScript()
      if (!loaded) {
        onError?.('Failed to load Razorpay. Please check your internet connection.')
        setLoading(false)
        return
      }

      // Create order
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const orderData = await res.json()

      if (!res.ok) {
        onError?.(orderData.error || 'Failed to create order')
        setLoading(false)
        return
      }

      // Open Razorpay checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'TradeSaath',
        description: orderData.description,
        order_id: orderData.orderId,
        prefill: {
          email: email || orderData.prefillEmail || '',
        },
        theme: {
          color: '#3ee8c4',
          backdrop_color: 'rgba(10, 14, 23, 0.85)',
        },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          // Verify payment on our server (works on localhost — no webhook needed)
          try {
            const verifyRes = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...response, plan }),
            })
            const verifyData = await verifyRes.json()

            if (verifyRes.ok && verifyData.success) {
              setPaid(true)
              onSuccess?.()
            } else {
              onError?.(verifyData.error || 'Payment verification failed')
            }
          } catch {
            onError?.('Payment verification failed. Please contact support.')
          }
          setLoading(false)
        },
        modal: {
          ondismiss: () => {
            setLoading(false)
          },
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch {
      onError?.('Something went wrong. Please try again.')
      setLoading(false)
    }
  }, [])

  return { pay, loading, paid, setPaid, testMode }
}
