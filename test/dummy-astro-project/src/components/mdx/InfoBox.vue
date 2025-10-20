<script setup lang="ts">
// Vue component testing slot detection
const props = defineProps<{
  type: 'note' | 'tip' | 'warning'
  icon?: string
}>()

const typeStyles = {
  note: 'bg-blue-50 border-blue-200',
  tip: 'bg-green-50 border-green-200',
  warning: 'bg-orange-50 border-orange-200',
}
</script>

<template>
  <div :class="['border-l-4 p-4 mb-4', typeStyles[props.type]]">
    <div v-if="props.icon" class="flex items-start gap-3">
      <span class="text-2xl">{{ props.icon }}</span>
      <div class="flex-1">
        <slot />
      </div>
    </div>
    <div v-else>
      <slot />
    </div>
  </div>
</template>
