'use client'

import { useEffect } from 'react'

/** Registers the app-shell service worker (production builds only). */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* PWA is progressive — never block the app on SW failures */
      })
    }
  }, [])
  return null
}
