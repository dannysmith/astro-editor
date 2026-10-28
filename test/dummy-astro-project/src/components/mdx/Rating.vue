<script setup lang="ts">
// Vue component with defaults from withDefaults()
interface Props {
  value: number
  max?: number
  icon?: 'star' | 'heart' | 'circle'
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  max: 5,
  icon: 'star',
  readonly: true,
})
</script>

<template>
  <span class="rating" :aria-label="`${props.value} out of ${props.max}`">
    <span v-for="n in props.max" :key="n" :class="['rating-icon', props.icon, { filled: n <= props.value }]" />
  </span>
</template>
