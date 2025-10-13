import { NextRequest, NextResponse } from 'next/server'
import { getStockPrice, clearPriceCache, getPriceSource } from '@/lib/multi-source-price-fetcher'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ticker = searchParams.get('ticker') || 'AAPL'
    const clearCache = searchParams.get('clearCache') === 'true'

    if (clearCache) {
      clearPriceCache(ticker)
      console.log(`🧹 Cleared cache for ${ticker}`)
    }

    console.log(`🧪 Testing multi-source price fetching for ${ticker}`)
    
    const startTime = Date.now()
    const price = await getStockPrice(ticker)
    const source = getPriceSource(ticker)
    const endTime = Date.now()
    
    return NextResponse.json({
      ticker: ticker.toUpperCase(),
      price,
      source,
      timestamp: new Date().toISOString(),
      duration: endTime - startTime,
      success: true,
      method: 'multi_source_fetcher'
    })
  } catch (error) {
    console.error('❌ Multi-source test failed:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false,
      method: 'multi_source_fetcher'
    }, { status: 500 })
  }
}