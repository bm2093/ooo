import { NextRequest, NextResponse } from 'next/server'
import { localStorageService } from '@/lib/local-storage'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  try {
    // Fetch all stocks from localStorage
    const stocks = localStorageService.exportStocks()

    // Prepare data for Excel
    const excelData = stocks.map(stock => ({
      'Ticker': stock.ticker,
      'Callout': stock.calloutPrice,
      'Target 1': stock.target1 || '',
      'Target 2': stock.target2 || '',
      'Target 3': stock.target3 || '',
      'Stop Loss': stock.stopLoss || '',
      'Buy Zone Low': stock.buyZoneLow || '',
      'Buy Zone High': stock.buyZoneHigh || '',
      'Current Price': stock.currentPrice,
      '% Since Callout': `${stock.percentSinceCallout.toFixed(2)}%`,
      'T1 Hit': stock.target1Hit || '',
      'T2 Hit': stock.target2Hit || '',
      'T3 Hit': stock.target3Hit || '',
      'Stop Hit': stock.stopHit || '',
      'Buy Hit': stock.buyZoneHit || '',
      '% Made': stock.percentMade !== 0 ? `${stock.percentMade.toFixed(2)}%` : '',
      'T1 Date': stock.target1Date || '',
      'T2 Date': stock.target2Date || '',
      'T3 Date': stock.target3Date || '',
      'Created Date': stock.createdAt.toLocaleDateString()
    }))

    // Create workbook
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(excelData)

    // Set column widths
    const colWidths = [
      { wch: 10 }, // Ticker
      { wch: 15 }, // Callout
      { wch: 12 }, // Target 1
      { wch: 12 }, // Target 2
      { wch: 12 }, // Target 3
      { wch: 12 }, // Stop Loss
      { wch: 12 }, // Buy Zone Low
      { wch: 12 }, // Buy Zone High
      { wch: 15 }, // Current Price
      { wch: 18 }, // % Since Callout
      { wch: 8 },  // T1 Hit
      { wch: 8 },  // T2 Hit
      { wch: 8 },  // T3 Hit
      { wch: 10 }, // Stop Hit
      { wch: 8 },  // Buy Hit
      { wch: 12 }, // % Made
      { wch: 12 }, // T1 Date
      { wch: 12 }, // T2 Date
      { wch: 12 }, // T3 Date
      { wch: 15 }  // Created Date
    ]
    worksheet['!cols'] = colWidths

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Positions')

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // Return as blob
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="stock_positions_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    })
  } catch (error) {
    console.error('Export failed:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}