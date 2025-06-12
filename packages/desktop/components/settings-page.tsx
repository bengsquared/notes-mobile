'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Settings, Folder, Zap, Brain, Database } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'
import { MCPSetup } from './mcp-setup'
import type { StorageConfig } from '@notes-app/shared'
import type { LayoutState } from './main-layout'

interface SettingsPageProps {
  onBack: () => void
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const [storageConfig, setStorageConfig] = useState<StorageConfig | null>(null)
  const [apiToken, setApiToken] = useState('')
  const [embeddingsProvider, setEmbeddingsProvider] = useState('openai')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const config = await window.electronAPI.getStorageConfig()
      setStorageConfig(config)
      
      // TODO: Load API token and other settings from electron-store
      // const settings = await window.electronAPI.getAppSettings()
      // setApiToken(settings.apiToken || '')
      // setEmbeddingsProvider(settings.embeddingsProvider || 'openai')
      
      setLoading(false)
    } catch (error) {
      console.error('Error loading settings:', error)
      setLoading(false)
    }
  }

  const selectNotesDirectory = async () => {
    try {
      const selectedPath = await window.electronAPI.selectNotesDirectory()
      if (selectedPath) {
        // Reload storage config
        await loadSettings()
      }
    } catch (error) {
      console.error('Error selecting notes directory:', error)
    }
  }

  const saveApiSettings = async () => {
    try {
      // TODO: Implement saving API settings
      // await window.electronAPI.saveAppSettings({
      //   apiToken,
      //   embeddingsProvider
      // })
      console.log('API settings saved:', { apiToken: apiToken ? '***' : '', embeddingsProvider })
    } catch (error) {
      console.error('Error saving API settings:', error)
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div>Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header - Fixed */}
      <div className="border-b p-4 flex items-center flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="ml-4 flex items-center">
          <Settings className="h-5 w-5 mr-2" />
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </div>

      {/* Settings Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-2xl mx-auto space-y-8">
          
          {/* Storage Settings */}
          <section>
            <div className="flex items-center mb-4">
              <Database className="h-5 w-5 mr-2" />
              <h2 className="text-lg font-semibold">Storage</h2>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Notes Directory</CardTitle>
                <CardDescription>
                  Choose where your notes are stored on disk
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label htmlFor="notes-directory">Current Directory</Label>
                    <div className="mt-1 p-2 bg-muted rounded text-sm font-mono">
                      {storageConfig?.notesDirectory || 'Not configured'}
                    </div>
                  </div>
                  <Button variant="outline" onClick={selectNotesDirectory}>
                    <Folder className="h-4 w-4 mr-2" />
                    Change Directory
                  </Button>
                </div>
                
                <div className="text-xs text-muted-foreground">
                  <p>
                    All notes are stored as plain text files in this directory. 
                    You can access and edit them with any text editor.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          <Separator />

          {/* Claude Desktop Integration */}
          <section>
            <div className="flex items-center mb-4">
              <Zap className="h-5 w-5 mr-2" />
              <h2 className="text-lg font-semibold">AI Integration</h2>
            </div>
            
            <MCPSetup />
          </section>

          <Separator />

          {/* AI Features Settings */}
          <section>
            <div className="flex items-center mb-4">
              <Brain className="h-5 w-5 mr-2" />
              <h2 className="text-lg font-semibold">AI Features</h2>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Embeddings & Search</CardTitle>
                <CardDescription>
                  Configure AI-powered semantic search and suggestions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="embeddings-provider">Embeddings Provider</Label>
                    <select 
                      id="embeddings-provider"
                      value={embeddingsProvider}
                      onChange={(e) => setEmbeddingsProvider(e.target.value)}
                      className="mt-1 w-full p-2 border rounded-md"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="local">Local (Ollama)</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </div>

                  {embeddingsProvider !== 'disabled' && embeddingsProvider !== 'local' && (
                    <div>
                      <Label htmlFor="api-token">API Token</Label>
                      <Input
                        id="api-token"
                        type="password"
                        placeholder="Enter your API token..."
                        value={apiToken}
                        onChange={(e) => setApiToken(e.target.value)}
                        className="mt-1"
                      />
                      <div className="text-xs text-muted-foreground mt-1">
                        This token is stored locally and never shared.
                      </div>
                    </div>
                  )}

                  <Button onClick={saveApiSettings} className="w-fit">
                    Save AI Settings
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Note:</strong> AI features are optional and enhance your note-taking experience with:</p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>Semantic search - find notes by meaning, not just keywords</li>
                    <li>Smart suggestions - discover related notes and concepts</li>
                    <li>Content analysis - automatic concept extraction</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </section>

          <Separator />

          {/* App Information */}
          <section>
            <div className="flex items-center mb-4">
              <Settings className="h-5 w-5 mr-2" />
              <h2 className="text-lg font-semibold">About</h2>
            </div>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground space-y-2">
                  <div className="flex justify-between">
                    <span>Version:</span>
                    <span className="font-mono">1.0.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Storage Format:</span>
                    <span>Plain Text + YAML</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Note Linking:</span>
                    <span>#concepts @references</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

        </div>
      </div>
    </div>
  )
}