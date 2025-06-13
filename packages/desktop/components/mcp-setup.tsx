
import { useState } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Copy, Check, ExternalLink, FileText, Code, Info } from 'lucide-react'

interface MCPConfigData {
  configPath: string
  mcpConfig: { mcpServers: { [key: string]: { command: string; args: string[]; description: string } } }
  appPath: string
  isDev: boolean
  bundledPath: string
}

export function MCPSetup() {
  const [configData, setConfigData] = useState<MCPConfigData | null>(null)
  const [copiedConfig, setCopiedConfig] = useState(false)
  const [copiedPath, setCopiedPath] = useState(false)

  const handleGenerateConfig = async () => {
    try {
      // Use the existing generateMCPConfig API if available, or fall back to generating locally
      const data = await window.electronAPI?.generateMCPConfig?.() || generateFallbackConfig()
      setConfigData(data)
    } catch (error) {
      console.error('Failed to generate MCP config:', error)
      // Fall back to client-side generation
      const data = generateFallbackConfig()
      setConfigData(data)
    }
  }

  const generateFallbackConfig = () => {
    // Fallback config generation for the bundled MCP server
    const homeDir = '~' // Use tilde for cross-platform display
    const platform = navigator.platform.toLowerCase()
    
    let configPath: string
    if (platform.includes('mac')) {
      configPath = `${homeDir}/Library/Application Support/Claude/claude_desktop_config.json`
    } else if (platform.includes('win')) {
      configPath = `${homeDir}/AppData/Roaming/Claude/claude_desktop_config.json`
    } else {
      configPath = `${homeDir}/.config/Claude/claude_desktop_config.json`
    }

    // For fallback, show the development launcher path
    const bundledPath = '/path/to/notes-mobile/packages/desktop/mcp-bundled-launcher.js'

    const mcpConfig = {
      mcpServers: {
        'notes-app': {
          type: 'stdio',
          command: 'node',
          args: [bundledPath],
          env: {
            NODE_ENV: 'production'
          },
          description: 'Personal notes management with AI-powered search and analysis (Bundled)'
        }
      }
    }

    return {
      configPath,
      mcpConfig,
      appPath: bundledPath,
      isDev: true, // Assume dev for fallback
      bundledPath
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
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                Generate the configuration needed to use your notes with Claude Desktop.
                This uses the new <strong>bundled MCP architecture</strong> for easier setup.
              </p>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-800">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="font-medium">New Bundled Architecture</p>
                    <p className="text-sm">
                      The MCP server is now packaged with the app, so no separate setup is needed. 
                      Just copy the configuration and restart Claude Desktop!
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleGenerateConfig}
                className="flex items-center gap-2"
              >
                <Code className="h-4 w-4" />
                Generate Claude Desktop Config
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              <p>
                <strong>Requirements:</strong> Claude Desktop must be installed. 
                The generated configuration will automatically point to the bundled MCP server.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">
                <p className="font-medium">Bundled MCP Configuration Generated!</p>
                <p className="mt-1">
                  This configuration uses the bundled MCP server that's packaged with the app.
                  No additional setup required - just copy and restart Claude Desktop.
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
                  <li>If the file doesn't exist, create it with the complete configuration above</li>
                  <li>Save the file and restart Claude Desktop</li>
                  <li>Your notes will be available as MCP tools in Claude Desktop conversations</li>
                </ol>
              </div>

              {/* Bundled Path Info */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-md text-sm">
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Bundled MCP Server Path:</p>
                    <code className="text-xs bg-white p-1 rounded mt-1 block break-all">{configData.bundledPath}</code>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {configData.isDev 
                        ? "Development: Uses the bundled launcher that auto-detects the correct server" 
                        : "Production: Uses the MCP server bundled with the app"}
                    </p>
                  </div>
                </div>
              </div>

              {configData.isDev && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
                  <p className="font-medium">Development Mode</p>
                  <p className="mt-1">
                    Using bundled launcher that automatically detects development vs production environment.
                    When you distribute the app, it will automatically use the bundled MCP server.
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