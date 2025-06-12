'use client'

import { useState } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Copy, Check, ExternalLink } from 'lucide-react'

export function MCPSetup() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const handleGenerateConfig = async () => {
    setIsGenerating(true)
    try {
      await window.electronAPI.generateMCPConfig()
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to generate MCP config:', error)
    } finally {
      setIsGenerating(false)
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
        <div className="text-sm text-muted-foreground">
          <p>
            Generate the configuration needed to use your notes with Claude Desktop.
            This will create setup instructions and automatically configure Claude Desktop if possible.
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={handleGenerateConfig}
            disabled={isGenerating}
            className="flex items-center gap-2"
          >
            {showSuccess ? (
              <>
                <Check className="h-4 w-4" />
                Configuration Generated!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                {isGenerating ? 'Generating...' : 'Generate Claude Desktop Config'}
              </>
            )}
          </Button>
        </div>

        {showSuccess && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">
            <p className="font-medium">Configuration Generated Successfully!</p>
            <p className="mt-1">
              Setup instructions have been saved to your desktop. If Claude Desktop is configured automatically, 
              restart it to start using your notes with AI assistance.
            </p>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p>
            <strong>Note:</strong> You'll need Claude Desktop installed to use this feature. 
            The configuration will point Claude Desktop to this app installation.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}