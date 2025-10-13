import { NextRequest, NextResponse } from 'next/server'
import { localStorageService } from '@/lib/local-storage'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    const body = await request.json()
    
    const {
      calloutPrice,
      target1,
      target2,
      target3,
      stopLoss
    } = body

    // Validate that at least one field is provided
    if (calloutPrice === undefined && 
        target1 === undefined && 
        target2 === undefined && 
        target3 === undefined && 
        stopLoss === undefined) {
      return NextResponse.json({ 
        error: 'At least one field must be provided for update' 
      }, { status: 400 })
    }

    // Check if stock exists
    const existingStock = localStorageService.getStockById(id)
    if (!existingStock) {
      return NextResponse.json({ error: 'Stock not found' }, { status: 404 })
    }

    // Prepare update data with only provided fields
    const updateData: any = {}
    if (calloutPrice !== undefined) updateData.calloutPrice = calloutPrice
    if (target1 !== undefined) updateData.target1 = target1
    if (target2 !== undefined) updateData.target2 = target2
    if (target3 !== undefined) updateData.target3 = target3
    if (stopLoss !== undefined) updateData.stopLoss = stopLoss

    // Update the stock
    const updatedStock = localStorageService.updateStock(id, updateData)
    if (!updatedStock) {
      return NextResponse.json({ error: 'Failed to update stock' }, { status: 500 })
    }

    return NextResponse.json(updatedStock)
  } catch (error) {
    console.error('Failed to update stock:', error)
    return NextResponse.json({ error: 'Failed to update stock' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    
    // Check if stock exists
    const existingStock = localStorageService.getStockById(id)
    if (!existingStock) {
      return NextResponse.json({ error: 'Stock not found' }, { status: 404 })
    }

    // Delete the stock
    const deleted = localStorageService.deleteStock(id)
    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete stock' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Stock deleted successfully' })
  } catch (error) {
    console.error('Failed to delete stock:', error)
    return NextResponse.json({ error: 'Failed to delete stock' }, { status: 500 })
  }
}