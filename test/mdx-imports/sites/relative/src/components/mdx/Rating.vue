<script setup lang="ts">
/** Rating, a fixture component */
defineProps<{ stars: number }>()
</script>

<template>
  <span class="rating">{{ stars }}</span>
</template>
