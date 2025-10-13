'use client'

import { Stock } from '@/app/page'
import { updateTargetsAndStops } from '@/lib/target-detector'

const STORAGE_KEY = 'stockTracker_positions'
const LAST_UPDATED_KEY = 'stockTracker_lastUpdated'

class ClientStockService {
  // Get all stocks from localStorage
  getStocks(): Stock[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (!data) return []
      
      const stocks = JSON.parse(data)
      return Array.isArray(stocks) ? stocks : []
    } catch (error) {
      console.error('Error reading stocks from localStorage:', error)
      return []
    }
  }

  // Save all stocks to localStorage
  saveStocks(stocks: Stock[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stocks))
      localStorage.setItem(LAST_UPDATED_KEY, new Date().toISOString())
    } catch (error) {
      console.error('Error saving stocks to localStorage:', error)
      throw new Error('Failed to save stocks to local storage')
    }
  }

  // Get a single stock by ID
  getStockById(id: string): Stock | null {
    const stocks = this.getStocks()
    return stocks.find(stock => stock.id === id) || null
  }

  // Add a new stock
  addStock(stockData: Omit<Stock, 'id' | 'createdAt' | 'updatedAt'>): Stock {
    const stocks = this.getStocks()
    const newStock: Stock = {
      ...stockData,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    stocks.push(newStock)
    this.saveStocks(stocks)
    return newStock
  }

  // Update an existing stock
  updateStock(id: string, updates: Partial<Omit<Stock, 'id' | 'createdAt'>>): Stock | null {
    const stocks = this.getStocks()
    const index = stocks.findIndex(stock => stock.id === id)
    
    if (index === -1) return null
    
    const existingStock = stocks[index]
    let finalUpdates = { ...updates }
    
    // Check if callout price is being changed
    if ('calloutPrice' in updates && updates.calloutPrice !== existingStock.calloutPrice) {
      console.log(`📊 Callout price changed for ${existingStock.ticker}: ${existingStock.calloutPrice} → ${updates.calloutPrice}`)
      
      // Recalculate percentSinceCallout with new callout price
      const newCalloutPrice = updates.calloutPrice || 0
      const newPercentSinceCallout = newCalloutPrice !== 0 ? 
        ((existingStock.currentPrice - newCalloutPrice) / newCalloutPrice) * 100 : 0
      
      finalUpdates.percentSinceCallout = newPercentSinceCallout
      
      // Reset target achievement statuses and dates when callout price changes
      finalUpdates.target1Hit = ''
      finalUpdates.target1Date = undefined
      finalUpdates.target2Hit = ''
      finalUpdates.target2Date = undefined
      finalUpdates.target3Hit = ''
      finalUpdates.target3Date = undefined
      finalUpdates.buyZoneHit = ''
      finalUpdates.percentMade = 0
      
      // Re-run target detection with new callout price
      const stockWithNewCallout = { ...existingStock, ...finalUpdates }
      const updatedStock = updateTargetsAndStops(stockWithNewCallout, existingStock.currentPrice)
      
      // Use the fully recalculated values
      finalUpdates = {
        ...finalUpdates,
        target1Hit: updatedStock.target1Hit,
        target2Hit: updatedStock.target2Hit,
        target3Hit: updatedStock.target3Hit,
        buyZoneHit: updatedStock.buyZoneHit,
        target1Date: updatedStock.target1Date,
        target2Date: updatedStock.target2Date,
        target3Date: updatedStock.target3Date,
        percentMade: updatedStock.percentMade
      }
    }
    
    stocks[index] = {
      ...stocks[index],
      ...finalUpdates,
      updatedAt: new Date().toISOString()
    }
    
    this.saveStocks(stocks)
    return stocks[index]
  }

  // Delete a stock
  deleteStock(id: string): boolean {
    const stocks = this.getStocks()
    const filteredStocks = stocks.filter(stock => stock.id !== id)
    
    if (filteredStocks.length === stocks.length) return false
    
    this.saveStocks(filteredStocks)
    return true
  }

  // Clear all stocks
  clearAllStocks(): void {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(LAST_UPDATED_KEY)
  }

  // Get last updated timestamp
  getLastUpdated(): Date | null {
    try {
      const timestamp = localStorage.getItem(LAST_UPDATED_KEY)
      return timestamp ? new Date(timestamp) : null
    } catch (error) {
      console.error('Error reading last updated timestamp:', error)
      return null
    }
  }

  // Import stocks from data (for Excel import)
  importStocks(stocksData: any[], clearExisting: boolean = false): { imported: number; errors: number } {
    let existingStocks = clearExisting ? [] : this.getStocks()
    let imported = 0
    let errors = 0

    for (const stockData of stocksData) {
      try {
        const newStock: Stock = {
          id: this.generateId(),
          date: stockData.date || '', // New date field
          ticker: stockData.ticker || '',
          calloutPrice: parseFloat(stockData.calloutPrice) || 0,
          target1: stockData.target1 ? parseFloat(stockData.target1) : undefined,
          target2: stockData.target2 ? parseFloat(stockData.target2) : undefined,
          target3: stockData.target3 ? parseFloat(stockData.target3) : undefined,
          stopLoss: stockData.stopLoss ? parseFloat(stockData.stopLoss) : undefined,
          buyZoneLow: stockData.buyZoneLow ? parseFloat(stockData.buyZoneLow) : undefined,
          buyZoneHigh: stockData.buyZoneHigh ? parseFloat(stockData.buyZoneHigh) : undefined,
          currentPrice: parseFloat(stockData.currentPrice) || 0,
          percentSinceCallout: parseFloat(stockData.percentSinceCallout) || 0,
          percentMade: parseFloat(stockData.percentMade) || 0,
          target1Hit: stockData.target1Hit || '',
          target2Hit: stockData.target2Hit || '',
          target3Hit: stockData.target3Hit || '',
          stopHit: stockData.stopHit || '',
          buyZoneHit: stockData.buyZoneHit || '',
          target1Date: stockData.target1Date || undefined,
          target2Date: stockData.target2Date || undefined,
          target3Date: stockData.target3Date || undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }

        if (newStock.ticker && newStock.calloutPrice > 0) {
          // Run target detection on imported stock
          const updatedStock = updateTargetsAndStops(newStock, newStock.currentPrice)
          existingStocks.push(updatedStock)
          imported++
        } else {
          errors++
        }
      } catch (error) {
        console.error('Error importing stock:', error)
        errors++
      }
    }

    this.saveStocks(existingStocks)
    return { imported, errors }
  }

  // Export stocks for download
  exportStocks(): Stock[] {
    return this.getStocks()
  }

  // Generate unique ID
  private generateId(): string {
    return `stock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// Export singleton instance
export const clientStockService = new ClientStockService()