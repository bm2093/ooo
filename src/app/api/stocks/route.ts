import { NextRequest, NextResponse } from 'next/server'
import { localStorageService } from '@/lib/local-storage'
import { getTradingViewPrice } from '@/lib/tradingview-scraper'

export async function GET() {
  try {
    const stocks = localStorageService.getStocks()
    return NextResponse.json(stocks)
  } catch (error) {
    console.error('Failed to fetch stocks:', error)
    return NextResponse.json({ error: 'Failed to fetch stocks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ticker, calloutPrice, target1, target2, target3, stopLoss } = body

    if (!ticker || !calloutPrice) {
      return NextResponse.json({ error: 'Ticker and callout price are required' }, { status: 400 })
    }

    // Get current market price from TradingView
    let currentPrice = parseFloat(calloutPrice)
    try {
      const tradingViewPrice = await getTradingViewPrice(ticker)
      if (tradingViewPrice > 0) {
        currentPrice = tradingViewPrice
      }
    } catch (error) {
      console.error('Failed to fetch current price from TradingView, using callout price:', error)
    }

    // Create stock with real current price
    const stock = localStorageService.addStock({
      ticker: ticker.toUpperCase(),
      calloutPrice,
      target1: target1 || undefined,
      target2: target2 || undefined,
      target3: target3 || undefined,
      stopLoss: stopLoss || undefined,
      currentPrice,
      percentSinceCallout: calloutPrice !== 0 ? ((currentPrice - calloutPrice) / calloutPrice) * 100 : 0,
      percentMade: 0,
      target1Hit: target1 ? "NO" : "",
      target2Hit: target2 ? "NO" : "",
      target3Hit: target3 ? "NO" : "",
      stopHit: stopLoss ? "N/A" : ""
    })

    return NextResponse.json(stock, { status: 201 })
  } catch (error) {
    console.error('Failed to create stock:', error)
    return NextResponse.json({ error: 'Failed to create stock' }, { status: 500 })
  }
}