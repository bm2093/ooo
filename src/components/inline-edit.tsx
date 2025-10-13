'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Check, X } from 'lucide-react'

interface InlineEditProps {
  value: number | null | string
  onSave: (value: number | null | string) => void
  onCancel: () => void
  placeholder?: string
  type?: 'number' | 'text' | 'date'
}

export function InlineEdit({ 
  value, 
  onSave, 
  onCancel, 
  placeholder = "0.00",
  type = 'number' 
}: InlineEditProps) {
  const [editValue, setEditValue] = useState<string>(value?.toString() || '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [])

  const handleSave = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    let saveValue: number | null | string
    
    if (type === 'number') {
      saveValue = editValue ? parseFloat(editValue) : null
      if (editValue && isNaN(parseFloat(editValue))) {
        return // Invalid number, don't save
      }
    } else {
      saveValue = editValue
    }
    
    onSave(saveValue)
  }

  const handleCancel = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    onCancel()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        type={type === 'date' ? 'date' : type}
        step={type === 'number' ? '0.01' : undefined}
        placeholder={placeholder}
        className={`h-8 text-sm ${type === 'date' ? 'w-32' : 'w-24'}`}
      />
      <Button
        size="sm"
        variant="ghost"
        onClick={(e) => handleSave(e)}
        className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={(e) => handleCancel(e)}
        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}