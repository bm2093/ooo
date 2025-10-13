import { NextRequest, NextResponse } from 'next/server'
import { localStorageService } from '@/lib/local-storage'

export async function POST(request: NextRequest) {
  try {
    // Get current stocks count before clearing
    const stocksCount = localStorageService.getStocks().length
    
    // Clear all stocks
    localStorageService.clearAllStocks()
    
    return NextResponse.json({ 
      message: 'All stocks cleared successfully',
      deletedCount: stocksCount 
    })
  } catch (error) {
    console.error('Failed to clear stocks:', error)
    return NextResponse.json({ error: 'Failed to clear stocks' }, { status: 500 })
  }
}