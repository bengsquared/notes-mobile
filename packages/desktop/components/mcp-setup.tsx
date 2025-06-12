'use client'

import { useState } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Copy, Check, ExternalLink, FileText, Code } from 'lucide-react'

interface MCPConfigData {
  configPath: string
  mcpConfig: { mcpServers: { [key: string]: { command: string; args: string[]; description: string } } }
  appPath: string
  isDev: boolean
}

export function MCPSetup() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [configData, setConfigData] = useState<MCPConfigData | null>(null)
  const [copiedConfig, setCopiedConfig] = useState(false)
  const [copiedPath, setCopiedPath] = useState(false)

  const handleGenerateConfig = async () => {
    setIsGenerating(true)
    try {
      const data = await window.electronAPI.generateMCPConfig()
      setConfigData(data)
    } catch (error) {
      console.error('Failed to generate MCP config:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = async (text: string, type: 'config' | 'path') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'config') {
        setCopiedConfig(true)
        setTimeout(() => setCopiedConfig(false), 2000)
      } else {
        setCopiedPath(true)
        setTimeout(() => setCopiedPath(false), 2000)
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExternalLink className="h-5 w-5" />
          Claude Desktop Integration
        </CardTitle>
        <CardDescription>
          Connect your notes to Claude Desktop for AI-powered assistance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!configData ? (
          <>
            <div className="text-sm text-muted-foreground">
              <p>
                Generate the configuration needed to use your notes with Claude Desktop.
                This will display the setup instructions and configuration for easy copying.
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleGenerateConfig}
                disabled={isGenerating}
                className="flex items-center gap-2"
              >
                <Code className="h-4 w-4" />
                {isGenerating ? 'Generating...' : 'Generate Claude Desktop Config'}
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              <p>
                <strong>Note:</strong> You'll need Claude Desktop installed to use this feature. 
                The configuration will point Claude Desktop to this app installation.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">
                <p className="font-medium">Configuration Generated Successfully!</p>
                <p className="mt-1">
                  Follow the instructions below to connect your notes to Claude Desktop.
                </p>
              </div>

              {/* File Location */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="font-medium text-sm">Configuration File Location:</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted p-2 rounded font-mono">{configData.configPath}</code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(configData.configPath, 'path')}
                    className="flex items-center gap-1"
                  >
                    {copiedPath ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedPath ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>

              {/* Configuration JSON */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  <span className="font-medium text-sm">Configuration to Add:</span>
                </div>
                <div className="relative">
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto font-mono">
                    {JSON.stringify(configData.mcpConfig, null, 2)}
                  </pre>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(JSON.stringify(configData.mcpConfig, null, 2), 'config')}
                    className="absolute top-2 right-2 flex items-center gap-1"
                  >
                    {copiedConfig ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedConfig ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-2">
                <span className="font-medium text-sm">Setup Instructions:</span>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside ml-2">
                  <li>Open or create the Claude Desktop configuration file at the path above</li>
                  <li>If the file exists, merge the "notes-app" entry into the existing "mcpServers" object</li>
                  <li>If the file doesn't exist, create it with the configuration above</li>
                  <li>Save the file and restart Claude Desktop</li>
                  <li>Your notes will now be available in Claude Desktop conversations</li>
                </ol>
              </div>

              {configData.isDev && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
                  <p className="font-medium">Development Mode</p>
                  <p className="mt-1">
                    This configuration is for development. The paths may change when the app is built for production.
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setConfigData(null)}
                  className="flex items-center gap-2"
                >
                  Generate New Config
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}