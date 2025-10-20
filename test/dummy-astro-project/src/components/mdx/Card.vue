<script setup lang="ts">
// Vue Composition API with defineProps
const props = defineProps<{
  title: string
  subtitle?: string
  variant?: 'default' | 'featured'
}>()
</script>

<template>
  <div
    :class="[
      'rounded-lg border p-6',
      props.variant === 'featured'
        ? 'border-blue-500 bg-blue-50'
        : 'border-gray-200 bg-white',
    ]"
  >
    <h3 class="text-xl font-bold mb-2">{{ props.title }}</h3>
    <p v-if="props.subtitle" class="text-gray-600 mb-4">{{ props.subtitle }}</p>
    <div class="prose">
      <slot />
    </div>
  </div>
</template>
