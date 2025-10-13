// Cache to store recent prices to avoid excessive scraping
const priceCache = new Map<string, { price: number; timestamp: number }>()
const CACHE_DURATION = 25000 // 25 seconds (less than 30 second refresh)

export async function getTradingViewPrice(ticker: string): Promise<number> {
  try {
    // Check cache first
    const cached = priceCache.get(ticker.toUpperCase())
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`📈 Using cached price for ${ticker}: $${cached.price}`)
      return cached.price
    }

    console.log(`🔍 Fetching price from TradingView for ${ticker}`)
    
    // Try different exchange prefixes for the ticker
    const exchangePrefixes = ['NASDAQ', 'NYSE', 'AMEX', '']
    
    for (const prefix of exchangePrefixes) {
      try {
        const symbol = prefix ? `${prefix}:${ticker}` : ticker
        const tradingViewUrl = `https://www.tradingview.com/symbols/${symbol}/`
        
        console.log(`📊 Trying TradingView URL: ${tradingViewUrl}`)
        
        // Fetch the TradingView page
        const response = await fetch(tradingViewUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
          }
        })
        
        if (!response.ok) {
          console.log(`❌ Failed to fetch ${tradingViewUrl}: ${response.status}`)
          continue
        }
        
        const html = await response.text()
        
        // Try to extract price using multiple regex patterns
        const pricePatterns = [
          /"last":\s*({.*?"price":\s*([\d,]+\.?\d*).*?})/g,  // JSON-like structure
          /data-symbol="[^"]*"[^>]*>.*?\$?([\d,]+\.?\d*)/g,     // Data attribute pattern
          /class="[^"]*price[^"]*"[^>]*>\s*\$?([\d,]+\.?\d*)/g, // Price class pattern
          /\$?([\d,]+\.?\d*)\s*USD/g,                          // Simple price with USD
          /"price":\s*"?\$?([\d,]+\.?\d*)"?/g,                // JSON price field
          /last-price[^>]*>\s*\$?([\d,]+\.?\d*)/g,            // Last price pattern
          /current-price[^>]*>\s*\$?([\d,]+\.?\d*)/g,         // Current price pattern
        ]
        
        for (const pattern of pricePatterns) {
          const matches = [...html.matchAll(pattern)]
          for (const match of matches) {
            const priceStr = match[1] || match[2]
            if (priceStr) {
              const price = parseFloat(priceStr.replace(/,/g, ''))
              if (price > 0 && price < 100000) { // Reasonable price range
                // Cache the price
                priceCache.set(ticker.toUpperCase(), { price, timestamp: Date.now() })
                console.log(`💰 Found price for ${ticker} from ${tradingViewUrl}: $${price}`)
                return price
              }
            }
          }
        }
        
        // Try to find price in JavaScript data
        const jsDataPatterns = [
          /window\.initData\s*=\s*({.*?});/s,
          /window\.__INITIAL_STATE__\s*=\s*({.*?});/s,
          /"last":\s*{[^}]*"price":\s*([\d,]+\.?\d*)/g,
        ]
        
        for (const pattern of jsDataPatterns) {
          const match = html.match(pattern)
          if (match) {
            try {
              const dataStr = match[1] || match[0]
              const priceMatch = dataStr.match(/"price":\s*"?\$?([\d,]+\.?\d*)"?/)
              if (priceMatch) {
                const price = parseFloat(priceMatch[1].replace(/,/g, ''))
                if (price > 0 && price < 100000) {
                  priceCache.set(ticker.toUpperCase(), { price, timestamp: Date.now() })
                  console.log(`💰 Found price for ${ticker} from JS data: $${price}`)
                  return price
                }
              }
            } catch (e) {
              // Continue to next pattern
            }
          }
        }
        
        console.log(`⚠️ No price found in ${tradingViewUrl}`)
        
      } catch (error) {
        console.log(`❌ Error fetching ${prefix}:${ticker}:`, error instanceof Error ? error.message : error)
        continue
      }
    }
    
    // If all exchanges fail, try a more generic approach
    console.log(`🔄 Trying generic search for ${ticker}`)
    const genericUrls = [
      `https://www.tradingview.com/symbols/${ticker}/`,
      `https://www.tradingview.com/quotes/${ticker}/`,
    ]
    
    for (const url of genericUrls) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          }
        })
        
        if (response.ok) {
          const html = await response.text()
          const priceMatch = html.match(/\$?([\d,]+\.?\d*)/g)
          if (priceMatch) {
            for (const match of priceMatch) {
              const price = parseFloat(match.replace(/[$,]/g, ''))
              if (price > 0 && price < 100000) {
                priceCache.set(ticker.toUpperCase(), { price, timestamp: Date.now() })
                console.log(`💰 Found price for ${ticker} from generic search: $${price}`)
                return price
              }
            }
          }
        }
      } catch (error) {
        console.log(`❌ Error with generic URL ${url}:`, error instanceof Error ? error.message : error)
      }
    }
    
    throw new Error(`Could not extract price from TradingView for ${ticker}`)
    
  } catch (error) {
    console.error(`❌ Error fetching TradingView price for ${ticker}:`, error)
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