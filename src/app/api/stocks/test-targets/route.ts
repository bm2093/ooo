import { NextRequest, NextResponse } from 'next/server'
import { localStorageService } from '@/lib/local-storage'
import { updateTargetsAndStops } from '../refresh'

export async function POST(request: NextRequest) {
  try {
    const stocks = localStorageService.getStocks()
    console.log(`🔍 Testing target detection for ${stocks.length} stocks...`)
    
    const results = []
    
    for (const stock of stocks) {
      console.log(`\n📊 Testing ${stock.ticker}:`)
      console.log(`  Current Price: ${stock.currentPrice}`)
      console.log(`  Target 1: ${stock.target1} (${stock.target1Hit})`)
      console.log(`  Target 2: ${stock.target2} (${stock.target2Hit})`)
      console.log(`  Target 3: ${stock.target3} (${stock.target3Hit})`)
      
      const updatedStock = updateTargetsAndStops(stock, stock.currentPrice)
      
      console.log(`  After update:`)
      console.log(`    T1: ${updatedStock.target1Hit}`)
      console.log(`    T2: ${updatedStock.target2Hit}`)
      console.log(`    T3: ${updatedStock.target3Hit}`)
      
      results.push({
        ticker: stock.ticker,
        before: {
          target1Hit: stock.target1Hit,
          target2Hit: stock.target2Hit,
          target3Hit: stock.target3Hit
        },
        after: {
          target1Hit: updatedStock.target1Hit,
          target2Hit: updatedStock.target2Hit,
          target3Hit: updatedStock.target3Hit
        },
        currentPrice: stock.currentPrice,
        targets: {
          target1: stock.target1,
          target2: stock.target2,
          target3: stock.target3
        }
      })
    }
    
    return NextResponse.json({
      message: 'Target detection test completed',
      results
    })
  } catch (error) {
    console.error('Target detection test failed:', error)
    return NextResponse.json({ error: 'Target detection test failed' }, { status: 500 })
  }
}