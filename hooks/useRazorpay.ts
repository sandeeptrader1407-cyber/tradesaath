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

  const pay = useCallback(async ({ plan = 'single', email, onSuccess, onError }: RazorpayOptions = {}) => {
    setLoading(true)

    try {
      // Load Razorpay script
      const loaded = await loadRazorpayScript()
      if (!loaded) {
        onError?.('Could not load payment gateway. Please check your internet connection and try again.')
        setLoading(false)
        return
      }

      // Create order
      let res: Response
      try {
        res = await fetch('/api/payments/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan }),
        })
      } catch {
        onError?.('Network error. Could not connect to payment server. Please try again.')
        setLoading(false)
        return
      }

      let orderData: Record<string, unknown>
      try {
        orderData = await res.json()
      } catch {
        onError?.('Payment server returned an unexpected response. Please try again.')
        setLoading(false)
        return
      }

      if (!res.ok) {
        const errMsg = (orderData.error as string) || 'Failed to create order'
        // Never expose technical error details
        if (/auth|key|secret/i.test(errMsg)) {
          onError?.('Payment service temporarily unavailable. Please try again later.')
        } else {
          onError?.(errMsg)
        }
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
          // Verify payment on our server
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
              onError?.(verifyData.error || 'Payment verification failed. Your payment is safe — plan will activate shortly. Contact support if it doesn\'t.')
            }
          } catch {
            onError?.('Payment received but verification pending. Your plan will be activated within a few minutes. If not, contact support.')
          }
          setLoading(false)
        },
        modal: {
          ondismiss: () => {
            // User closed the Razorpay modal — reset loading state cleanly
            setLoading(false)
          },
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch {
      onError?.('Something went wrong with the payment. Please try again.')
      setLoading(false)
    }
  }, [])

  return { pay, loading, paid, setPaid }
}
