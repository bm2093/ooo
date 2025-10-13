import { NextRequest, NextResponse } from 'next/server'
import { localStorageService } from '@/lib/local-storage'
import * as XLSX from 'xlsx'
import { getTradingViewPrice } from '@/lib/tradingview-scraper'

async function getStockPrice(ticker: string): Promise<number> {
  try {
    const price = await getTradingViewPrice(ticker)
    return price
  } catch (error) {
    console.error(`Failed to fetch price for ${ticker}:`, error)
    return 0
  }
}

function parseHitStatus(value: any): string {
  if (!value) return ''
  const str = value.toString().toLowerCase().trim()
  if (str === 'yes' || str === 'y') return 'YES'
  if (str === 'no' || str === 'n') return 'NO'
  if (str === 'n/a' || str === 'na') return 'N/A'
  return str
}

function parseStopStatus(value: any): string {
  if (!value) return ''
  const str = value.toString().toLowerCase().trim()
  if (str === 'yes' || str === 'y') return 'YES'
  if (str === 'no' || str === 'n') return 'NO'
  if (str === 'n/a' || str === 'na') return 'N/A'
  if (str === 'x') return 'X'
  return str
}

function parseDate(value: any): string | null {
  if (!value) return null
  
  // Handle Excel date numbers
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000) // Convert Excel date to JS date
    return date.toISOString().split('T')[0]
  }
  
  // Handle string dates
  const str = value.toString().trim()
  if (str) {
    try {
      const date = new Date(str)
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]
      }
    } catch (error) {
      // Invalid date, return null
    }
  }
  
  return null
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const clearExisting = formData.get('clearExisting') === 'true'
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Check file type (accept .xlsx, .xls, .xlsm)
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/vnd.ms-excel.sheet.macroEnabled.12' // .xlsm
    ]
    
    const fileName = file.name.toLowerCase()
    if (!allowedTypes.includes(file.type) && !fileName.match(/\.(xlsx|xls|xlsm)$/)) {
      return NextResponse.json({ error: 'Invalid file type. Please upload .xlsx, .xls, or .xlsm files' }, { status: 400 })
    }

    // Clear existing data if requested
    if (clearExisting) {
      localStorageService.clearAllStocks()
    }

    // Read the Excel file (macros in .xlsm files are automatically ignored)
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    // Convert to JSON with specific column mapping (B-Q, with A being empty)
    const data = XLSX.utils.sheet_to_json(worksheet, { 
      header: [
        'Empty',            // Column A (empty)
        'Ticker',           // Column B
        'CalloutPrice',     // Column C
        'Target1',          // Column D
        'Target2',          // Column E
        'Target3',          // Column F
        'StopLoss',         // Column G
        'CurrentPrice',     // Column H
        'PercentSinceCallout', // Column I
        'T1Hit',            // Column J
        'T2Hit',            // Column K
        'T3Hit',            // Column L
        'StopHit',          // Column M
        'PercentMade',      // Column N
        'T1Date',           // Column O
        'T2Date',           // Column P
        'T3Date'            // Column Q
      ],
      range: 1 // Start from row 1 (assuming no headers)
    })
    
    if (data.length === 0) {
      return NextResponse.json({ error: 'Excel file is empty' }, { status: 400 })
    }

    const stocksToImport = []

    // Process each row
    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i] as any
        
        // Skip empty rows
        if (!row || !row.Ticker || row.Ticker.toString().trim() === '') {
          continue
        }

        // Parse and validate data
        const ticker = row.Ticker?.toString().trim()
        const calloutPrice = parseFloat(row.CalloutPrice) || 0
        const target1 = parseFloat(row.Target1) || null
        const target2 = parseFloat(row.Target2) || null
        const target3 = parseFloat(row.Target3) || null
        const stopLoss = parseFloat(row.StopLoss) || null
        const currentPrice = parseFloat(row.CurrentPrice) || 0
        const percentSinceCallout = parseFloat(row.PercentSinceCallout) || 0
        const percentMade = parseFloat(row.PercentMade) || 0
        
        // Validate required fields
        if (!ticker || calloutPrice <= 0) {
          continue
        }

        // Parse hit status
        const t1Hit = parseHitStatus(row.T1Hit)
        const t2Hit = parseHitStatus(row.T2Hit)
        const t3Hit = parseHitStatus(row.T3Hit)
        const stopHit = parseStopStatus(row.StopHit)

        // Parse dates
        const t1Date = parseDate(row.T1Date)
        const t2Date = parseDate(row.T2Date)
        const t3Date = parseDate(row.T3Date)

        // Get current market price - always fetch fresh price
        let marketPrice = 0
        try {
          marketPrice = await getStockPrice(ticker)
          if (marketPrice <= 0) {
            console.warn(`Failed to get market price for ${ticker}, using callout price`)
            marketPrice = calloutPrice
          }
        } catch (error) {
          console.error(`Failed to get market price for ${ticker}, using callout price`)
          marketPrice = calloutPrice
        }

        // Create stock object for import - ONLY basic data, everything else will be calculated
        stocksToImport.push({
          ticker: ticker.toUpperCase(),
          calloutPrice,
          target1,
          target2,
          target3,
          stopLoss,
          currentPrice: marketPrice,
          // All calculated fields will be set to initial values and updated by refresh logic
          percentSinceCallout: calloutPrice !== 0 ? ((marketPrice - calloutPrice) / calloutPrice) * 100 : 0,
          percentMade: 0,
          target1Hit: target1 ? 'NO' : '',
          target2Hit: target2 ? 'NO' : '',
          target3Hit: target3 ? 'NO' : '',
          stopHit: stopLoss ? 'N/A' : '',
          target1Date: null,
          target2Date: null,
          target3Date: null
        })
      } catch (error) {
        console.error(`Error processing row ${i + 1}:`, error)
      }
    }

    // Import stocks using localStorage service
    const result = localStorageService.importStocks(stocksToImport, clearExisting)

    // After import, trigger a refresh to calculate targets and hits properly
    if (result.imported > 0) {
      try {
        // Import the refresh logic to run target detection
        const refreshModule = await import('./refresh')
        const { updateTargetsAndStops } = refreshModule
        
        const importedStocks = localStorageService.getStocks()
        for (const stock of importedStocks) {
          try {
            const updatedStock = updateTargetsAndStops(stock, stock.currentPrice)
            localStorageService.updateStock(stock.id, {
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
          } catch (error) {
            console.error(`Failed to update imported stock ${stock.ticker}:`, error)
          }
        }
      } catch (error) {
        console.error('Failed to refresh imported stocks:', error)
      }
    }

    return NextResponse.json({
      message: 'Import completed',
      imported: result.imported,
      errors: result.errors,
      total: data.length,
      clearedExisting: clearExisting
    })
  } catch (error) {
    console.error('Import failed:', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}