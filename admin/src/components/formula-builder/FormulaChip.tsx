import React from 'react'
import { ChipType } from '../../utils/formulaTypes'

export interface FormulaChipProps {
  value: string
  type: ChipType
  onDelete?: () => void
  onHover?: (hovering: boolean) => void
  'data-testid'?: string
}

/**
 * Individual chip component for displaying formula elements
 */
export const FormulaChip: React.FC<FormulaChipProps> = ({
  value,
  type,
  onDelete,
  onHover,
  'data-testid': testId,
}) => {
  const [isHovering, setIsHovering] = React.useState(false)
  const [touchStartX, setTouchStartX] = React.useState<number | null>(null)
  const [swipeDistance, setSwipeDistance] = React.useState(0)

  const getChipStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '6px 12px',
      margin: '4px',
      borderRadius: '16px',
      fontSize: '14px',
      fontWeight: 500,
      cursor: onDelete ? 'pointer' : 'default',
      transition: 'all 0.2s ease',
      position: 'relative',
      transform: `translateX(${swipeDistance}px)`,
      userSelect: 'none',
    }

    // Color schemes based on chip type
    const typeStyles: Record<ChipType, React.CSSProperties> = {
      variable: {
        backgroundColor: '#e3f2fd',
        color: '#1565c0',
        border: '1px solid #90caf9',
      },
      operator: {
        backgroundColor: '#fff3e0',
        color: '#e65100',
        border: '1px solid #ffb74d',
      },
      number: {
        backgroundColor: '#f3e5f5',
        color: '#6a1b9a',
        border: '1px solid #ce93d8',
      },
      function: {
        backgroundColor: '#e8f5e9',
        color: '#2e7d32',
        border: '1px solid #81c784',
      },
    }

    const hoverStyle: React.CSSProperties = isHovering && onDelete
      ? {
          transform: 'scale(1.05)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }
      : {}

    return { ...baseStyle, ...typeStyles[type], ...hoverStyle }
  }

  const handleMouseEnter = () => {
    setIsHovering(true)
    onHover?.(true)
  }

  const handleMouseLeave = () => {
    setIsHovering(false)
    onHover?.(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!onDelete) return
    setTouchStartX(e.touches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!onDelete || touchStartX === null) return
    const currentX = e.touches[0].clientX
    const distance = currentX - touchStartX
    
    // Only allow leftward swipe (negative distance)
    if (distance < 0) {
      setSwipeDistance(Math.max(distance, -80))
    }
  }

  const handleTouchEnd = () => {
    if (swipeDistance < -50 && onDelete) {
      onDelete()
    }
    setSwipeDistance(0)
    setTouchStartX(null)
  }

  const handleClick = () => {
    if (onDelete && !touchStartX) {
      onDelete()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onDelete && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onDelete()
    }
  }

  return (
    <span
      style={getChipStyle()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-testid={testId || `formula-chip-${type}`}
      role="button"
      tabIndex={0}
      aria-label={`${type} chip: ${value}`}
    >
      {value}
      {isHovering && onDelete && (
        <span
          style={{
            marginLeft: '6px',
            fontSize: '12px',
            opacity: 0.7,
          }}
          aria-hidden="true"
        >
          ✕
        </span>
      )}
      {swipeDistance < -20 && (
        <span
          style={{
            position: 'absolute',
            right: '-60px',
            color: '#d32f2f',
            fontSize: '18px',
          }}
          aria-hidden="true"
        >
          🗑️
        </span>
      )}
    </span>
  )
}
