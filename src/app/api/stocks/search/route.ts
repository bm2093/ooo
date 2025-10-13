import { NextRequest, NextResponse } from 'next/server'

const FINNHUB_API_KEY = 'd3j0o5pr01qruraiv910d3j0o5pr01qruraiv91g'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 })
    }

    // Use Finnhub symbol search API
    const searchResponse = await fetch(
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${FINNHUB_API_KEY}`
    )

    if (!searchResponse.ok) {
      throw new Error('Failed to search stocks')
    }

    const searchData = await searchResponse.json()
    
    // Finnhub returns results in .result array with .description, .displaySymbol, and .symbol
    const results = (searchData.result || [])
      .filter((item: any) => item.type === 'Common Stock' || !item.type) // Filter for common stocks
      .slice(0, 10) // Limit to 10 results
      .map((item: any) => ({
        symbol: item.symbol,
        name: item.description,
        displaySymbol: item.displaySymbol
      }))

    return NextResponse.json(results)
  } catch (error) {
    console.error('Failed to search stocks:', error)
    
    // Fallback to some common stocks if API fails
    const fallbackStocks = [
      { symbol: 'AAPL', name: 'Apple Inc.', displaySymbol: 'AAPL' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', displaySymbol: 'GOOGL' },
      { symbol: 'MSFT', name: 'Microsoft Corporation', displaySymbol: 'MSFT' },
      { symbol: 'TSLA', name: 'Tesla, Inc.', displaySymbol: 'TSLA' },
      { symbol: 'AMZN', name: 'Amazon.com, Inc.', displaySymbol: 'AMZN' }
    ].filter(stock => 
      stock.symbol.toLowerCase().includes(query.toLowerCase()) ||
      stock.name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5)
    
    return NextResponse.json(fallbackStocks)
  }
}