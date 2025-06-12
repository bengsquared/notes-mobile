import { useState, useEffect } from 'react'
import { FolderSelectionModal } from '../../components/folder-selection-modal'
import { MainLayout } from '../../components/main-layout'
import { DataProvider } from '../../contexts/DataContext'

export default function App() {
  const [showFolderSelection, setShowFolderSelection] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    // Check if storage directory is configured
    const checkStorageConfig = async () => {
      try {
        console.log('App: Checking storage config...')
        const config = await window.electronAPI.storage.getConfig()
        console.log('App: Storage config response:', config)
        
        if (config.notesDirectory) {
          if (config.initialized) {
            console.log('App: Storage is initialized, proceeding to main app')
            setIsInitialized(true)
          } else {
            console.log('App: Directory exists but storage not initialized, waiting...')
            // Storage is being initialized, wait a bit and check again
            setTimeout(() => checkStorageConfig(), 500)
          }
        } else {
          console.log('App: No directory configured, showing folder selection')
          setShowFolderSelection(true)
        }
      } catch (error) {
        console.error('App: Error checking storage config:', error)
        setShowFolderSelection(true)
      }
    }
    
    checkStorageConfig()
  }, [])
  
  const handleFolderSelected = (path: string) => {
    console.log('Folder selected in App:', path)
    setShowFolderSelection(false)
    setIsInitialized(true)
  }

  return (
    <>
      <FolderSelectionModal 
        open={showFolderSelection} 
        onSelect={handleFolderSelected}
      />
      
      {!isInitialized ? (
        <div className="h-screen flex items-center justify-center">
          <p className="text-muted-foreground">Initializing storage...</p>
        </div>
      ) : (
        <DataProvider>
          <MainLayout />
        </DataProvider>
      )}
    </>
  )
}