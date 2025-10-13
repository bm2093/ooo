'use client'

import { useState, useEffect } from 'react'

export function useLocalStorageLastUpdated() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const updateLastUpdated = () => {
    try {
      const timestamp = localStorage.getItem('stockTracker_lastUpdated')
      if (timestamp) {
        setLastUpdated(new Date(timestamp))
      } else {
        setLastUpdated(null)
      }
    } catch (error) {
      console.error('Error reading last updated from localStorage:', error)
      setLastUpdated(null)
    }
  }

  // Initialize and listen for storage changes
  useEffect(() => {
    updateLastUpdated()

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'stockTracker_lastUpdated') {
        updateLastUpdated()
      }
    }

    // Listen for storage events (for cross-tab synchronization)
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  return { lastUpdated, updateLastUpdated }
}