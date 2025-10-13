import { NextRequest, NextResponse } from 'next/server'
import { localStorageService } from '@/lib/local-storage'
import { getTradingViewPrice } from '@/lib/tradingview-scraper'

async function getStockPrice(ticker: string): Promise<number> {
  try {
    // Get current price from TradingView
    const price = await getTradingViewPrice(ticker)
    return price
  } catch (error) {
    console.error(`Error fetching price for ${ticker}:`, error)
    throw error
  }
}

function updateTargetsAndStops(stock: any, currentPrice: number) {
  const {
    calloutPrice,
    target1,
    target2,
    target3,
    stopLoss,
    target1Hit,
    target2Hit,
    target3Hit,
    stopHit
  } = stock

  let updatedStock = { ...stock }
  
  // Calculate percent since callout
  const percentSinceCallout = calloutPrice !== 0 ? ((currentPrice - calloutPrice) / calloutPrice) * 100 : 0
  updatedStock.percentSinceCallout = percentSinceCallout
  updatedStock.currentPrice = currentPrice

  // Parse current hit status
  const hasT1Hit = target1Hit === 'YES'
  const hasT2Hit = target2Hit === 'YES'
  const hasT3Hit = target3Hit === 'YES'
  const hasAnyHit = hasT1Hit || hasT2Hit || hasT3Hit
  const hasAllHit = hasT1Hit && hasT2Hit && hasT3Hit
  const stopHitStatus = stopHit === 'YES'
  const stopDeactivated = stopHit === 'X'

  // Reset targets if price falls below target and was previously hit
  if (hasT1Hit && target1 && currentPrice < target1) {
    updatedStock.target1Hit = ''
    updatedStock.target1Date = undefined
  }
  
  if (hasT2Hit && target2 && currentPrice < target2) {
    updatedStock.target2Hit = ''
    updatedStock.target2Date = undefined
  }
  
  if (hasT3Hit && target3 && currentPrice < target3) {
    updatedStock.target3Hit = ''
    updatedStock.target3Date = undefined
  }

  // Recalculate after potential resets
  const newHasT1Hit = updatedStock.target1Hit === 'YES'
  const newHasT2Hit = updatedStock.target2Hit === 'YES'
  const newHasT3Hit = updatedStock.target3Hit === 'YES'
  const newHasAnyHit = newHasT1Hit || newHasT2Hit || newHasT3Hit

  let newHit = false
  let percentMade = 0
  let updatePercentMade = false

  // Check Target 1
  if (target1 && !newHasT1Hit && !stopHitStatus && currentPrice >= target1) {
    console.log(`🎯 Target 1 HIT for ${stock.ticker}: ${currentPrice} >= ${target1}`)
    updatedStock.target1Hit = 'YES'
    if (!updatedStock.target1Date) {
      updatedStock.target1Date = new Date().toISOString().split('T')[0]
    }
    newHit = true
    percentMade = ((target1 - calloutPrice) / calloutPrice) * 100
    updatePercentMade = true
  }

  // Check Target 2
  if (target2 && !newHasT2Hit && !stopHitStatus && currentPrice >= target2) {
    console.log(`🎯 Target 2 HIT for ${stock.ticker}: ${currentPrice} >= ${target2}`)
    updatedStock.target2Hit = 'YES'
    if (!updatedStock.target2Date) {
      updatedStock.target2Date = new Date().toISOString().split('T')[0]
    }
    newHit = true
    percentMade = ((target2 - calloutPrice) / calloutPrice) * 100
    updatePercentMade = true
  }

  // Check Target 3
  if (target3 && !newHasT3Hit && !stopHitStatus && currentPrice >= target3) {
    console.log(`🎯 Target 3 HIT for ${stock.ticker}: ${currentPrice} >= ${target3}`)
    updatedStock.target3Hit = 'YES'
    if (!updatedStock.target3Date) {
      updatedStock.target3Date = new Date().toISOString().split('T')[0]
    }
    newHit = true
    percentMade = ((target3 - calloutPrice) / calloutPrice) * 100
    updatePercentMade = true
  }

  // Handle Stop Loss
  if (stopLoss && !stopHitStatus && !stopDeactivated && currentPrice <= stopLoss) {
    updatedStock.stopHit = 'YES'
    percentMade = ((stopLoss - calloutPrice) / calloutPrice) * 100
    updatePercentMade = true
    // Set all targets to N/A since stop was hit
    if (target1) updatedStock.target1Hit = 'N/A'
    if (target2) updatedStock.target2Hit = 'N/A'
    if (target3) updatedStock.target3Hit = 'N/A'
  }

  // Set NO for targets that exist but aren't hit (only if no stop loss)
  if (!updatedStock.stopHit || updatedStock.stopHit === 'N/A') {
    if (target1 && !updatedStock.target1Hit) {
      updatedStock.target1Hit = 'NO'
      console.log(`📊 Target 1 NO for ${stock.ticker}: ${currentPrice} < ${target1}`)
    }
    if (target2 && !updatedStock.target2Hit) {
      updatedStock.target2Hit = 'NO'
      console.log(`📊 Target 2 NO for ${stock.ticker}: ${currentPrice} < ${target2}`)
    }
    if (target3 && !updatedStock.target3Hit) {
      updatedStock.target3Hit = 'NO'
      console.log(`📊 Target 3 NO for ${stock.ticker}: ${currentPrice} < ${target3}`)
    }
  }

  // Deactivate stop loss if ALL targets hit
  const finalHasT1Hit = updatedStock.target1Hit === 'YES'
  const finalHasT2Hit = updatedStock.target2Hit === 'YES'
  const finalHasT3Hit = updatedStock.target3Hit === 'YES'
  const finalHasAllHit = finalHasT1Hit && finalHasT2Hit && finalHasT3Hit
  
  if (finalHasAllHit && !stopDeactivated) {
    updatedStock.stopHit = 'X'
  } else if (!finalHasT1Hit && !finalHasT2Hit && !finalHasT3Hit && !updatedStock.stopHit) {
    if (stopLoss) updatedStock.stopHit = 'N/A'
  }

  // Update % made from call out only when targets or stop are hit
  if (updatePercentMade) {
    updatedStock.percentMade = percentMade
  }

  return updatedStock
}

