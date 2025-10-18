'use client'

import React, { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, RefreshCw, TrendingUp, TrendingDown, Search, Trash2, Clock, Download, Upload, MoreHorizontal, Trash, Sun, Moon, Edit2, Filter, ArrowUpDown } from 'lucide-react'
import { InlineEdit } from '@/components/inline-edit'
import { useLocalStorageLastUpdated } from '@/hooks/use-local-storage-last-updated'
import { clientStockService } from '@/lib/client-stock-service'
import { updateTargetsAndStops } from '@/lib/target-detector'
import { TradingViewChartModal } from '@/components/tradingview-chart-modal'

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// Extend Window interface for auto-refresh interval
declare global {
  interface Window {
    autoRefreshInterval?: NodeJS.Timeout
  }
}

interface Stock {
  id: string
  date: string // New date field
  ticker: string
  calloutPrice: number
  target1?: number
  target2?: number
  target3?: number
  stopLoss?: number
  buyZoneLow?: number
  buyZoneHigh?: number
  currentPrice: number
  percentSinceCallout: number
  percentMade: number
  target1Hit: 'YES' | 'NO' | 'N/A' | ''
  target2Hit: 'YES' | 'NO' | 'N/A' | ''
  target3Hit: 'YES' | 'NO' | 'N/A' | ''
  stopHit: 'YES' | 'NO' | 'N/A' | 'X' | ''
  buyZoneHit: 'YES' | 'NO' | ''
  target1Date?: string
  target2Date?: string
  target3Date?: string
  createdAt: string
}

interface StockSearchResult {
  symbol: string
  name: string
  displaySymbol: string
}

