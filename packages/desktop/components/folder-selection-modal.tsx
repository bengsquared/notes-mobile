import { useState } from 'react';
import { FolderOpen, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface FolderSelectionModalProps {
  open: boolean;
  onSelect: (path: string) => void;
}

export function FolderSelectionModal({ open, onSelect }: FolderSelectionModalProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [manualPath, setManualPath] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  
  const handleSelectFolder = async () => {
    setIsSelecting(true);
    try {
      console.log('Selecting folder...');
      const selectedPath = await (window as any).electronAPI.selectNotesDirectory();
      console.log('Selected path:', selectedPath);
      if (selectedPath) {
        onSelect(selectedPath);
      } else {
        // If folder selection failed, show manual input
        setShowManualInput(true);
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
      setShowManualInput(true);
    } finally {
      setIsSelecting(false);
    }
  };
  
  const handleManualSubmit = () => {
    if (manualPath.trim()) {
      onSelect(manualPath.trim());
    }
  };
  
  return (
    <Dialog open={open} modal onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[425px]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Select Notes Storage Folder</DialogTitle>
          <DialogDescription>
            Choose a folder where your notes will be stored. This folder will contain all your notes as text files.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-4 py-4">
          <div className="rounded-lg border border-muted bg-muted/50 p-4 text-sm">
            <p className="font-medium mb-2">Your notes will be organized as:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Text files in the main folder</li>
              <li>An "inbox" folder for quick notes</li>
              <li>A "collections" folder for organization</li>
            </ul>
          </div>
          
          {!showManualInput ? (
            <Button 
              onClick={handleSelectFolder} 
              disabled={isSelecting}
              size="lg"
              className="w-full"
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              {isSelecting ? 'Selecting...' : 'Select Folder'}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm text-amber-800">
                  The folder picker isn't working properly. Please enter the path manually.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="manual-path">Folder Path</Label>
                <Input
                  id="manual-path"
                  type="text"
                  placeholder="/Users/yourname/Documents/Notes"
                  value={manualPath}
                  onChange={(e) => setManualPath(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleManualSubmit();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the full path to the folder where you want to store your notes.
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setShowManualInput(false);
                    setManualPath('');
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Try Picker Again
                </Button>
                <Button
                  onClick={handleManualSubmit}
                  disabled={!manualPath.trim()}
                  className="flex-1"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Use This Path
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}