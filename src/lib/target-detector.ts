// Target detection logic extracted from API route

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

export function updateTargetsAndStops(stock: Stock, currentPrice: number) {
  const {
    calloutPrice,
    target1,
    target2,
    target3,
    stopLoss,
    buyZoneLow,
    buyZoneHigh,
    target1Hit,
    target2Hit,
    target3Hit,
    stopHit,
    buyZoneHit
  } = stock

  let updatedStock = { ...stock }
  
  // Calculate percent since callout
  const percentSinceCallout = calloutPrice !== 0 ? ((currentPrice - calloutPrice) / calloutPrice) * 100 : 0
  updatedStock.percentSinceCallout = percentSinceCallout
  updatedStock.currentPrice = currentPrice

  // Parse current hit status
  const hasT1Hit = target1Hit === 'YES'
  const hasT2Hit = target2Hit === 'YES'
  const hasT3Hit = target3Hit === 'YES'
  const hasAnyHit = hasT1Hit || hasT2Hit || hasT3Hit
  const hasAllHit = hasT1Hit && hasT2Hit && hasT3Hit
  const stopHitStatus = stopHit === 'YES'
  const stopDeactivated = stopHit === 'X'

  // Reset targets if price falls below target and was previously hit
  if (hasT1Hit && target1 && currentPrice < target1) {
    updatedStock.target1Hit = ''
    updatedStock.target1Date = undefined
  }
  
  if (hasT2Hit && target2 && currentPrice < target2) {
    updatedStock.target2Hit = ''
    updatedStock.target2Date = undefined
  }
  
  if (hasT3Hit && target3 && currentPrice < target3) {
    updatedStock.target3Hit = ''
    updatedStock.target3Date = undefined
  }

  // Recalculate after potential resets
  const newHasT1Hit = updatedStock.target1Hit === 'YES'
  const newHasT2Hit = updatedStock.target2Hit === 'YES'
  const newHasT3Hit = updatedStock.target3Hit === 'YES'
  const newHasAnyHit = newHasT1Hit || newHasT2Hit || newHasT3Hit

  let newHit = false
  let percentMade = 0
  let updatePercentMade = false

  // Check Target 1
  if (target1 && !newHasT1Hit && !stopHitStatus && currentPrice >= target1) {
    console.log(`🎯 Target 1 HIT for ${stock.ticker}: ${currentPrice} >= ${target1}`)
    updatedStock.target1Hit = 'YES'
    if (!updatedStock.target1Date) {
      updatedStock.target1Date = new Date().toISOString().split('T')[0]
    }
    newHit = true
    percentMade = calloutPrice !== 0 ? ((target1 - calloutPrice) / calloutPrice) * 100 : 0
    updatePercentMade = true
  }

  // Check Target 2
  if (target2 && !newHasT2Hit && !stopHitStatus && currentPrice >= target2) {
    console.log(`🎯 Target 2 HIT for ${stock.ticker}: ${currentPrice} >= ${target2}`)
    updatedStock.target2Hit = 'YES'
    if (!updatedStock.target2Date) {
      updatedStock.target2Date = new Date().toISOString().split('T')[0]
    }
    newHit = true
    percentMade = calloutPrice !== 0 ? ((target2 - calloutPrice) / calloutPrice) * 100 : 0
    updatePercentMade = true
  }

  // Check Target 3
  if (target3 && !newHasT3Hit && !stopHitStatus && currentPrice >= target3) {
    console.log(`🎯 Target 3 HIT for ${stock.ticker}: ${currentPrice} >= ${target3}`)
    updatedStock.target3Hit = 'YES'
    if (!updatedStock.target3Date) {
      updatedStock.target3Date = new Date().toISOString().split('T')[0]
    }
    newHit = true
    percentMade = calloutPrice !== 0 ? ((target3 - calloutPrice) / calloutPrice) * 100 : 0
    updatePercentMade = true
  }

  // Check Buy Zone
  if (buyZoneLow && buyZoneHigh) {
    // Full range defined - check if current price is within range
    if (currentPrice >= buyZoneLow && currentPrice <= buyZoneHigh) {
      console.log(`🛒 Buy Zone HIT for ${stock.ticker}: ${currentPrice} in range ${buyZoneLow}-${buyZoneHigh}`)
      updatedStock.buyZoneHit = 'YES'
    } else {
      updatedStock.buyZoneHit = 'NO'
      console.log(`📊 Buy Zone NO for ${stock.ticker}: ${currentPrice} not in range ${buyZoneLow}-${buyZoneHigh}`)
    }
  } else if (buyZoneLow && !buyZoneHigh) {
    // Only low defined - check if current price is at or below low
    if (currentPrice <= buyZoneLow) {
      console.log(`🛒 Buy Zone HIT for ${stock.ticker}: ${currentPrice} <= ${buyZoneLow}`)
      updatedStock.buyZoneHit = 'YES'
    } else {
      updatedStock.buyZoneHit = 'NO'
      console.log(`📊 Buy Zone NO for ${stock.ticker}: ${currentPrice} > ${buyZoneLow}`)
    }
  } else if (!buyZoneLow && buyZoneHigh) {
    // Only high defined - check if current price is at or below high
    if (currentPrice <= buyZoneHigh) {
      console.log(`🛒 Buy Zone HIT for ${stock.ticker}: ${currentPrice} <= ${buyZoneHigh}`)
      updatedStock.buyZoneHit = 'YES'
    } else {
      updatedStock.buyZoneHit = 'NO'
      console.log(`📊 Buy Zone NO for ${stock.ticker}: ${currentPrice} > ${buyZoneHigh}`)
    }
  } else {
    // No buy zone defined - clear the status
    updatedStock.buyZoneHit = ''
  }

  // Handle Stop Loss
  if (stopLoss && !stopHitStatus && !stopDeactivated && currentPrice <= stopLoss) {
    updatedStock.stopHit = 'YES'
    percentMade = calloutPrice !== 0 ? ((stopLoss - calloutPrice) / calloutPrice) * 100 : 0
    updatePercentMade = true
    // Set all targets to N/A since stop was hit
    if (target1) updatedStock.target1Hit = 'N/A'
    if (target2) updatedStock.target2Hit = 'N/A'
    if (target3) updatedStock.target3Hit = 'N/A'
  }

  // Set NO for targets that exist but aren't hit (only if no stop loss or stop loss is N/A)
  if (!stopHitStatus || stopHit === 'N/A') {
    if (target1 && !updatedStock.target1Hit) {
      updatedStock.target1Hit = 'NO'
      console.log(`📊 Target 1 NO for ${stock.ticker}: ${currentPrice} < ${target1}`)
    }
    if (target2 && !updatedStock.target2Hit) {
      updatedStock.target2Hit = 'NO'
      console.log(`📊 Target 2 NO for ${stock.ticker}: ${currentPrice} < ${target2}`)
    }
    if (target3 && !updatedStock.target3Hit) {
      updatedStock.target3Hit = 'NO'
      console.log(`📊 Target 3 NO for ${stock.ticker}: ${currentPrice} < ${target3}`)
    }
  }

  // Deactivate stop loss if ALL targets hit
  const finalHasT1Hit = updatedStock.target1Hit === 'YES'
  const finalHasT2Hit = updatedStock.target2Hit === 'YES'
  const finalHasT3Hit = updatedStock.target3Hit === 'YES'
  const finalHasAllHit = finalHasT1Hit && finalHasT2Hit && finalHasT3Hit
  
  if (finalHasAllHit && !stopDeactivated) {
    updatedStock.stopHit = 'X'
  } else if (!finalHasT1Hit && !finalHasT2Hit && !finalHasT3Hit && !updatedStock.stopHit) {
    if (stopLoss) updatedStock.stopHit = 'N/A'
  }

  // Update % made from call out only when targets or stop are hit
  if (updatePercentMade) {
    updatedStock.percentMade = percentMade
  }

  return updatedStock
}