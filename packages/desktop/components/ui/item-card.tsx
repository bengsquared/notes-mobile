'use client'

import { LucideIcon } from 'lucide-react'
import { Button } from './button'
import { Badge } from './badge'
import { formatRelativeTime } from '../../utils/date'

export interface ItemCardAction {
  icon: LucideIcon
  label: string
  onClick: () => void
  variant?: 'default' | 'destructive' | 'ghost'
  alwaysVisible?: boolean
}

export interface ItemCardProps {
  title: string
  subtitle?: string
  description?: string
  timestamp?: string
  icon?: LucideIcon
  badges?: string[]
  actions?: ItemCardAction[]
  onClick?: () => void
  className?: string
  isSelected?: boolean
}

export function ItemCard({
  title,
  subtitle,
  description,
  timestamp,
  icon: Icon,
  badges = [],
  actions = [],
  onClick,
  className = '',
  isSelected = false
}: ItemCardProps) {
  const handleClick = () => {
    if (onClick) onClick()
  }

  const handleActionClick = (action: ItemCardAction, e: React.MouseEvent) => {
    e.stopPropagation()
    action.onClick()
  }

  return (
    <div
      className={`
        group relative border rounded-lg p-4 transition-all duration-200
        ${onClick ? 'cursor-pointer hover:shadow-lg hover:shadow-primary/10 hover:border-primary/30 hover:bg-accent/30' : ''}
        ${isSelected ? 'border-primary bg-primary/5 shadow-md' : 'border-border hover:border-border/60 shadow-sm'}
        ${className}
      `}
      onClick={handleClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {Icon && (
            <Icon className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm truncate">{title}</h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        {actions.length > 0 && (
          <div className="flex items-center gap-1">
            {actions.map((action, index) => (
              <Button
                key={index}
                size="xs"
                variant={action.variant || 'ghost'}
                className={`h-7 w-7 p-0 transition-all duration-200 ${
                  action.alwaysVisible 
                    ? 'opacity-100 shadow-sm' 
                    : 'opacity-0 group-hover:opacity-100 group-hover:shadow-sm'
                } hover:scale-105 active:scale-95`}
                onClick={(e) => handleActionClick(action, e)}
                aria-label={action.label}
              >
                <action.icon className="h-3 w-3" />
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-muted-foreground mb-2 overflow-hidden" style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical'
        }}>
          {description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        {/* Badges */}
        <div className="flex items-center gap-1 min-w-0 flex-1">
          {badges.slice(0, 3).map((badge, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="text-xs px-1.5 py-0.5 h-auto"
            >
              {badge}
            </Badge>
          ))}
          {badges.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{badges.length - 3}
            </span>
          )}
        </div>

        {/* Timestamp */}
        {timestamp && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatRelativeTime(timestamp)}
          </span>
        )}
      </div>
    </div>
  )
}