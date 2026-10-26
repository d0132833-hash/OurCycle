'use client'

import { useEffect } from 'react'

/** Registers the app-shell service worker with automatic update handling. */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  newWorker.postMessage({ action: 'skipWaiting' })
                }
              })
            }
          })
        })
        .catch(() => {
          /* PWA is progressive — never block the app on SW failures */
        })
    }
  }, [])
  return null
}