export async function POST(request: NextRequest) {
  try {
    const stocks = localStorageService.getStocks()
    let successCount = 0
    let errorCount = 0
    const updatedStocks = []
    
    for (const stock of stocks) {
      try {
        // Get current stock price from Finnhub
        const currentPrice = await getStockPrice(stock.ticker)
        
        // Update targets and stops
        const updatedStock = updateTargetsAndStops(stock, currentPrice)
        
        // Update in localStorage
        const savedStock = localStorageService.updateStock(stock.id, {
          currentPrice: updatedStock.currentPrice,
          percentSinceCallout: updatedStock.percentSinceCallout,
          percentMade: updatedStock.percentMade,
          target1Hit: updatedStock.target1Hit,
          target2Hit: updatedStock.target2Hit,
          target3Hit: updatedStock.target3Hit,
          stopHit: updatedStock.stopHit,
          target1Date: updatedStock.target1Date,
          target2Date: updatedStock.target2Date,
          target3Date: updatedStock.target3Date
        })
        
        if (savedStock) {
          updatedStocks.push(savedStock)
          successCount++
        }
      } catch (error) {
        console.error(`Failed to update stock ${stock.ticker}:`, error)
        errorCount++
      }
    }
    
    return NextResponse.json({ 
      message: 'Stock prices and targets updated',
      successCount,
      errorCount,
      total: stocks.length
    })
  } catch (error) {
    console.error('Failed to refresh stocks:', error)
    return NextResponse.json({ error: 'Failed to refresh stocks' }, { status: 500 })
  }
}

// Export the function for use in other modules
export { updateTargetsAndStops, getStockPrice }