import React, { useEffect, useState } from 'react'
import { openPath } from '@tauri-apps/plugin-opener'
import { usePreviewStore } from '@/store/previewStore'
import { useProjectStore } from '@/store/projectStore'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Play,
  Square,
  RotateCcw,
  ExternalLink,
  Terminal,
  Loader2,
} from 'lucide-react'

export const PreviewPanel: React.FC = () => {
  const {
    isRunning,
    isStarting,
    url,
    logs,
    startPreview,
    stopPreview,
    clearLogs,
    init,
    cleanup,
  } = usePreviewStore(state => ({
    isRunning: state.isRunning,
    isStarting: state.isStarting,
    url: state.url,
    logs: state.logs,
    startPreview: state.startPreview,
    stopPreview: state.stopPreview,
    clearLogs: state.clearLogs,
    init: state.init,
    cleanup: state.cleanup,
  }))
  const projectPath = useProjectStore(state => state.projectPath)
  const [showLogs, setShowLogs] = useState(false)

  useEffect(() => {
    void init()
    return () => {
      cleanup()
    }
  }, [init, cleanup])

  const handleStart = () => {
    if (projectPath) {
      void startPreview(projectPath)
    }
  }

  return (
    <div className="h-full flex flex-col bg-[var(--editor-color-background)] border-l overflow-hidden">
      <div className="flex items-center justify-between p-2 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
            Preview
          </span>
          {isRunning && !isStarting && (
            <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[9px] font-medium text-green-600 dark:text-green-400">
                Live
              </span>
            </div>
          )}
          {isStarting && (
            <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">
              <Loader2 className="h-2 w-2 text-blue-500 animate-spin" />
              <span className="text-[9px] font-medium text-blue-600 dark:text-blue-400">
                Starting
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isRunning ? (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleStart}
              disabled={isStarting || !projectPath}
              title="Start Preview"
              className="h-7 w-7"
            >
              <Play className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => void stopPreview()}
              title="Stop Preview"
              className="h-7 w-7"
            >
              <Square className="h-3.5 w-3.5 text-red-500" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={handleStart}
            disabled={!isRunning || !projectPath}
            title="Restart Preview"
            className="h-7 w-7"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowLogs(!showLogs)}
            title="Toggle Logs"
            className={`h-7 w-7 ${showLogs ? 'bg-muted' : ''}`}
          >
            <Terminal className="h-3.5 w-3.5" />
          </Button>
          {url && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => void openPath(url)}
              title="Open in Browser"
              className="h-7 w-7"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden bg-white dark:bg-zinc-950">
        {isRunning && url ? (
          <iframe
            src={url}
            className="w-full h-full border-0"
            title="Astro Preview"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="p-4 rounded-full bg-muted/50">
              {isStarting ? (
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
              ) : (
                <Play className="h-8 w-8 text-muted-foreground opacity-20" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium">
                {isStarting ? 'Starting dev server...' : 'Preview not running'}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                {isStarting
                  ? 'Waiting for Astro to start on localhost. This may take a few seconds.'
                  : 'Start the Astro dev server to see a live preview of your content.'}
              </p>
            </div>
            {!isRunning && (
              <Button
                onClick={handleStart}
                disabled={isStarting || !projectPath}
                variant="outline"
                size="sm"
              >
                {isStarting ? 'Starting...' : 'Start Preview'}
              </Button>
            )}
          </div>
        )}

        {showLogs && (
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-zinc-900 text-zinc-300 font-mono text-[10px] p-0 flex flex-col border-t border-zinc-800 shadow-2xl">
            <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-800/50 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <Terminal className="h-3 w-3 opacity-50" />
                <span className="uppercase font-bold tracking-tighter opacity-50">
                  Terminal Output
                </span>
              </div>
              <button
                onClick={clearLogs}
                className="hover:text-white transition-colors opacity-50 hover:opacity-100 text-[9px] bg-white/5 px-1.5 py-0.5 rounded"
              >
                CLEAR
              </button>
            </div>
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-0.5">
                {logs.map((log, i) => (
                  <div
                    key={i}
                    className="whitespace-pre-wrap break-all opacity-80 hover:opacity-100"
                  >
                    <span className="mr-2 opacity-30 select-none">
                      {(i + 1).toString().padStart(3, '0')}
                    </span>
                    {log}
                  </div>
                ))}
                {logs.length === 0 && (
                  <div className="italic opacity-30 py-4 text-center">
                    No logs yet. Output from pnpm dev will appear here.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  )
}
