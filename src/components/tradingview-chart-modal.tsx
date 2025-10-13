'use client'

import { useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, TrendingUp, ExternalLink, Upload, X, Image as ImageIcon } from 'lucide-react'

interface TradingViewChartModalProps {
  ticker: string
  children: React.ReactNode
}

interface TechnicalAnalysis {
  id: string
  imageData: string
  description: string
  timestamp: string
}

function TradingViewWidget({ ticker, theme }: { ticker: string; theme: string }) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!container.current) return
    
    // Clear any existing content
    container.current.innerHTML = ''
    
    const script = document.createElement("script")
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
    script.type = "text/javascript"
    script.async = true
    script.innerHTML = `
      {
        "allow_symbol_change": true,
        "calendar": false,
        "details": false,
        "hide_side_toolbar": true,
        "hide_top_toolbar": false,
        "hide_legend": false,
        "hide_volume": false,
        "hotlist": false,
        "interval": "D",
        "locale": "en",
        "save_image": true,
        "style": "1",
        "symbol": "NASDAQ:${ticker}",
        "theme": "${theme}",
        "timezone": "Etc/UTC",
        "backgroundColor": "${theme === 'dark' ? '#0F0F0F' : '#FFFFFF'}",
        "gridColor": "${theme === 'dark' ? 'rgba(242, 242, 242, 0.06)' : 'rgba(0, 0, 0, 0.06)'}",
        "watchlist": [],
        "withdateranges": false,
        "compareSymbols": [],
        "studies": [],
        "autosize": true
      }`
    
    container.current.appendChild(script)
    
    return () => {
      if (container.current && script) {
        container.current.removeChild(script)
      }
    }
  }, [ticker, theme])

  return (
    <div className="tradingview-widget-container w-full h-full" ref={container}>
      <div className="tradingview-widget-container__widget w-full h-full"></div>
      <div className="tradingview-widget-copyright">
        <a href={`https://www.tradingview.com/symbols/NASDAQ-${ticker}/`} rel="noopener nofollow" target="_blank">
          <span className="blue-text">{ticker} stock chart</span>
        </a>
        <span className="trademark"> by TradingView</span>
      </div>
    </div>
  )
}

export function TradingViewChartModal({ ticker, children }: TradingViewChartModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showTechnical, setShowTechnical] = useState(false)
  const [technicalAnalyses, setTechnicalAnalyses] = useState<TechnicalAnalysis[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [newDescription, setNewDescription] = useState('')
  const { theme } = useTheme()

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open) {
      loadTechnicalAnalyses()
    }
  }

  const toggleTechnical = () => {
    setShowTechnical(!showTechnical)
  }

  const loadTechnicalAnalyses = () => {
    try {
      const stored = localStorage.getItem(`technical_analysis_${ticker}`)
      if (stored) {
        setTechnicalAnalyses(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Failed to load technical analyses:', error)
    }
  }

  const saveTechnicalAnalyses = (analyses: TechnicalAnalysis[]) => {
    try {
      localStorage.setItem(`technical_analysis_${ticker}`, JSON.stringify(analyses))
    } catch (error) {
      console.error('Failed to save technical analyses:', error)
    }
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const reader = new FileReader()

    reader.onload = (e) => {
      const imageData = e.target?.result as string
      const newAnalysis: TechnicalAnalysis = {
        id: Date.now().toString(),
        imageData,
        description: newDescription,
        timestamp: new Date().toISOString()
      }

      const updatedAnalyses = [...technicalAnalyses, newAnalysis]
      setTechnicalAnalyses(updatedAnalyses)
      saveTechnicalAnalyses(updatedAnalyses)
      setNewDescription('')
      setIsUploading(false)
      
      // Switch to technical analysis view after upload
      setShowTechnical(true)
    }

    reader.onerror = () => {
      console.error('Failed to read image file')
      setIsUploading(false)
    }

    reader.readAsDataURL(file)
  }

  const deleteAnalysis = (id: string) => {
    const updatedAnalyses = technicalAnalyses.filter(analysis => analysis.id !== id)
    setTechnicalAnalyses(updatedAnalyses)
    saveTechnicalAnalyses(updatedAnalyses)
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-[90vw] sm:max-w-[1200px] w-[90vw] sm:w-[1200px] h-[85vh] overflow-hidden">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {ticker} {showTechnical ? 'Technical Analysis' : 'Stock Chart'}
          </DialogTitle>
        </DialogHeader>
        
        {/* Toggle Button */}
        <div className="mb-1">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleTechnical}
            className="flex items-center gap-2"
          >
            <ImageIcon className="h-4 w-4" />
            {showTechnical ? 'Show Chart' : `Technical Analysis (${technicalAnalyses.length})`}
          </Button>
        </div>
        
        {!showTechnical ? (
          // Chart View
          <div className="space-y-4 flex flex-col items-center justify-center w-full h-[70vh]">
            <div className="relative bg-muted rounded-lg overflow-hidden w-full h-[60vh]">
              <TradingViewWidget 
                ticker={ticker} 
                theme={theme === 'dark' ? 'dark' : 'light'} 
              />
            </div>
            
            <div className="flex items-center justify-between w-full">
              <div className="text-xs text-muted-foreground">
                Chart data provided by TradingView. Interactive features available.
              </div>
              <Button asChild variant="outline" size="sm">
                <a 
                  href={`https://www.tradingview.com/symbols/NASDAQ-${ticker}/`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  View on TradingView
                </a>
              </Button>
            </div>
          </div>
        ) : (
          // Technical Analysis View
          <div className="h-[70vh] overflow-hidden">
            <div className="h-full flex flex-col">
              {/* Upload Section - Only show when no images exist */}
              {technicalAnalyses.length === 0 && (
                <div className="border rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium">Add Technical Analysis</h3>
                    <Label htmlFor="technical-image-upload" className="cursor-pointer">
                      <div className="flex items-center gap-2 px-3 py-1 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                        <Upload className="h-4 w-4" />
                        {isUploading ? 'Uploading...' : 'Upload Image'}
                      </div>
                    </Label>
                    <Input
                      id="technical-image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={isUploading}
                    />
                  </div>
                  <Textarea
                    placeholder="Add your technical analysis notes..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="min-h-[60px] resize-none"
                  />
                </div>
              )}

              {/* Analyses List */}
              <div className="flex-1 overflow-auto">
                {technicalAnalyses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <ImageIcon className="h-12 w-12 mb-4" />
                    <p>No technical analysis yet</p>
                    <p className="text-sm">Upload an image and add notes to get started</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {technicalAnalyses.map((analysis) => (
                      <div key={analysis.id} className="relative group">
                        {/* Full-size image */}
                        <div className="relative bg-muted rounded-lg overflow-hidden w-full h-[60vh] mb-2">
                          <img
                            src={analysis.imageData}
                            alt="Technical analysis"
                            className="w-full h-full object-contain"
                          />
                          {/* Delete button overlay */}
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteAnalysis(analysis.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Technical analysis text below image */}
                        <div className="px-2 pb-2">
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-sm text-gray-600">
                              {new Date(analysis.timestamp).toLocaleDateString()} at {new Date(analysis.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                          <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">
                            {analysis.description || 'No description provided'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}