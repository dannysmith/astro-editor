<script lang="ts">
  // Svelte component with export let
  export let variant: 'default' | 'success' | 'warning' | 'error' = 'default'
  export let text: string
  export let rounded: boolean = true

  const variantClasses = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
  }
</script>

<span
  class={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${rounded ? 'rounded-full' : 'rounded'}`}
>
  {text}
</span>