export default function Home() {
  const { theme, setTheme } = useTheme()
  const [stocks, setStocks] = useState<Stock[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null)
  const [actionsStatusMessage, setActionsStatusMessage] = useState<string | null>(null)
  const [refreshStatusMessage, setRefreshStatusMessage] = useState<string | null>(null)
  const [isMassImportDialogOpen, setIsMassImportDialogOpen] = useState(false)
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false)
  const [massImportTickers, setMassImportTickers] = useState('')
  const [stockSearchResults, setStockSearchResults] = useState<StockSearchResult[]>([])
  const [isSearchingStocks, setIsSearchingStocks] = useState(false)
  const { lastUpdated, updateLastUpdated } = useLocalStorageLastUpdated()
  const [newStock, setNewStock] = useState({
    date: '',
    ticker: '',
    calloutPrice: '',
    target1: '',
    target2: '',
    target3: '',
    stopLoss: '',
    buyZoneLow: '',
    buyZoneHigh: ''
  })
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null)
  const [selectedFilter, setSelectedFilter] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>(() => {
    // Load sort order from localStorage on initial render
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('stockSortOrder')
      return saved === 'oldest' ? 'oldest' : 'newest'
    }
    return 'newest'
  })

  // Load initial data and set up auto-refresh
  useEffect(() => {
    loadStocks()
  }, [])

  // Re-sort stocks when sort order changes
  useEffect(() => {
    if (stocks.length > 0) {
      const sortedStocks = [...stocks].sort((a, b) => {
        // If both have dates, sort by date
        if (a.date && b.date) {
          const diff = new Date(a.date).getTime() - new Date(b.date).getTime()
          return sortOrder === 'newest' ? -diff : diff
        }
        // If only a has date, a comes first
        if (a.date && !b.date) return -1
        // If only b has date, b comes first
        if (!a.date && b.date) return 1
        // If neither has date, maintain original order
        return 0
      })
      setStocks(sortedStocks)
    }
  }, [sortOrder])

  // Dynamic auto-refresh based on stock count
  useEffect(() => {
    if (stocks.length === 0) return

    // Clear any existing interval
    if (window.autoRefreshInterval) {
      clearInterval(window.autoRefreshInterval)
    }

    // Determine update interval based on stock count
    const updateInterval = stocks.length >= 30 ? 60000 : 30000 // 1 minute for 30+ stocks, 30 seconds otherwise
    const intervalText = updateInterval === 60000 ? '1 minute' : '30 seconds'

    const interval = setInterval(() => {
      if (!isLoading) { // Only refresh if not already loading
        console.log(`auto refreshing prices from all the sources (${stocks.length} stocks, ${intervalText} interval)`)
        refreshPrices()
      }
    }, updateInterval)
    
    window.autoRefreshInterval = interval
    console.log(`started ${intervalText} auto refresh from the sources for ${stocks.length} stocks`)
    
    return () => {
      if (window.autoRefreshInterval) {
        clearInterval(window.autoRefreshInterval)
        delete window.autoRefreshInterval
      }
    }
  }, [stocks, isLoading])

  const loadStocks = () => {
    try {
      const data = clientStockService.getStocks()
      // Sort by date based on sortOrder
      const sortedData = data.sort((a, b) => {
        // If both have dates, sort by date
        if (a.date && b.date) {
          const diff = new Date(a.date).getTime() - new Date(b.date).getTime()
          return sortOrder === 'newest' ? -diff : diff
        }
        // If only a has date, a comes first
        if (a.date && !b.date) return -1
        // If only b has date, b comes first
        if (!a.date && b.date) return 1
        // If neither has date, maintain original order
        return 0
      })
      setStocks(sortedData)
      updateLastUpdated()
    } catch (error) {
      console.error('Failed to load stocks:', error)
    }
  }

  const searchStocks = async (query: string) => {
    if (query.length < 2) {
      setStockSearchResults([])
      return
    }

    setIsSearchingStocks(true)
    try {
      const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        setStockSearchResults(data)
      }
    } catch (error) {
      console.error('Failed to search stocks:', error)
    } finally {
      setIsSearchingStocks(false)
    }
  }

  const selectStock = async (symbol: string) => {
    setNewStock({ ...newStock, ticker: symbol })
    setStockSearchResults([])
    
    // Fetch current price for the selected stock
    try {
      const response = await fetch(`/api/stocks/quote?symbol=${symbol}`)
      if (response.ok) {
        const data = await response.json()
        setNewStock(prev => ({ 
          ...prev, 
          ticker: symbol,
          calloutPrice: data.currentPrice.toFixed(2)
        }))
      }
    } catch (error) {
      console.error('Failed to fetch current price:', error)
    }
  }

  const addStock = async () => {
    if (!newStock.ticker || !newStock.calloutPrice || parseFloat(newStock.calloutPrice) <= 0) {
      if (parseFloat(newStock.calloutPrice) <= 0) {
        alert('Callout price must be greater than 0')
      }
      return
    }

    setIsLoading(true)
    try {
      // Get current market price from TradingView
      let currentPrice = parseFloat(newStock.calloutPrice)
      try {
        const quoteResponse = await fetch(`/api/stocks/quote?symbol=${newStock.ticker}`)
        
        if (quoteResponse.ok) {
          const quoteData = await quoteResponse.json()
          if (quoteData.currentPrice && quoteData.currentPrice > 0) {
            currentPrice = quoteData.currentPrice
          }
        }
      } catch (error) {
        console.error('Failed to fetch current price, using callout price:', error)
      }

      // Create stock with real current price and run target detection
      let stock = clientStockService.addStock({
        date: newStock.date || '',
        ticker: newStock.ticker.toUpperCase(),
        calloutPrice: parseFloat(newStock.calloutPrice),
        target1: newStock.target1 ? parseFloat(newStock.target1) : undefined,
        target2: newStock.target2 ? parseFloat(newStock.target2) : undefined,
        target3: newStock.target3 ? parseFloat(newStock.target3) : undefined,
        stopLoss: newStock.stopLoss ? parseFloat(newStock.stopLoss) : undefined,
        buyZoneLow: newStock.buyZoneLow ? parseFloat(newStock.buyZoneLow) : undefined,
        buyZoneHigh: newStock.buyZoneHigh ? parseFloat(newStock.buyZoneHigh) : undefined,
        currentPrice,
        percentSinceCallout: parseFloat(newStock.calloutPrice) !== 0 ? ((currentPrice - parseFloat(newStock.calloutPrice)) / parseFloat(newStock.calloutPrice)) * 100 : 0,
        percentMade: 0,
        target1Hit: newStock.target1 ? "NO" : "",
        target2Hit: newStock.target2 ? "NO" : "",
        target3Hit: newStock.target3 ? "NO" : "",
        stopHit: newStock.stopLoss ? "N/A" : "",
        buyZoneHit: (newStock.buyZoneLow || newStock.buyZoneHigh) ? "NO" : ""
      })

      // Run target detection on the newly added stock
      if (stock) {
        const updatedStock = updateTargetsAndStops(stock, currentPrice)
        clientStockService.updateStock(stock.id, {
          currentPrice: updatedStock.currentPrice,
          percentSinceCallout: updatedStock.percentSinceCallout,
          percentMade: updatedStock.percentMade,
          target1Hit: updatedStock.target1Hit,
          target2Hit: updatedStock.target2Hit,
          target3Hit: updatedStock.target3Hit,
          stopHit: updatedStock.stopHit,
          buyZoneHit: updatedStock.buyZoneHit,
          target1Date: updatedStock.target1Date,
          target2Date: updatedStock.target2Date,
          target3Date: updatedStock.target3Date
        })
      }

      if (stock) {
        setNewStock({ date: '', ticker: '', calloutPrice: '', target1: '', target2: '', target3: '', stopLoss: '', buyZoneLow: '', buyZoneHigh: '' })
        setIsAddDialogOpen(false)
        loadStocks()
      }
    } catch (error) {
      console.error('Failed to add stock:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshPrices = async () => {
    setIsLoading(true)
    setRefreshMessage(null)
    try {
      const stocks = clientStockService.getStocks()
      let successCount = 0
      let errorCount = 0
      
      // Determine batch size based on stock count (no rate limiting needed with multi-source fetcher)
      const batchSize = stocks.length >= 30 ? 20 : 15 // Larger batches since no API limits
      const delay = stocks.length >= 30 ? 500 : 300 // Minimal delays for UI responsiveness
      
      console.log(`🔄 Starting price refresh from multiple sources for ${stocks.length} stocks (batch size: ${batchSize}, delay: ${delay}ms)`)
      
      // Process stocks in batches for UI responsiveness
      for (let i = 0; i < stocks.length; i += batchSize) {
        const batch = stocks.slice(i, i + batchSize)
        const batchPromises = batch.map(async (stock) => {
          try {
            // Get current stock price from TradingView
            const quoteResponse = await fetch(`/api/stocks/quote?symbol=${stock.ticker}`)
            
            if (quoteResponse.ok) {
              const quoteData = await quoteResponse.json()
              if (quoteData.currentPrice && quoteData.currentPrice > 0) {
                const currentPrice = quoteData.currentPrice
                
                // Update targets and stops using the detection logic
                const updatedStock = updateTargetsAndStops(stock, currentPrice)
                
                // Update the stock with all calculated values
                clientStockService.updateStock(stock.id, {
                  currentPrice: updatedStock.currentPrice,
                  percentSinceCallout: updatedStock.percentSinceCallout,
                  percentMade: updatedStock.percentMade,
                  target1Hit: updatedStock.target1Hit,
                  target2Hit: updatedStock.target2Hit,
                  target3Hit: updatedStock.target3Hit,
                  stopHit: updatedStock.stopHit,
                  buyZoneHit: updatedStock.buyZoneHit,
                  target1Date: updatedStock.target1Date,
                  target2Date: updatedStock.target2Date,
                  target3Date: updatedStock.target3Date
                })
                
                return { success: true, ticker: stock.ticker }
              }
            }
            return { success: false, ticker: stock.ticker, error: 'Invalid API response' }
          } catch (error) {
            console.error(`Failed to update stock ${stock.ticker}:`, error)
            return { success: false, ticker: stock.ticker, error: error.message }
          }
        })
        
        const batchResults = await Promise.all(batchPromises)
        successCount += batchResults.filter(r => r.success).length
        errorCount += batchResults.filter(r => !r.success).length
        
        // Add delay between batches (except for the last batch)
        if (i + batchSize < stocks.length) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
      
      loadStocks()
      const intervalText = stocks.length >= 30 ? 'minute' : '30 seconds'
      showRefreshStatus(`Updated ${successCount}/${stocks.length} stocks${errorCount > 0 ? ` (${errorCount} errors)` : ''}`)
    } catch (error) {
      console.error('Failed to refresh prices:', error)
      showRefreshStatus('Network error while refreshing')
    } finally {
      setIsLoading(false)
    }
  }

  const deleteStock = (id: string) => {
    try {
      const deleted = clientStockService.deleteStock(id)
      if (deleted) {
        loadStocks()
      }
    } catch (error) {
      console.error('Failed to delete stock:', error)
    }
  }

  const updateStock = (id: string, field: string, value: number | null | string) => {
    try {
      const updateData: any = {}
      updateData[field] = value
      
      // If updating a target field, clear the corresponding hit status and date
      if (field === 'target1' || field === 'target2' || field === 'target3') {
        const targetNumber = field.charAt(field.length - 1) // Extract '1', '2', or '3'
        
        // If target is being set to 0, null, undefined, or empty string, clear it completely
        if (value === 0 || value === null || value === undefined || value === '') {
          updateData[field] = undefined
          updateData[`target${targetNumber}Hit`] = ''
          updateData[`target${targetNumber}Date`] = undefined
        } else {
          // Target is being changed to a new value, clear hit status and date
          updateData[`target${targetNumber}Hit`] = 'NO'
          updateData[`target${targetNumber}Date`] = undefined
        }
      }
      
      const updatedStock = clientStockService.updateStock(id, updateData)
      
      if (updatedStock) {
        // Re-run target detection to update statuses based on new target values
        const finalStock = updateTargetsAndStops(updatedStock, updatedStock.currentPrice)
        clientStockService.updateStock(id, {
          target1Hit: finalStock.target1Hit,
          target2Hit: finalStock.target2Hit,
          target3Hit: finalStock.target3Hit,
          stopHit: finalStock.stopHit,
          buyZoneHit: finalStock.buyZoneHit,
          target1Date: finalStock.target1Date,
          target2Date: finalStock.target2Date,
          target3Date: finalStock.target3Date,
          percentMade: finalStock.percentMade
        })
        
        loadStocks()
        setEditingCell(null)
      }
    } catch (error) {
      console.error('Failed to update stock:', error)
      setEditingCell(null)
    }
  }

  const startEditing = (id: string, field: string) => {
    setEditingCell({ id, field })
  }

  const cancelEditing = () => {
    setEditingCell(null)
  }

  const saveEdit = (id: string, field: string, value: number | null | string) => {
    updateStock(id, field, value)
  }

  const clearAllStocks = () => {
    setIsClearAllDialogOpen(true)
  }

  const confirmClearAllStocks = () => {
    try {
      clientStockService.clearAllStocks()
      setActionsStatusMessage('All stocks cleared successfully')
      setTimeout(() => setActionsStatusMessage(null), 3000)
      loadStocks()
      setIsClearAllDialogOpen(false)
    } catch (error) {
      console.error('Failed to clear stocks:', error)
      setActionsStatusMessage('Failed to clear stocks')
      setTimeout(() => setActionsStatusMessage(null), 3000)
    }
  }

  const showActionsStatus = (message: string) => {
    setActionsStatusMessage(message)
    setTimeout(() => setActionsStatusMessage(null), 3000)
  }

  const showRefreshStatus = (message: string) => {
    setRefreshStatusMessage(message)
    setTimeout(() => setRefreshStatusMessage(null), 3000)
  }

  const massImportStocks = async () => {
    if (!massImportTickers.trim()) return

    setIsLoading(true)
    try {
      // Parse tickers from the textarea
      const tickerLines = massImportTickers.split('\n')
        .map(line => line.trim().toUpperCase())
        .filter(line => line.length > 0)
      
      if (tickerLines.length === 0) {
        showActionsStatus('No valid tickers found')
        return
      }

      let successCount = 0
      let errorCount = 0
      const errorTickers: string[] = []

      // Process each ticker
      for (const ticker of tickerLines) {
        try {
          // Get current market price from TradingView
          const quoteResponse = await fetch(`/api/stocks/quote?symbol=${ticker}`)
          
          if (quoteResponse.ok) {
            const quoteData = await quoteResponse.json()
            if (quoteData.currentPrice && quoteData.currentPrice > 0) {
              const currentPrice = quoteData.currentPrice
              
              // Create stock with current price as callout price (user can edit later)
              const stock = clientStockService.addStock({
                date: '', // Empty date for mass import
                ticker: ticker,
                calloutPrice: currentPrice, // Use current price as callout price
                target1: undefined,
                target2: undefined,
                target3: undefined,
                stopLoss: undefined,
                currentPrice: currentPrice,
                percentSinceCallout: 0, // 0% since callout price = current price
                percentMade: 0,
                target1Hit: '',
                target2Hit: '',
                target3Hit: '',
                stopHit: ''
              })

              // Run target detection on the newly added stock
              if (stock) {
                const updatedStock = updateTargetsAndStops(stock, currentPrice)
                clientStockService.updateStock(stock.id, {
                  currentPrice: updatedStock.currentPrice,
                  percentSinceCallout: updatedStock.percentSinceCallout,
                  percentMade: updatedStock.percentMade,
                  target1Hit: updatedStock.target1Hit,
                  target2Hit: updatedStock.target2Hit,
                  target3Hit: updatedStock.target3Hit,
                  stopHit: updatedStock.stopHit,
                  buyZoneHit: updatedStock.buyZoneHit,
                  target1Date: updatedStock.target1Date,
                  target2Date: updatedStock.target2Date,
                  target3Date: updatedStock.target3Date
                })
                successCount++
              } else {
                errorCount++
                errorTickers.push(ticker)
              }
            } else {
              errorCount++
              errorTickers.push(ticker)
            }
          } else {
            errorCount++
            errorTickers.push(ticker)
          }
        } catch (error) {
          console.error(`Failed to import ${ticker}:`, error)
          errorCount++
          errorTickers.push(ticker)
        }
      }

      // Show results
      let message = `Mass import completed: ${successCount} stocks added successfully`
      if (errorCount > 0) {
        message += `, ${errorCount} failed`
        if (errorTickers.length <= 5) {
          message += ` (${errorTickers.join(', ')})`
        } else {
          message += ` (${errorTickers.slice(0, 5).join(', ')} and ${errorTickers.length - 5} more)`
        }
      }
      
      setRefreshMessage(message)
      setTimeout(() => setRefreshMessage(null), 5000)
      showActionsStatus(`Imported ${successCount} stocks${errorCount > 0 ? ` (${errorCount} failed)` : ''}`)
      loadStocks()
      setIsMassImportDialogOpen(false)
      setMassImportTickers('')
    } catch (error) {
      console.error('Failed to mass import stocks:', error)
      showActionsStatus('Failed to mass import stocks')
    } finally {
      setIsLoading(false)
    }
  }

  const getRowClass = (stock: Stock) => {
    if (stock.stopHit === 'YES' || stock.stopHit === 'X') return 'bg-gray-100 dark:bg-gray-800'
    if (stock.target1Hit === 'YES' || stock.target2Hit === 'YES' || stock.target3Hit === 'YES') return 'bg-green-50 dark:bg-green-900/30'
    return ''
  }

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) return '0.00%'
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
  }

  const getStatusBadge = (status: string) => {
    if (status === 'YES') return <Badge variant="default" className="bg-green-500 text-white">YES</Badge>
    if (status === 'NO') return <Badge variant="destructive" className="bg-red-500 text-white">NO</Badge>
    if (status === 'N/A') return <Badge variant="outline">N/A</Badge>
    if (status === 'X') return <Badge variant="outline">X</Badge>
    return null
  }

  const getFilteredStocks = () => {
    let filtered = stocks
    switch (selectedFilter) {
      case 'targetHits':
        filtered = stocks.filter(s => s.target1Hit === 'YES' || s.target2Hit === 'YES' || s.target3Hit === 'YES')
        break
      case 'active':
        filtered = stocks.filter(s => {
          const hasAnyTarget = s.target1Hit !== '' || s.target2Hit !== '' || s.target3Hit !== ''
          const stopNotHit = s.stopHit !== 'YES'
          return hasAnyTarget && stopNotHit
        })
        break
      case 'stopLossHit':
        filtered = stocks.filter(s => s.stopHit === 'YES')
        break
      default:
        filtered = stocks
    }
    
    // Apply sorting to filtered results to maintain sort order
    return filtered.sort((a, b) => {
      // If both have dates, sort by date
      if (a.date && b.date) {
        const diff = new Date(a.date).getTime() - new Date(b.date).getTime()
        return sortOrder === 'newest' ? -diff : diff
      }
      // If only a has date, a comes first
      if (a.date && !b.date) return -1
      // If only b has date, b comes first
      if (!a.date && b.date) return 1
      // If neither has date, maintain original order
      return 0
    })
  }

  const toggleSortOrder = () => {
    const newOrder = sortOrder === 'newest' ? 'oldest' : 'newest'
    setSortOrder(newOrder)
    // Persist sort order to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('stockSortOrder', newOrder)
    }
  }

  const exportAsPDF = async () => {
    try {
      console.log('🔍 Starting PDF export process...')
      
      // Find the exportable content area
      const element = document.getElementById('exportable-content')
      console.log('📋 Element found:', element)
      
      if (!element) {
        console.error('❌ Export element not found')
        alert('Could not find content to export. Please refresh the page and try again.')
        return
      }

      // Show loading state
      showActionsStatus('Generating PDF...')
      console.log('⏳ Starting PDF generation...')
      
      // Method 1: Try direct table data extraction
      try {
        console.log('📊 Attempting direct table data extraction...')
        const pdf = await generatePDFFromTableData()
        if (pdf) {
          console.log('✅ PDF generated from table data successfully')
          return
        }
      } catch (tableError) {
        console.warn('⚠️ Table data extraction failed:', tableError.message)
      }
      
      // Method 2: Try html2canvas with multiple configurations
      let canvas
      const attempts = [
        {
          name: 'conservative',
          config: {
            backgroundColor: '#ffffff',
            scale: 1,
            logging: false,
            useCORS: true,
            allowTaint: false,
            width: element.offsetWidth,
            height: element.offsetHeight,
            scrollX: 0,
            scrollY: 0,
            windowWidth: element.offsetWidth,
            windowHeight: element.offsetHeight,
            ignoreElements: (element) => {
              // Ignore elements that might cause oklch color issues
              const style = window.getComputedStyle(element)
              return style.backgroundColor?.includes('oklch') || 
                     style.color?.includes('oklch')
            }
          }
        },
        {
          name: 'minimal',
          config: {
            backgroundColor: '#ffffff',
            scale: 0.8,
            logging: false,
            useCORS: false,
            allowTaint: true,
            width: element.offsetWidth,
            height: element.offsetHeight,
            ignoreElements: (element) => {
              const style = window.getComputedStyle(element)
              return style.backgroundColor?.includes('oklch') || 
                     style.color?.includes('oklch')
            }
          }
        },
        {
          name: 'clone-first',
          config: {
            backgroundColor: '#ffffff',
            scale: 1,
            logging: false,
            useCORS: false,
            allowTaint: true,
            onclone: (clonedDoc) => {
              // Remove problematic elements from clone
              const clonedElement = clonedDoc.getElementById('exportable-content')
              if (clonedElement) {
                // Remove any potentially problematic elements
                const buttons = clonedElement.querySelectorAll('button, .dropdown-menu, [role="button"]')
                buttons.forEach(btn => btn.remove())
                
                // Convert oklch colors to hex
                const allElements = clonedElement.querySelectorAll('*')
                allElements.forEach(el => {
                  const computedStyle = window.getComputedStyle(el)
                  if (computedStyle.position === 'fixed' || computedStyle.position === 'sticky') {
                    el.style.position = 'static'
                  }
                  
                  // Convert oklch colors to safe alternatives
                  if (computedStyle.backgroundColor?.includes('oklch')) {
                    el.style.backgroundColor = '#ffffff'
                  }
                  if (computedStyle.color?.includes('oklch')) {
                    el.style.color = '#000000'
                  }
                  
                  // Remove any CSS variables that might contain oklch
                  el.style.removeProperty('--tw-bg-opacity')
                  el.style.removeProperty('--tw-text-opacity')
                })
              }
            }
          }
        },
        {
          name: 'safe-colors',
          config: {
            backgroundColor: '#ffffff',
            scale: 1,
            logging: false,
            useCORS: false,
            allowTaint: true,
            onclone: (clonedDoc) => {
              const clonedElement = clonedDoc.getElementById('exportable-content')
              if (clonedElement) {
                // Force all elements to use safe colors
                const allElements = clonedElement.querySelectorAll('*')
                allElements.forEach(el => {
                  el.style.backgroundColor = '#ffffff'
                  el.style.color = '#000000'
                  el.style.border = '1px solid #cccccc'
                  // Remove all custom properties
                  const style = el.style
                  for (let i = style.length - 1; i >= 0; i--) {
                    const property = style[i]
                    if (property.startsWith('--')) {
                      style.removeProperty(property)
                    }
                  }
                })
              }
            }
          }
        }
      ]
      
      for (const attempt of attempts) {
        try {
          console.log(`🎨 Attempting html2canvas with ${attempt.name} configuration...`)
          canvas = await html2canvas(element, attempt.config)
          console.log(`✅ ${attempt.name} configuration successful`)
          break
        } catch (error) {
          console.warn(`⚠️ ${attempt.name} configuration failed:`, error.message)
          if (attempt === attempts[attempts.length - 1]) {
            throw new Error(`All capture methods failed. Last error: ${error.message}`)
          }
        }
      }
      
      if (!canvas) {
        throw new Error('Failed to capture content with any method')
      }

      console.log('🎨 Canvas created successfully:', canvas.width, 'x', canvas.height)

      // Create PDF
      const imgData = canvas.toDataURL('image/png', 0.8)
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      })
      
      // Add image to PDF
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
      
      // Save PDF
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const fileName = `stock-positions-${timestamp}.pdf`
      
      pdf.save(fileName)
      
      console.log('✅ PDF saved successfully:', fileName)
      showActionsStatus('PDF exported successfully!')
      
    } catch (error) {
      console.error('❌ Error exporting PDF:', error)
      console.error('❌ Error details:', error.message, error.stack)
      
      // Provide more helpful error messages
      let errorMessage = 'PDF export failed'
      if (error.message.includes('CORS')) {
        errorMessage = 'PDF export failed: Security restrictions. Try refreshing the page.'
      } else if (error.message.includes('memory') || error.message.includes('size')) {
        errorMessage = 'PDF export failed: Content too large. Try filtering stocks first.'
      } else if (error.message.includes('capture')) {
        errorMessage = 'PDF export failed: Cannot capture page content. Try reducing data or refresh page.'
      } else {
        errorMessage = `PDF export failed: ${error.message}`
      }
      
      setRefreshMessage(errorMessage)
      setTimeout(() => setRefreshMessage(null), 5000)
    }
  }

  const generatePDFFromTableData = async () => {
    try {
      console.log('📊 Generating PDF from table data...')
      
      // Get current filtered stocks
      const filteredStocks = getFilteredStocks()
      
      if (filteredStocks.length === 0) {
        throw new Error('No stocks to export')
      }
      
      // Get current theme
      const currentTheme = theme || 'dark'
      const isDarkTheme = currentTheme === 'dark'
      
      // Create PDF with standard page size
      const pdf = new jsPDF('landscape', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      
      // Prepare table data with all columns - add defensive checks
      const tableData = filteredStocks.map(stock => {
        // Ensure stock object exists and has required properties
        if (!stock) return null;
        
        return [
          stock.date || '-',
          stock.ticker || 'UNKNOWN',
          stock.calloutPrice ? `$${stock.calloutPrice.toFixed(2)}` : '$0.00',
          stock.target1 ? `$${stock.target1.toFixed(2)}` : '-',
          stock.target2 ? `$${stock.target2.toFixed(2)}` : '-',
          stock.target3 ? `$${stock.target3.toFixed(2)}` : '-',
          stock.stopLoss ? `$${stock.stopLoss.toFixed(2)}` : '-',
          stock.buyZoneLow && stock.buyZoneHigh ? `${stock.buyZoneLow.toFixed(2)}-${stock.buyZoneHigh.toFixed(2)}` : (stock.buyZoneLow ? `$${stock.buyZoneLow.toFixed(2)}+` : (stock.buyZoneHigh ? `$${stock.buyZoneHigh.toFixed(2)}` : '-')),
          stock.currentPrice ? `$${stock.currentPrice.toFixed(2)}` : '$0.00',
          stock.percentSinceCallout !== undefined && stock.percentSinceCallout !== null ? `${stock.percentSinceCallout >= 0 ? '+' : ''}${stock.percentSinceCallout.toFixed(2)}%` : '0.00%',
          stock.target1Hit || '-',
          stock.target2Hit || '-',
          stock.target3Hit || '-',
          stock.stopHit || '-',
          stock.buyZoneHit || '-',
          stock.percentMade !== undefined && stock.percentMade !== null && stock.percentMade !== 0 ? `${stock.percentMade >= 0 ? '+' : ''}${stock.percentMade.toFixed(2)}%` : '-',
          stock.target1Date || '-',
          stock.target2Date || '-',
          stock.target3Date || '-'
        ];
      }).filter(row => row !== null); // Remove any null rows
      
      // Add table with better styling - optimized for landscape A4
      pdf.setFontSize(8) // Increased font size for better readability
      
      const headers = ['Date', 'Ticker', 'Callout', 'T1', 'T2', 'T3', 'Stop', 'Buy Zone', 'Current', '% Change', 'T1', 'T2', 'T3', 'Stop', 'Buy', '% Made', 'T1 Date', 'T2 Date', 'T3 Date']
      const columnWidths = [13, 19, 17, 13, 13, 13, 13, 21, 17, 15, 9, 9, 9, 11, 9, 13, 19, 19, 19] // Total: 267mm - maximized width to match card width (pageWidth - 30 = 267mm for A4 landscape)
      const startX = 15
      const startY = 85
      const rowHeight = 6.5 // Slightly larger row height for better readability
      
      // Theme-aware styling
      if (isDarkTheme) {
        // Dark theme styling
        pdf.setFillColor(30, 30, 30) // Dark background
        pdf.rect(0, 0, pageWidth, pageHeight, 'F')
        
        // Add title with site branding
        pdf.setFontSize(20)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(255, 255, 255) // White text
        pdf.text('tickey.', 15, 20)
        
        pdf.setFontSize(14)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(180, 180, 180) // Muted text color
        pdf.text('from call out, to cash out', 15, 28)
        
        // Add timestamp and filter info
        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(150, 150, 150)
        const timestamp = new Date().toLocaleString()
        pdf.text(`Generated: ${timestamp}`, 15, 36)
        pdf.text(`Filter: ${selectedFilter === 'all' ? 'All Stocks' : 
                   selectedFilter === 'targetHits' ? 'Target Hits' :
                   selectedFilter === 'active' ? 'Active Positions' : 'Stop Loss Hit'}`, 15, 42)
        
        // Add summary cards styling
        pdf.setFillColor(40, 40, 40) // Card background
        pdf.roundedRect(15, 48, pageWidth - 30, 25, 3, 3, 'F')
        
        pdf.setFontSize(12)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(255, 255, 255)
        pdf.text('Total Callouts', 25, 58)
        pdf.text('Targets Hit', 80, 58)
        pdf.text('Stop Loss Hit', 140, 58)
        pdf.text('Avg. Performance', 200, 58)
        
        pdf.setFontSize(16)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(100, 255, 100) // Green for positive
        pdf.text(String(filteredStocks.length), 25, 68)
        
        const targetsHit = filteredStocks.filter(s => s.target1Hit === 'YES' || s.target2Hit === 'YES' || s.target3Hit === 'YES').length
        pdf.text(String(targetsHit), 80, 68)
        
        const stopLossHit = filteredStocks.filter(s => s.stopHit === 'YES').length
        pdf.text(String(stopLossHit), 140, 68)
        
        const totalPercent = filteredStocks.reduce((sum, stock) => sum + (stock.percentSinceCallout || 0), 0)
        const avgPercent = filteredStocks.length > 0 ? totalPercent / filteredStocks.length : 0
        const avgPercentText = avgPercent >= 0 ? `+${avgPercent.toFixed(2)}%` : `${avgPercent.toFixed(2)}%`
        pdf.setTextColor(avgPercent >= 0 ? 100 : 255, avgPercent >= 0 ? 255 : 100, 100) // Green or red
        pdf.text(avgPercentText, 200, 68)
        
        // Table styling for dark theme
        const startY = 85
        
        // Draw table header background
        pdf.setFillColor(50, 50, 50)
        pdf.rect(startX, startY - 5, columnWidths.reduce((a, b) => a + b, 0), rowHeight + 2, 'F')
        
        // Draw headers
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(8)
        pdf.setTextColor(255, 255, 255)
        headers.forEach((header, i) => {
          const x = startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0)
          pdf.text(header, x, startY)
        })
        
        // Draw rows with alternating background and proper pagination
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        
        const ROWS_PER_FIRST_PAGE = 17 // Adjusted for larger row height
        const ROWS_PER_SUBSEQUENT_PAGE = 26 // Adjusted for larger row height
        const HEADER_HEIGHT = rowHeight + 2
        const FOOTER_HEIGHT = 15
        const TOP_MARGIN = 15
        
        tableData.forEach((row, rowIndex) => {
          let y: number
          let currentPageRows: number
          
          if (rowIndex < ROWS_PER_FIRST_PAGE) {
            // First page - with headers and summary
            y = startY + (rowIndex + 1) * rowHeight
            currentPageRows = rowIndex + 1
          } else {
            // Subsequent pages - calculate which page and position
            const rowsAfterFirst = rowIndex - ROWS_PER_FIRST_PAGE
            const subsequentPageIndex = Math.floor(rowsAfterFirst / ROWS_PER_SUBSEQUENT_PAGE)
            const rowInCurrentPage = rowsAfterFirst % ROWS_PER_SUBSEQUENT_PAGE
            
            // Check if we need a new page
            if (rowInCurrentPage === 0) {
              pdf.addPage()
              // Add dark background to new page
              pdf.setFillColor(30, 30, 30)
              pdf.rect(0, 0, pageWidth, pageHeight, 'F')
              
              // Add table headers for subsequent pages
              const headerY = TOP_MARGIN + 5
              pdf.setFillColor(50, 50, 50)
              pdf.rect(startX, headerY - 5, columnWidths.reduce((a, b) => a + b, 0), rowHeight + 2, 'F')
              
              pdf.setFont('helvetica', 'bold')
              pdf.setFontSize(8)
              pdf.setTextColor(255, 255, 255)
              headers.forEach((header, i) => {
                const x = startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0)
                pdf.text(header, x, headerY)
              })
              
              pdf.setFont('helvetica', 'normal')
              pdf.setFontSize(8)
            }
            
            // Calculate y position for subsequent pages
            y = TOP_MARGIN + HEADER_HEIGHT + (rowInCurrentPage + 1) * rowHeight
          }
          
          // Add alternating row background (reset pattern for each page)
          const rowInCurrentPage = rowIndex < ROWS_PER_FIRST_PAGE 
            ? rowIndex 
            : (rowIndex - ROWS_PER_FIRST_PAGE) % ROWS_PER_SUBSEQUENT_PAGE
            
          if (rowInCurrentPage % 2 === 0) {
            pdf.setFillColor(40, 40, 40)
            pdf.rect(startX, y - 5, columnWidths.reduce((a, b) => a + b, 0), rowHeight, 'F')
          }
          
          // No row highlighting - only alternating background colors
          
          // Draw cell content with appropriate colors
          row.forEach((cell, cellIndex) => {
            const x = startX + columnWidths.slice(0, cellIndex).reduce((a, b) => a + b, 0)
            
            // Set text color based on content
            if (cellIndex === 9) { // % Change
              pdf.setTextColor(cell.includes('+') ? 100 : 255, cell.includes('+') ? 255 : 100, 100)
            } else if (cellIndex === 10 || cellIndex === 11 || cellIndex === 12 || cellIndex === 13 || cellIndex === 14) { // YES/NO status columns
              if (cell === 'YES') {
                pdf.setTextColor(100, 255, 100) // Green for YES
              } else if (cell === 'NO') {
                pdf.setTextColor(255, 100, 100) // Red for NO
              } else {
                pdf.setTextColor(220, 220, 220) // Gray for other values
              }
            } else if (cellIndex === 15) { // % Made
              if (cell.includes('-')) {
                pdf.setTextColor(255, 100, 100) // Red for negative
              } else if (cell !== '-' && cell !== '') {
                pdf.setTextColor(100, 255, 100) // Green for positive values only
              } else {
                pdf.setTextColor(220, 220, 220) // Default gray for zero/no value
              }
            } else {
              pdf.setTextColor(220, 220, 220) // Default light gray for all other columns including Current Price
            }
            
            pdf.text(String(cell), x, y)
          })
        })
        
        // Add footer to all pages
        const totalPages = pdf.internal.getNumberOfPages()
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i)
          pdf.setFontSize(8)
          pdf.setFont('helvetica', 'normal')
          pdf.setTextColor(100, 100, 100)
          pdf.text(`Page ${i} of ${totalPages}`, pageWidth - 25, pageHeight - 10)
        }
        
      } else {
        // Light theme styling
        pdf.setFillColor(255, 255, 255) // White background
        pdf.rect(0, 0, pageWidth, pageHeight, 'F')
        
        // Add title with site branding
        pdf.setFontSize(20)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(0, 0, 0) // Black text
        pdf.text('tickey.', 15, 20)
        
        pdf.setFontSize(14)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(100, 100, 100) // Muted text color
        pdf.text('from call out, to cash out', 15, 28)
        
        // Add timestamp and filter info
        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(120, 120, 120)
        const timestamp = new Date().toLocaleString()
        pdf.text(`Generated: ${timestamp}`, 15, 36)
        pdf.text(`Filter: ${selectedFilter === 'all' ? 'All Stocks' : 
                   selectedFilter === 'targetHits' ? 'Target Hits' :
                   selectedFilter === 'active' ? 'Active Positions' : 'Stop Loss Hit'}`, 15, 42)
        
        // Add summary cards styling
        pdf.setFillColor(248, 248, 248) // Light card background
        pdf.roundedRect(15, 48, pageWidth - 30, 25, 3, 3, 'F')
        
        pdf.setFontSize(12)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(0, 0, 0)
        pdf.text('Total Callouts', 25, 58)
        pdf.text('Targets Hit', 80, 58)
        pdf.text('Stop Loss Hit', 140, 58)
        pdf.text('Avg. Performance', 200, 58)
        
        pdf.setFontSize(16)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(0, 150, 0) // Green for positive
        pdf.text(String(filteredStocks.length), 25, 68)
        
        const targetsHit = filteredStocks.filter(s => s.target1Hit === 'YES' || s.target2Hit === 'YES' || s.target3Hit === 'YES').length
        pdf.text(String(targetsHit), 80, 68)
        
        const stopLossHit = filteredStocks.filter(s => s.stopHit === 'YES').length
        pdf.text(String(stopLossHit), 140, 68)
        
        const totalPercent = filteredStocks.reduce((sum, stock) => sum + (stock.percentSinceCallout || 0), 0)
        const avgPercent = filteredStocks.length > 0 ? totalPercent / filteredStocks.length : 0
        const avgPercentText = avgPercent >= 0 ? `+${avgPercent.toFixed(2)}%` : `${avgPercent.toFixed(2)}%`
        pdf.setTextColor(avgPercent >= 0 ? 0 : 200, avgPercent >= 0 ? 150 : 0, 0) // Green or red
        pdf.text(avgPercentText, 200, 68)
        
        // Table styling for light theme
        const startY = 85
        
        // Draw table header background
        pdf.setFillColor(240, 240, 240)
        pdf.rect(startX, startY - 5, columnWidths.reduce((a, b) => a + b, 0), rowHeight + 2, 'F')
        
        // Draw headers
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(8)
        pdf.setTextColor(0, 0, 0)
        headers.forEach((header, i) => {
          const x = startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0)
          pdf.text(header, x, startY)
        })
        
        // Draw rows with alternating background and proper pagination
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        
        const ROWS_PER_FIRST_PAGE = 17 // Adjusted for larger row height
        const ROWS_PER_SUBSEQUENT_PAGE = 26 // Adjusted for larger row height
        const HEADER_HEIGHT = rowHeight + 2
        const FOOTER_HEIGHT = 15
        const TOP_MARGIN = 15
        
        tableData.forEach((row, rowIndex) => {
          let y: number
          let currentPageRows: number
          
          if (rowIndex < ROWS_PER_FIRST_PAGE) {
            // First page - with headers and summary
            y = startY + (rowIndex + 1) * rowHeight
            currentPageRows = rowIndex + 1
          } else {
            // Subsequent pages - calculate which page and position
            const rowsAfterFirst = rowIndex - ROWS_PER_FIRST_PAGE
            const subsequentPageIndex = Math.floor(rowsAfterFirst / ROWS_PER_SUBSEQUENT_PAGE)
            const rowInCurrentPage = rowsAfterFirst % ROWS_PER_SUBSEQUENT_PAGE
            
            // Check if we need a new page
            if (rowInCurrentPage === 0) {
              pdf.addPage()
              // Add light background to new page
              pdf.setFillColor(255, 255, 255)
              pdf.rect(0, 0, pageWidth, pageHeight, 'F')
              
              // Add table headers for subsequent pages
              const headerY = TOP_MARGIN + 5
              pdf.setFillColor(248, 248, 248)
              pdf.rect(startX, headerY - 5, columnWidths.reduce((a, b) => a + b, 0), rowHeight + 2, 'F')
              
              pdf.setFont('helvetica', 'bold')
              pdf.setFontSize(8)
              pdf.setTextColor(0, 0, 0)
              headers.forEach((header, i) => {
                const x = startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0)
                pdf.text(header, x, headerY)
              })
              
              pdf.setFont('helvetica', 'normal')
              pdf.setFontSize(8)
            }
            
            // Calculate y position for subsequent pages
            y = TOP_MARGIN + HEADER_HEIGHT + (rowInCurrentPage + 1) * rowHeight
          }
          
          // Add alternating row background (reset pattern for each page)
          const rowInCurrentPage = rowIndex < ROWS_PER_FIRST_PAGE 
            ? rowIndex 
            : (rowIndex - ROWS_PER_FIRST_PAGE) % ROWS_PER_SUBSEQUENT_PAGE
            
          if (rowInCurrentPage % 2 === 0) {
            pdf.setFillColor(248, 248, 248)
            pdf.rect(startX, y - 5, columnWidths.reduce((a, b) => a + b, 0), rowHeight, 'F')
          }
          
          // No row highlighting - only alternating background colors
          
          // Draw cell content with appropriate colors
          row.forEach((cell, cellIndex) => {
            const x = startX + columnWidths.slice(0, cellIndex).reduce((a, b) => a + b, 0)
            
            // Set text color based on content
            if (cellIndex === 9) { // % Change
              pdf.setTextColor(cell.includes('+') ? 0 : 200, cell.includes('+') ? 150 : 0, 0)
            } else if (cellIndex === 10 || cellIndex === 11 || cellIndex === 12 || cellIndex === 13 || cellIndex === 14) { // YES/NO status columns
              if (cell === 'YES') {
                pdf.setTextColor(0, 150, 0) // Green for YES
              } else if (cell === 'NO') {
                pdf.setTextColor(200, 0, 0) // Red for NO
              } else {
                pdf.setTextColor(100, 100, 100) // Gray for other values
              }
            } else if (cellIndex === 15) { // % Made
              if (cell.includes('-')) {
                pdf.setTextColor(200, 0, 0) // Red for negative
              } else if (cell !== '-' && cell !== '') {
                pdf.setTextColor(0, 150, 0) // Green for positive values only
              } else {
                pdf.setTextColor(100, 100, 100) // Default gray for zero/no value
              }
            } else {
              pdf.setTextColor(50, 50, 50) // Default dark gray for all other columns including Current Price
            }
            
            pdf.text(String(cell), x, y)
          })
        })
        
        // Add footer to all pages
        const totalPages = pdf.internal.getNumberOfPages()
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i)
          pdf.setFontSize(8)
          pdf.setFont('helvetica', 'normal')
          pdf.setTextColor(120, 120, 120)
          pdf.text(`Page ${i} of ${totalPages}`, pageWidth - 25, pageHeight - 10)
        }
      }
      
      // Save PDF
      const fileTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const fileName = `tickey-stock-positions-${fileTimestamp}.pdf`
      
      pdf.save(fileName)
      
      showActionsStatus('PDF exported successfully!')
      
      return pdf
      
    } catch (error) {
      console.error('❌ Error generating PDF from table data:', error)
      throw error
    }
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-mono">
              tickey.
            </h1>
            <p className="text-muted-foreground font-mono">musa's version</p>
            <div className="flex items-center gap-4 mt-1">
              {lastUpdated && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3" />
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </p>
              )}
              {stocks.length > 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                  <RefreshCw className="w-3 h-3" />
                  Auto-refresh: {stocks.length >= 30 ? '1 min' : '30 sec'}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={isLoading}>
                  <MoreHorizontal className="w-4 h-4 mr-2" />
                  {actionsStatusMessage || 'Actions'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsMassImportDialogOpen(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Mass Import
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportAsPDF}>
                  <Download className="w-4 h-4 mr-2" />
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                  {theme === "dark" ? (
                    <Sun className="w-4 h-4 mr-2" />
                  ) : (
                    <Moon className="w-4 h-4 mr-2" />
                  )}
                  Toggle {theme === "dark" ? "Light" : "Dark"} Mode
                </DropdownMenuItem>
                <DropdownMenuItem onClick={clearAllStocks} className="text-red-600">
                  <Trash className="w-4 h-4 mr-2" />
                  Clear All Stocks
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={refreshPrices} disabled={isLoading} variant="outline">
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {refreshStatusMessage || 'Refresh'}
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Stock
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Stock</DialogTitle>
                  <DialogDescription>
                    Enter a stock ticker to add it to your portfolio. The system will automatically fetch the current market price.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                  <div className="relative">
                    <Label htmlFor="ticker">Ticker Symbol</Label>
                    <div className="relative">
                      <Input
                        id="ticker"
                        value={newStock.ticker}
                        onChange={(e) => {
                          setNewStock({ ...newStock, ticker: e.target.value })
                          searchStocks(e.target.value)
                        }}
                        placeholder="e.g., AAPL"
                        className="pr-8"
                      />
                      {isSearchingStocks && (
                        <Search className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin" />
                      )}
                    </div>
                    {stockSearchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {stockSearchResults.map((result) => (
                          <button
                            key={result.symbol}
                            onClick={() => selectStock(result.symbol)}
                            className="w-full px-3 py-2 text-left hover:bg-muted flex items-center justify-between group cursor-pointer"
                          >
                            <div>
                              <div className="font-medium">{result.displaySymbol || result.symbol}</div>
                              <div className="text-sm text-muted-foreground truncate">{result.name}</div>
                            </div>
                            <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="date">Date (Optional)</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newStock.date}
                      onChange={(e) => setNewStock({ ...newStock, date: e.target.value })}
                      placeholder="YYYY-MM-DD"
                    />
                  </div>
                  <div>
                    <Label htmlFor="calloutPrice">Callout Price</Label>
                    <Input
                      id="calloutPrice"
                      type="number"
                      step="0.01"
                      value={newStock.calloutPrice}
                      onChange={(e) => setNewStock({ ...newStock, calloutPrice: e.target.value })}
                      placeholder="e.g., 150.00"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label htmlFor="target1">Target 1</Label>
                      <Input
                        id="target1"
                        type="number"
                        step="0.01"
                        value={newStock.target1}
                        onChange={(e) => setNewStock({ ...newStock, target1: e.target.value })}
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <Label htmlFor="target2">Target 2</Label>
                      <Input
                        id="target2"
                        type="number"
                        step="0.01"
                        value={newStock.target2}
                        onChange={(e) => setNewStock({ ...newStock, target2: e.target.value })}
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <Label htmlFor="target3">Target 3</Label>
                      <Input
                        id="target3"
                        type="number"
                        step="0.01"
                        value={newStock.target3}
                        onChange={(e) => setNewStock({ ...newStock, target3: e.target.value })}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="stopLoss">Stop Loss</Label>
                    <Input
                      id="stopLoss"
                      type="number"
                      step="0.01"
                      value={newStock.stopLoss}
                      onChange={(e) => setNewStock({ ...newStock, stopLoss: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="buyZoneLow">Buy Zone Low</Label>
                      <Input
                        id="buyZoneLow"
                        type="number"
                        step="0.01"
                        value={newStock.buyZoneLow}
                        onChange={(e) => setNewStock({ ...newStock, buyZoneLow: e.target.value })}
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <Label htmlFor="buyZoneHigh">Buy Zone High</Label>
                      <Input
                        id="buyZoneHigh"
                        type="number"
                        step="0.01"
                        value={newStock.buyZoneHigh}
                        onChange={(e) => setNewStock({ ...newStock, buyZoneHigh: e.target.value })}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <Button onClick={addStock} disabled={isLoading} className="w-full">
                    {isLoading ? 'Adding...' : 'Add Stock'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Mass Import Dialog */}
        <Dialog open={isMassImportDialogOpen} onOpenChange={setIsMassImportDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Mass Import Stocks</DialogTitle>
              <DialogDescription>
                Enter multiple stock tickers to add them to your portfolio. The system will fetch current market prices for all tickers.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="massImportTickers">Stock Tickers</Label>
                <Textarea
                  id="massImportTickers"
                  value={massImportTickers}
                  onChange={(e) => setMassImportTickers(e.target.value)}
                  placeholder="Enter one ticker per line:&#10;AAPL&#10;GOOGL&#10;MSFT&#10;TSLA"
                  className="min-h-32 font-mono"
                  disabled={isLoading}
                />
              </div>

              {isLoading && (
                <p className="text-sm text-blue-600 font-mono">Importing stocks... Please wait.</p>
              )}
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsMassImportDialogOpen(false)} disabled={isLoading}>
                  Cancel
                </Button>
                <Button onClick={massImportStocks} disabled={isLoading || !massImportTickers.trim()}>
                  {isLoading ? 'Importing...' : 'Import Stocks'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Clear All Confirmation Dialog */}
        <Dialog open={isClearAllDialogOpen} onOpenChange={setIsClearAllDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Clear All Stocks</DialogTitle>
              <DialogDescription>
                This action is irreversible, are you sure?
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="text-sm text-muted-foreground font-mono">
                This will permanently delete all {stocks.length} stock{stocks.length !== 1 ? 's' : ''} from your portfolio.
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsClearAllDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={confirmClearAllStocks} className="bg-red-600 hover:bg-red-700 text-white">
                  Yes, Clear All
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Portfolio Summary */}
        <div id="exportable-content" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium font-mono">
                Total Callouts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{getFilteredStocks().length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium font-mono">Targets Hit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 font-mono">
                {getFilteredStocks().filter(s => s.target1Hit === 'YES' || s.target2Hit === 'YES' || s.target3Hit === 'YES').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium font-mono">Stop Loss Hit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 font-mono">
                {getFilteredStocks().filter(s => s.stopHit === 'YES').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium font-mono">Avg. Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold font-mono ${getFilteredStocks().length > 0 ? 
                (getFilteredStocks().reduce((acc, s) => acc + s.percentSinceCallout, 0) / getFilteredStocks().length) >= 0 ? 'text-green-600' : 'text-red-600'
                : 'text-gray-600'}`}>
                {getFilteredStocks().length > 0 ? 
                  formatPercent(getFilteredStocks().reduce((acc, s) => acc + s.percentSinceCallout, 0) / getFilteredStocks().length)
                  : '0.00%'
                }
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stock Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-mono">
                Portfolio
              </CardTitle>
              <div className="flex items-center gap-2">
                {/* Filter Controls */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Filter className="w-4 h-4 mr-2" />
                      {selectedFilter === 'all' ? 'All Stocks' : 
                       selectedFilter === 'targetHits' ? 'Target Hits' :
                       selectedFilter === 'active' ? 'Active' : 'Stop Loss Hit'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSelectedFilter('all')}>
                      All Stocks
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSelectedFilter('targetHits')}>
                      Target Hits
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSelectedFilter('active')}>
                      Active
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSelectedFilter('stopLossHit')}>
                      Stop Loss Hit
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Sort Order Toggle */}
                <Button variant="outline" size="sm" onClick={toggleSortOrder}>
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Callout</TableHead>
                    <TableHead>Target 1</TableHead>
                    <TableHead>Target 2</TableHead>
                    <TableHead>Target 3</TableHead>
                    <TableHead>Stop Loss</TableHead>
                    <TableHead>Buy Zone</TableHead>
                    <TableHead>Current Price</TableHead>
                    <TableHead>% Since Callout</TableHead>
                    <TableHead>T1 Hit</TableHead>
                    <TableHead>T2 Hit</TableHead>
                    <TableHead>T3 Hit</TableHead>
                    <TableHead>Stop Hit</TableHead>
                    <TableHead>Buy Zone Hit</TableHead>
                    <TableHead>% Made</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getFilteredStocks().map((stock) => (
                    <TableRow key={stock.id} className={getRowClass(stock)}>
                      <TableCell 
                        className={`font-medium transition-colors ${editingCell?.id === stock.id && editingCell?.field === 'date' ? '' : 'cursor-pointer hover:bg-muted/50'}`}
                        onClick={() => !(editingCell?.id === stock.id && editingCell?.field === 'date') && startEditing(stock.id, 'date')}
                      >
                        {editingCell?.id === stock.id && editingCell?.field === 'date' ? (
                          <InlineEdit
                            value={stock.date}
                            onSave={(value) => saveEdit(stock.id, 'date', value)}
                            onCancel={cancelEditing}
                            placeholder="YYYY-MM-DD"
                            type="date"
                          />
                        ) : (
                          <div className="flex items-center gap-2 group">
                            {stock.date || '-'}
                            <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="font-medium">
                        <TradingViewChartModal ticker={stock.ticker}>
                          <Button 
                            variant="link" 
                            className="h-auto p-0 font-medium text-primary hover:text-primary/80 hover:underline"
                          >
                            {stock.ticker}
                          </Button>
                        </TradingViewChartModal>
                      </TableCell>

                      <TableCell 
                        className={`font-medium transition-colors ${editingCell?.id === stock.id && editingCell?.field === 'calloutPrice' ? '' : 'cursor-pointer hover:bg-muted/50'}`}
                        onClick={() => !(editingCell?.id === stock.id && editingCell?.field === 'calloutPrice') && startEditing(stock.id, 'calloutPrice')}
                      >
                        {editingCell?.id === stock.id && editingCell?.field === 'calloutPrice' ? (
                          <InlineEdit
                            value={stock.calloutPrice}
                            onSave={(value) => saveEdit(stock.id, 'calloutPrice', value)}
                            onCancel={cancelEditing}
                            placeholder="0.00"
                          />
                        ) : (
                          <div className="flex items-center gap-2 group">
                            ${stock.calloutPrice ? stock.calloutPrice.toFixed(2) : '0.00'}
                            <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                          </div>
                        )}
                      </TableCell>

                      <TableCell 
                        className={`transition-colors ${editingCell?.id === stock.id && editingCell?.field === 'target1' ? '' : 'cursor-pointer hover:bg-muted/50'}`}
                        onClick={() => !(editingCell?.id === stock.id && editingCell?.field === 'target1') && startEditing(stock.id, 'target1')}
                      >
                        {editingCell?.id === stock.id && editingCell?.field === 'target1' ? (
                          <InlineEdit
                            value={stock.target1 ?? null}
                            onSave={(value) => saveEdit(stock.id, 'target1', value)}
                            onCancel={cancelEditing}
                            placeholder="0.00"
                          />
                        ) : (
                          <div className="flex items-center gap-2 group">
                            {stock.target1 ? `$${stock.target1.toFixed(2)}` : '-'}
                            <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                          </div>
                        )}
                      </TableCell>

                      <TableCell 
                        className={`transition-colors ${editingCell?.id === stock.id && editingCell?.field === 'target2' ? '' : 'cursor-pointer hover:bg-muted/50'}`}
                        onClick={() => !(editingCell?.id === stock.id && editingCell?.field === 'target2') && startEditing(stock.id, 'target2')}
                      >
                        {editingCell?.id === stock.id && editingCell?.field === 'target2' ? (
                          <InlineEdit
                            value={stock.target2 ?? null}
                            onSave={(value) => saveEdit(stock.id, 'target2', value)}
                            onCancel={cancelEditing}
                            placeholder="0.00"
                          />
                        ) : (
                          <div className="flex items-center gap-2 group">
                            {stock.target2 ? `$${stock.target2.toFixed(2)}` : '-'}
                            <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                          </div>
                        )}
                      </TableCell>

                      <TableCell 
                        className={`transition-colors ${editingCell?.id === stock.id && editingCell?.field === 'target3' ? '' : 'cursor-pointer hover:bg-muted/50'}`}
                        onClick={() => !(editingCell?.id === stock.id && editingCell?.field === 'target3') && startEditing(stock.id, 'target3')}
                      >
                        {editingCell?.id === stock.id && editingCell?.field === 'target3' ? (
                          <InlineEdit
                            value={stock.target3 ?? null}
                            onSave={(value) => saveEdit(stock.id, 'target3', value)}
                            onCancel={cancelEditing}
                            placeholder="0.00"
                          />
                        ) : (
                          <div className="flex items-center gap-2 group">
                            {stock.target3 ? `$${stock.target3.toFixed(2)}` : '-'}
                            <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                          </div>
                        )}
                      </TableCell>

                      <TableCell 
                        className={`transition-colors ${editingCell?.id === stock.id && editingCell?.field === 'stopLoss' ? '' : 'cursor-pointer hover:bg-muted/50'}`}
                        onClick={() => !(editingCell?.id === stock.id && editingCell?.field === 'stopLoss') && startEditing(stock.id, 'stopLoss')}
                      >
                        {editingCell?.id === stock.id && editingCell?.field === 'stopLoss' ? (
                          <InlineEdit
                            value={stock.stopLoss ?? null}
                            onSave={(value) => saveEdit(stock.id, 'stopLoss', value)}
                            onCancel={cancelEditing}
                            placeholder="0.00"
                          />
                        ) : (
                          <div className="flex items-center gap-2 group">
                            {stock.stopLoss ? `$${stock.stopLoss.toFixed(2)}` : '-'}
                            <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                          </div>
                        )}
                      </TableCell>

                      <TableCell
                        className={`transition-colors ${editingCell?.id === stock.id && (editingCell?.field === 'buyZoneLow' || editingCell?.field === 'buyZoneHigh') ? '' : 'cursor-pointer hover:bg-muted/50'}`}
                        onClick={() => {
                          if (!(editingCell?.id === stock.id && (editingCell?.field === 'buyZoneLow' || editingCell?.field === 'buyZoneHigh'))) {
                            startEditing(stock.id, 'buyZoneLow')
                          }
                        }}
                      >
                        {editingCell?.id === stock.id && (editingCell?.field === 'buyZoneLow' || editingCell?.field === 'buyZoneHigh') ? (
                          <div className="flex items-center gap-1">
                            <InlineEdit
                              value={editingCell?.field === 'buyZoneLow' ? (stock.buyZoneLow ?? null) : (stock.buyZoneHigh ?? null)}
                              onSave={(value) => {
                                saveEdit(stock.id, editingCell?.field === 'buyZoneLow' ? 'buyZoneLow' : 'buyZoneHigh', value)
                                if (editingCell?.field === 'buyZoneLow' && value !== null) {
                                  setTimeout(() => startEditing(stock.id, 'buyZoneHigh'), 100)
                                }
                              }}
                              onCancel={cancelEditing}
                              placeholder="0.00"
                            />
                            {editingCell?.field === 'buyZoneLow' && <span className="text-sm text-muted-foreground">-</span>}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            {stock.buyZoneLow && stock.buyZoneHigh ? 
                              `$${stock.buyZoneLow.toFixed(2)}-$${stock.buyZoneHigh.toFixed(2)}` : 
                              (stock.buyZoneLow ? `$${stock.buyZoneLow.toFixed(2)}+` : (stock.buyZoneHigh ? `$${stock.buyZoneHigh.toFixed(2)}` : '-'))
                            }
                            <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1">
                          ${stock.currentPrice ? stock.currentPrice.toFixed(2) : '0.00'}
                          {stock.percentSinceCallout >= 0 ? (
                            <TrendingUp className="w-4 h-4 text-green-500" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                      </TableCell>

                      <TableCell className={stock.percentSinceCallout >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatPercent(stock.percentSinceCallout)}
                      </TableCell>

                      {/* T1 Hit with Date */}
                      <TableCell>
                        <div className="flex flex-col items-center">
                          {getStatusBadge(stock.target1Hit)}
                          {stock.target1Date && (
                            <span className="text-xs text-muted-foreground mt-1">{stock.target1Date}</span>
                          )}
                        </div>
                      </TableCell>

                      {/* T2 Hit with Date */}
                      <TableCell>
                        <div className="flex flex-col items-center">
                          {getStatusBadge(stock.target2Hit)}
                          {stock.target2Date && (
                            <span className="text-xs text-muted-foreground mt-1">{stock.target2Date}</span>
                          )}
                        </div>
                      </TableCell>

                      {/* T3 Hit with Date */}
                      <TableCell>
                        <div className="flex flex-col items-center">
                          {getStatusBadge(stock.target3Hit)}
                          {stock.target3Date && (
                            <span className="text-xs text-muted-foreground mt-1">{stock.target3Date}</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>{getStatusBadge(stock.stopHit)}</TableCell>
                      <TableCell>{getStatusBadge(stock.buyZoneHit)}</TableCell>
                      <TableCell className={stock.percentMade > 0 ? 'text-green-600' : stock.percentMade < 0 ? 'text-red-600' : ''}>
                        {stock.percentMade !== 0 ? formatPercent(stock.percentMade) : '-'}
                      </TableCell>

                      <TableCell>
                        <Button
                          onClick={() => deleteStock(stock.id)}
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {stocks.length === 0 && (
                <div className="text-center py-8 text-muted-foreground font-mono">
                  from call out, to cash out
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  )
}
