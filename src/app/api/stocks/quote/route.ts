import { NextRequest, NextResponse } from 'next/server'
import { getStockPrice, clearPriceCache, getPriceSource } from '@/lib/multi-source-price-fetcher'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol')
    const clearCache = searchParams.get('clearCache') === 'true'

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol parameter is required' }, { status: 400 })
    }

    const ticker = symbol.toUpperCase().trim()

    // Clear cache if requested
    if (clearCache) {
      clearPriceCache(ticker)
    }

    try {
      const currentPrice = await getStockPrice(ticker)
      const source = getPriceSource(ticker)
      
      if (currentPrice <= 0) {
        return NextResponse.json({ error: 'No valid price data available' }, { status: 404 })
      }

      return NextResponse.json({
        symbol: ticker,
        currentPrice,
        change: 0, // Could be enhanced later
        percentChange: 0,
        high: 0,
        low: 0,
        open: 0,
        previousClose: 0,
        source: source,
        timestamp: new Date().toISOString()
      })
    } catch (priceError) {
      console.error(`Price fetch error for ${ticker}:`, priceError)
      
      return NextResponse.json({ 
        error: `Failed to fetch price for ${ticker}`,
        details: priceError instanceof Error ? priceError.message : 'Unknown error',
        symbol: ticker
      }, { status: 404 })
    }
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}