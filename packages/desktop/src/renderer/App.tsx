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
        const config = await window.electronAPI.storage.getConfig()
        if (!config.notesDirectory) {
          setShowFolderSelection(true)
        } else {
          setIsInitialized(true)
        }
      } catch (error) {
        console.error('Error checking storage config:', error)
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