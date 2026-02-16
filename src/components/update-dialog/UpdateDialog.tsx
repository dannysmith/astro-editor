import { marked } from 'marked'
import { relaunch } from '@tauri-apps/plugin-process'
import { error as logError, info } from '@tauri-apps/plugin-log'
import { useUpdateStore } from '@/store/updateStore'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { CheckCircle2Icon, AlertCircleIcon, DownloadIcon } from 'lucide-react'
import './release-notes.css'

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="bg-secondary h-2 w-full overflow-hidden rounded-full">
      <div
        className="bg-primary h-full rounded-full transition-[width] duration-300"
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

function ReleaseNotesArea() {
  const loading = useUpdateStore(s => s.releaseNotesLoading)
  const hasError = useUpdateStore(s => s.releaseNotesError)
  const notes = useUpdateStore(s => s.releaseNotes)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner className="size-5" />
      </div>
    )
  }

  if (hasError) {
    return (
      <p className="text-muted-foreground py-4 text-center text-sm">
        Could not load release notes.
      </p>
    )
  }

  if (!notes) {
    return (
      <p className="text-muted-foreground py-4 text-center text-sm">
        No release notes for this version.
      </p>
    )
  }

  const html = marked.parse(notes, { async: false })

  return (
    <div
      className="release-notes max-h-[300px] overflow-y-auto rounded-md border p-4"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function CheckingContent() {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Checking for Updates</DialogTitle>
        <DialogDescription>Looking for a newer version...</DialogDescription>
      </DialogHeader>
      <div className="flex items-center justify-center py-8">
        <Spinner className="size-6" />
      </div>
    </>
  )
}

function AvailableContent() {
  const version = useUpdateStore(s => s.version)
  const currentVersion = useUpdateStore(s => s.currentVersion)
  const skipVersion = useUpdateStore(s => s.skipVersion)
  const closeDialog = useUpdateStore(s => s.closeDialog)

  const handleUpdate = async () => {
    const state = useUpdateStore.getState()
    if (!state.updateRef) return

    state.setDownloading()
    try {
      let totalBytes = 0
      let downloadedBytes = 0

      await state.updateRef.downloadAndInstall(event => {
        switch (event.event) {
          case 'Started':
            totalBytes = event.data.contentLength ?? 0
            void info(`Downloading ${totalBytes} bytes`)
            break
          case 'Progress':
            downloadedBytes += event.data.chunkLength
            useUpdateStore.getState().setProgress(downloadedBytes, totalBytes)
            break
          case 'Finished':
            void info('Download complete')
            break
        }
      })

      useUpdateStore.getState().setReady()
    } catch (err) {
      void logError(`Update failed: ${String(err)}`)
      useUpdateStore.getState().setError(`Download failed: ${String(err)}`)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Update Available</DialogTitle>
        <DialogDescription>
          {currentVersion && `v${currentVersion}`} → v{version}
        </DialogDescription>
      </DialogHeader>
      <ReleaseNotesArea />
      <DialogFooter className="gap-2">
        <Button variant="ghost" onClick={closeDialog}>
          Remind Me Later
        </Button>
        {version && (
          <Button variant="outline" onClick={() => skipVersion(version)}>
            Skip This Version
          </Button>
        )}
        <Button onClick={() => void handleUpdate()}>
          <DownloadIcon />
          Update Now
        </Button>
      </DialogFooter>
    </>
  )
}

function DownloadingContent() {
  const progress = useUpdateStore(s => s.downloadProgress)

  return (
    <>
      <DialogHeader>
        <DialogTitle>Downloading Update</DialogTitle>
        <DialogDescription>
          Please wait while the update is downloaded...
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2 py-4">
        <ProgressBar value={progress} />
        <p className="text-muted-foreground text-center text-sm">{progress}%</p>
      </div>
    </>
  )
}

function ReadyContent() {
  const closeDialog = useUpdateStore(s => s.closeDialog)

  const handleRelaunch = async () => {
    await relaunch()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CheckCircle2Icon className="text-muted-foreground" />
          Update Ready
        </DialogTitle>
        <DialogDescription>
          The update has been downloaded. Restart to apply it.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={closeDialog}>
          Later
        </Button>
        <Button onClick={() => void handleRelaunch()}>Restart Now</Button>
      </DialogFooter>
    </>
  )
}

function NoUpdateContent() {
  const currentVersion = useUpdateStore(s => s.currentVersion)
  const closeDialog = useUpdateStore(s => s.closeDialog)

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CheckCircle2Icon className="text-muted-foreground" />
          Up to Date
        </DialogTitle>
        <DialogDescription>
          You're on the latest version
          {currentVersion && ` (v${currentVersion})`}.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button onClick={closeDialog}>OK</Button>
      </DialogFooter>
    </>
  )
}

function ErrorContent() {
  const errorMessage = useUpdateStore(s => s.errorMessage)
  const closeDialog = useUpdateStore(s => s.closeDialog)

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <AlertCircleIcon className="text-destructive" />
          Update Error
        </DialogTitle>
        <DialogDescription>{errorMessage}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button onClick={closeDialog}>Dismiss</Button>
      </DialogFooter>
    </>
  )
}

const MODE_COMPONENTS = {
  checking: CheckingContent,
  available: AvailableContent,
  downloading: DownloadingContent,
  ready: ReadyContent,
  'no-update': NoUpdateContent,
  error: ErrorContent,
} as const

export function UpdateDialog() {
  const dialogOpen = useUpdateStore(s => s.dialogOpen)
  const dialogMode = useUpdateStore(s => s.dialogMode)
  const closeDialog = useUpdateStore(s => s.closeDialog)

  const Content = MODE_COMPONENTS[dialogMode]

  // Prevent closing during download
  const handleOpenChange = (open: boolean) => {
    if (!open && dialogMode !== 'downloading') {
      closeDialog()
    }
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={dialogMode !== 'downloading'}>
        <Content />
      </DialogContent>
    </Dialog>
  )
}
