/**
 * Styleguide sections for the shared UI components, each showing the variants
 * and states the app uses. Overlays are rendered open so they can be seen.
 */
import React, { useEffect, useState } from 'react'
import {
  ChevronDown,
  Copy,
  FileText,
  Folder,
  Image,
  Plus,
  Search,
  Settings,
  Trash2,
} from 'lucide-react'
import { toast } from '../lib/toast'
import { Toaster } from '../components/ui/sonner'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Spinner } from '../components/ui/spinner'
import { Skeleton } from '../components/ui/skeleton'
import { Separator } from '../components/ui/separator'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { AutoExpandingTextarea } from '../components/ui/auto-expanding-textarea'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from '../components/ui/input-group'
import { TagInput, type Tag } from '../components/ui/tag-input'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '../components/ui/field'
import { Checkbox } from '../components/ui/checkbox'
import { Switch } from '../components/ui/switch'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { DatePicker } from '../components/ui/date-picker'
import { Calendar } from '../components/ui/calendar'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '../components/ui/command'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '../components/ui/sidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/breadcrumb'

/** A labelled row of examples. */
function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-6">
      <div className="w-32 shrink-0 pt-2 text-xs text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

const noop = () => {}

export function ButtonsSection() {
  const variants = [
    'default',
    'secondary',
    'outline',
    'ghost',
    'destructive',
    'link',
  ] as const
  return (
    <div className="space-y-5">
      <Row label="Variants">
        {variants.map(variant => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
      </Row>
      <Row label="Disabled">
        {variants.map(variant => (
          <Button key={variant} variant={variant} disabled>
            {variant}
          </Button>
        ))}
      </Row>
      <Row label="Sizes">
        <Button size="sm">Small</Button>
        <Button>Default</Button>
        <Button size="lg">Large</Button>
        <Button size="icon-sm" variant="ghost" aria-label="Add">
          <Plus />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Settings">
          <Settings />
        </Button>
        <Button size="icon-lg" variant="outline" aria-label="Delete">
          <Trash2 />
        </Button>
      </Row>
      <Row label="With icons">
        <Button>
          <Plus /> New file
        </Button>
        <Button variant="outline">
          <Copy /> Copy path
        </Button>
        <Button variant="secondary" disabled>
          <Spinner /> Saving
        </Button>
      </Row>
      <Row label="Badges">
        <Badge>default</Badge>
        <Badge variant="secondary">secondary</Badge>
        <Badge variant="destructive">destructive</Badge>
        <Badge variant="outline">outline</Badge>
        <Badge variant="secondary">
          <FileText /> MDX
        </Badge>
      </Row>
      <Row label="Spinner">
        <Spinner />
        <Spinner className="size-6" />
      </Row>
      <Row label="Skeleton">
        <div className="w-64 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Row>
      <Row label="Separator">
        <div className="w-64 space-y-3 text-sm">
          <div>Above</div>
          <Separator />
          <div className="flex h-5 items-center gap-3">
            Left <Separator orientation="vertical" /> Right
          </div>
        </div>
      </Row>
    </div>
  )
}

const TAGS: Tag[] = [
  { id: '1', text: 'astro' },
  { id: '2', text: 'markdown' },
  { id: '3', text: 'writing' },
]

export function InputsSection() {
  const [tags, setTags] = useState(TAGS)
  return (
    <div className="grid max-w-5xl grid-cols-2 gap-x-10 gap-y-5">
      <Field>
        <FieldLabel>Placeholder</FieldLabel>
        <Input placeholder="Enter a title..." />
      </Field>
      <Field>
        <FieldLabel>With value</FieldLabel>
        <Input defaultValue="Getting started with Astro" />
      </Field>
      <Field>
        <FieldLabel>Disabled</FieldLabel>
        <Input disabled defaultValue="Can't edit this" />
      </Field>
      <Field data-invalid>
        <FieldLabel>Invalid</FieldLabel>
        <Input aria-invalid defaultValue="no" />
        <FieldError>Must be at least 3 characters</FieldError>
      </Field>
      <Field>
        <FieldLabel>Textarea</FieldLabel>
        <Textarea placeholder="A brief description..." />
      </Field>
      <Field>
        <FieldLabel>Auto-expanding textarea</FieldLabel>
        <AutoExpandingTextarea
          defaultValue={'Grows with its content.\nSecond line.\nThird line.'}
          minRows={2}
          maxRows={6}
        />
      </Field>
      <Field>
        <FieldLabel>Input group</FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput placeholder="Search files..." />
        </InputGroup>
        <InputGroup>
          <InputGroupAddon>
            <InputGroupText>src/assets/</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput defaultValue="cover.png" />
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-xs" aria-label="Choose image">
              <Image />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </Field>
      <Field>
        <FieldLabel>Tag input</FieldLabel>
        <TagInput
          tags={tags}
          onTagsChange={setTags}
          placeholder="Add a tag..."
        />
        <TagInput
          tags={[]}
          onTagsChange={noop}
          placeholder="Disabled"
          disabled
        />
      </Field>
      <Field>
        <FieldLabel>Field with description</FieldLabel>
        <FieldContent>
          <Input placeholder="e.g. code, cursor" />
          <FieldDescription>
            The command to launch your editor, e.g. <code>code</code>.
          </FieldDescription>
        </FieldContent>
      </Field>
    </div>
  )
}

export function TogglesSection() {
  return (
    <div className="space-y-6">
      <Row label="Checkbox">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox /> Unchecked
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox defaultChecked /> Checked
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox indeterminate /> Indeterminate
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox disabled /> Disabled
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox disabled defaultChecked /> Disabled checked
        </label>
      </Row>
      <Row label="Switch">
        <label className="flex items-center gap-2 text-sm">
          <Switch /> Off
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch defaultChecked /> On
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch disabled /> Disabled
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch disabled defaultChecked /> Disabled on
        </label>
      </Row>
      <Row label="Horizontal field">
        <Field orientation="horizontal" className="max-w-md">
          <FieldContent>
            <FieldLabel>Draft</FieldLabel>
            <FieldDescription>Hide this post from the site</FieldDescription>
          </FieldContent>
          <Switch defaultChecked />
        </Field>
      </Row>
      <Row label="Collapsible">
        <div className="grid w-full max-w-3xl grid-cols-2 items-start gap-6">
          {[false, true].map(open => (
            <Collapsible
              key={String(open)}
              defaultOpen={open}
              className="rounded-md border"
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium">
                {open ? 'Open' : 'Closed'}
                <ChevronDown className="size-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="border-t px-3 py-2 text-sm text-muted-foreground">
                Collection settings go here.
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </Row>
    </div>
  )
}

export function SidebarSection() {
  const items = [
    { label: 'General', icon: Settings, active: true },
    { label: 'Project', icon: Folder },
    { label: 'Collections', icon: FileText },
  ]
  return (
    <div className="h-[420px] max-w-3xl overflow-hidden rounded-lg border">
      <SidebarProvider className="min-h-0 items-start">
        <Sidebar collapsible="none">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map(item => (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton isActive={item.active}>
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <div className="flex-1 space-y-4 p-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#">Preferences</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>General</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Field>
            <FieldLabel>IDE command</FieldLabel>
            <Input placeholder="e.g. code, cursor" />
          </Field>
        </div>
      </SidebarProvider>
    </div>
  )
}

export function CommandSection() {
  return (
    <div className="grid max-w-4xl grid-cols-2 gap-6">
      <Command className="rounded-lg border shadow-md">
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandGroup heading="File">
            <CommandItem>
              <Plus /> New File
              <CommandShortcut>⌘N</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <Folder /> Open Project
              <CommandShortcut>⇧⌘O</CommandShortcut>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Settings">
            <CommandItem>
              <Settings /> Open Preferences
              <CommandShortcut>⌘,</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
      <Command className="rounded-lg border shadow-md">
        <CommandInput placeholder="Search content..." value="zzz" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
        </CommandList>
      </Command>
    </div>
  )
}

export function SelectSection() {
  return (
    <div className="space-y-5">
      <Row label="Closed">
        <Select>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select a category..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">A</SelectItem>
          </SelectContent>
        </Select>
        <Select items={{ dark: 'Dark' }} defaultValue="dark">
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dark">Dark</SelectItem>
          </SelectContent>
        </Select>
        <Select items={{ dark: 'Small' }} defaultValue="dark">
          <SelectTrigger size="sm" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dark">Small</SelectItem>
          </SelectContent>
        </Select>
        <Select disabled>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Disabled" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">A</SelectItem>
          </SelectContent>
        </Select>
        <Select>
          <SelectTrigger className="w-40" aria-invalid>
            <SelectValue placeholder="Invalid" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">A</SelectItem>
          </SelectContent>
        </Select>
      </Row>
      <Row label="Open">
        <Select
          open
          items={{ light: 'Light', dark: 'Dark', system: 'System' }}
          defaultValue="system"
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Theme</SelectLabel>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Other</SelectLabel>
              <SelectItem value="sepia" disabled>
                Sepia (disabled)
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Row>
    </div>
  )
}

export function DateSection() {
  return (
    <div className="space-y-5">
      <Row label="Date picker">
        <div className="w-60">
          <DatePicker value={new Date(2024, 0, 15)} onChange={noop} />
        </div>
        <div className="w-60">
          <DatePicker onChange={noop} placeholder="Pick a date" />
        </div>
      </Row>
      <Row label="Calendar">
        <Calendar
          mode="single"
          selected={new Date(2024, 0, 15)}
          defaultMonth={new Date(2024, 0, 1)}
          className="rounded-md border"
        />
      </Row>
    </div>
  )
}

export function MenusSection() {
  const [sort, setSort] = useState('date')
  return (
    <DropdownMenu open modal={false}>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        Menu
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>File</DropdownMenuLabel>
          <DropdownMenuItem>
            <Plus /> New file
            <DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Copy /> Copy path
          </DropdownMenuItem>
          <DropdownMenuItem disabled>Disabled item</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked>Show drafts</DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={false}>
          Show MDX only
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
          <DropdownMenuRadioItem value="date">
            Sort by date
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="title">
            Sort by title
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
        </DropdownMenuSub>
        <DropdownMenuItem variant="destructive">
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function PopoversSection() {
  return (
    <div className="flex gap-64">
      <Popover open>
        <PopoverTrigger render={<Button variant="outline" />}>
          Popover
        </PopoverTrigger>
        <PopoverContent align="start" className="space-y-2">
          <div className="text-sm font-medium">Insert link</div>
          <Input placeholder="https://" />
          <div className="text-xs text-muted-foreground">
            Popover content with a field.
          </div>
        </PopoverContent>
      </Popover>
      <Tooltip open>
        <TooltipTrigger render={<Button variant="outline" />}>
          Tooltip
        </TooltipTrigger>
        <TooltipContent>Toggle sidebar (⌘1)</TooltipContent>
      </Tooltip>
    </div>
  )
}

export function DialogSection() {
  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename file</DialogTitle>
          <DialogDescription>
            Choose a new name for this file.
          </DialogDescription>
        </DialogHeader>
        <Input defaultValue="getting-started.md" />
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Rename</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AlertDialogSection() {
  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset all preferences?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes every setting and restarts the app. It can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Reset</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function ToastsSection() {
  useEffect(() => {
    toast.info('Collections reloaded')
    toast.success('File saved', { description: 'getting-started.md' })
    toast.warning('Unsaved changes', {
      action: { label: 'Save', onClick: noop },
    })
    toast.error('Failed to save file', { description: 'Permission denied' })
  }, [])
  return <Toaster expand visibleToasts={4} duration={Infinity} />
}
