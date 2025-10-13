// Multi-source stock price fetcher
// Uses various free financial data sources to avoid rate limiting and bot detection

const priceCache = new Map<string, { price: number; timestamp: number; source: string }>()
const CACHE_DURATION = 25000 // 25 seconds

// Source 1: Yahoo Finance (most reliable)
async function getYahooFinancePrice(ticker: string): Promise<number | null> {
  try {
    console.log(`📈 Trying Yahoo Finance for ${ticker}`)
    
    // Yahoo Finance API endpoint
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://finance.yahoo.com/',
      }
    })
    
    if (!response.ok) {
      console.log(`❌ Yahoo Finance failed: ${response.status}`)
      return null
    }
    
    const data = await response.json()
    
    // Extract price from Yahoo Finance response
    const chart = data.chart?.result?.[0]
    if (chart && chart.meta?.regularMarketPrice) {
      const price = chart.meta.regularMarketPrice
      if (price > 0 && price < 100000) {
        console.log(`💰 Yahoo Finance price for ${ticker}: $${price}`)
        return price
      }
    }
    
    // Try currentPrice as fallback
    if (chart && chart.indicators?.quote?.[0]?.close?.[0]) {
      const price = chart.indicators.quote[0].close[0]
      if (price && price > 0 && price < 100000) {
        console.log(`💰 Yahoo Finance close price for ${ticker}: $${price}`)
        return price
      }
    }
    
  } catch (error) {
    console.log(`❌ Yahoo Finance error for ${ticker}:`, error instanceof Error ? error.message : error)
  }
  
  return null
}

// Source 2: MarketWatch (scraping)
async function getMarketWatchPrice(ticker: string): Promise<number | null> {
  try {
    console.log(`📊 Trying MarketWatch for ${ticker}`)
    
    const url = `https://www.marketwatch.com/investing/stock/${ticker}`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    })
    
    if (!response.ok) {
      console.log(`❌ MarketWatch failed: ${response.status}`)
      return null
    }
    
    const html = await response.text()
    
    // MarketWatch specific patterns
    const patterns = [
      /"price":\s*"?\$?([\d,]+\.?\d*)"?/g,
      /class="value"[^>]*>\s*\$?([\d,]+\.?\d*)/g,
      /data-field="regularMarketPrice"[^>]*>\s*\$?([\d,]+\.?\d*)/g,
      /h3[^>]*class="intraday__price"[^>]*>\s*\$?([\d,]+\.?\d*)/g,
      /span[^>]*class="value"[^>]*>\s*\$?([\d,]+\.?\d*)/g,
    ]
    
    for (const pattern of patterns) {
      const matches = [...html.matchAll(pattern)]
      for (const match of matches) {
        const priceStr = match[1]
        if (priceStr) {
          const price = parseFloat(priceStr.replace(/,/g, ''))
          if (price > 0 && price < 100000) {
            console.log(`💰 MarketWatch price for ${ticker}: $${price}`)
            return price
          }
        }
      }
    }
    
  } catch (error) {
    console.log(`❌ MarketWatch error for ${ticker}:`, error instanceof Error ? error.message : error)
  }
  
  return null
}

// Source 3: CNN Money (scraping)
async function getCNNMoneyPrice(ticker: string): Promise<number | null> {
  try {
    console.log(`📰 Trying CNN Money for ${ticker}`)
    
    const url = `https://money.cnn.com/quote/quote.html?symb=${ticker}`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    })
    
    if (!response.ok) {
      console.log(`❌ CNN Money failed: ${response.status}`)
      return null
    }
    
    const html = await response.text()
    
    // CNN Money specific patterns
    const patterns = [
      /"streamDataField":\s*"([\d,]+\.?\d*)"/g,
      /class="wsod_fRight"[^>]*>\s*\$?([\d,]+\.?\d*)/g,
      /data-field="last_price"[^>]*>\s*\$?([\d,]+\.?\d*)/g,
    ]
    
    for (const pattern of patterns) {
      const matches = [...html.matchAll(pattern)]
      for (const match of matches) {
        const priceStr = match[1]
        if (priceStr) {
          const price = parseFloat(priceStr.replace(/,/g, ''))
          if (price > 0 && price < 100000) {
            console.log(`💰 CNN Money price for ${ticker}: $${price}`)
            return price
          }
        }
      }
    }
    
  } catch (error) {
    console.log(`❌ CNN Money error for ${ticker}:`, error instanceof Error ? error.message : error)
  }
  
  return null
}

