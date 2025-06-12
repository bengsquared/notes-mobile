import { useState, useEffect, useCallback } from 'react'

export function usePinState(itemType: 'note' | 'concept', itemName: string) {
  const [isPinned, setIsPinned] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    checkPinStatus()
  }, [itemName])

  const checkPinStatus = useCallback(async () => {
    if (!itemName) return
    
    try {
      const pinnedItems = await window.electronAPI.app.getPinnedItems()
      const pinnedList = itemType === 'note' ? pinnedItems.notes : pinnedItems.concepts
      setIsPinned(pinnedList.includes(itemName))
    } catch (error) {
      console.error('Error checking pin status:', error)
    }
  }, [itemType, itemName])

  const togglePin = useCallback(async () => {
    if (!itemName || isLoading) return

    setIsLoading(true)
    try {
      if (isPinned) {
        await window.electronAPI.app.unpinItem(itemType, itemName)
        setIsPinned(false)
      } else {
        await window.electronAPI.app.pinItem(itemType, itemName)
        setIsPinned(true)
      }
      
      // Dispatch a custom event to notify other components
      window.dispatchEvent(new CustomEvent('pinStateChanged', {
        detail: { itemType, itemName, isPinned: !isPinned }
      }))
    } catch (error) {
      console.error('Error toggling pin:', error)
      // Revert on error
      await checkPinStatus()
    } finally {
      setIsLoading(false)
    }
  }, [itemType, itemName, isPinned, isLoading, checkPinStatus])

  return {
    isPinned,
    isLoading,
    togglePin,
    refreshPinStatus: checkPinStatus
  }
}