// Source 4: Bloomberg (scraping)
async function getBloombergPrice(ticker: string): Promise<number | null> {
  try {
    console.log(`📈 Trying Bloomberg for ${ticker}`)
    
    const url = `https://www.bloomberg.com/quote/${ticker}:US`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    })
    
    if (!response.ok) {
      console.log(`❌ Bloomberg failed: ${response.status}`)
      return null
    }
    
    const html = await response.text()
    
    // Bloomberg specific patterns
    const patterns = [
      /"price":\s*"?\$?([\d,]+\.?\d*)"?/g,
      /class="priceText"[^>]*>\s*\$?([\d,]+\.?\d*)/g,
      /data-field="price"[^>]*>\s*\$?([\d,]+\.?\d*)/g,
    ]
    
    for (const pattern of patterns) {
      const matches = [...html.matchAll(pattern)]
      for (const match of matches) {
        const priceStr = match[1]
        if (priceStr) {
          const price = parseFloat(priceStr.replace(/,/g, ''))
          if (price > 0 && price < 100000) {
            console.log(`💰 Bloomberg price for ${ticker}: $${price}`)
            return price
          }
        }
      }
    }
    
  } catch (error) {
    console.log(`❌ Bloomberg error for ${ticker}:`, error instanceof Error ? error.message : error)
  }
  
  return null
}

// Source 5: Reuters (scraping)
async function getReutersPrice(ticker: string): Promise<number | null> {
  try {
    console.log(`📰 Trying Reuters for ${ticker}`)
    
    const url = `https://www.reuters.com/companies/${ticker}.O`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    })
    
    if (!response.ok) {
      console.log(`❌ Reuters failed: ${response.status}`)
      return null
    }
    
    const html = await response.text()
    
    // Reuters specific patterns
    const patterns = [
      /"value":\s*"?\$?([\d,]+\.?\d*)"?/g,
      /class="field-value"[^>]*>\s*\$?([\d,]+\.?\d*)/g,
      /data-field="lastPrice"[^>]*>\s*\$?([\d,]+\.?\d*)/g,
    ]
    
    for (const pattern of patterns) {
      const matches = [...html.matchAll(pattern)]
      for (const match of matches) {
        const priceStr = match[1]
        if (priceStr) {
          const price = parseFloat(priceStr.replace(/,/g, ''))
          if (price > 0 && price < 100000) {
            console.log(`💰 Reuters price for ${ticker}: $${price}`)
            return price
          }
        }
      }
    }
    
  } catch (error) {
    console.log(`❌ Reuters error for ${ticker}:`, error instanceof Error ? error.message : error)
  }
  
  return null
}

// Main function that tries all sources
export async function getStockPrice(ticker: string): Promise<number> {
  try {
    // Check cache first
    const cached = priceCache.get(ticker.toUpperCase())
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`📈 Using cached price for ${ticker}: $${cached.price} (${cached.source})`)
      return cached.price
    }

    console.log(`🔍 Fetching stock price for ${ticker} from multiple sources`)
    
    // Try sources in order of reliability
    const sources = [
      { name: 'Yahoo Finance', func: getYahooFinancePrice },
      { name: 'MarketWatch', func: getMarketWatchPrice },
      { name: 'CNN Money', func: getCNNMoneyPrice },
      { name: 'Bloomberg', func: getBloombergPrice },
      { name: 'Reuters', func: getReutersPrice },
    ]
    
    for (const source of sources) {
      try {
        const price = await source.func(ticker)
        if (price && price > 0 && price < 100000) {
          // Cache the successful result
          priceCache.set(ticker.toUpperCase(), { 
            price, 
            timestamp: Date.now(), 
            source: source.name 
          })
          console.log(`✅ Successfully got ${ticker} price from ${source.name}: $${price}`)
          return price
        }
      } catch (error) {
        console.log(`❌ ${source.name} failed for ${ticker}:`, error instanceof Error ? error.message : error)
        continue
      }
    }
    
    // If all sources fail, throw an error
    throw new Error(`Could not fetch price for ${ticker} from any source`)
    
  } catch (error) {
    console.error(`❌ Error fetching stock price for ${ticker}:`, error)
    throw error
  }
}

export function clearPriceCache(ticker?: string) {
  if (ticker) {
    priceCache.delete(ticker.toUpperCase())
  } else {
    priceCache.clear()
  }
}

export function getCachedPrice(ticker: string): number | null {
  const cached = priceCache.get(ticker.toUpperCase())
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.price
  }
  return null
}

export function getPriceSource(ticker: string): string | null {
  const cached = priceCache.get(ticker.toUpperCase())
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.source
  }
  return null
}