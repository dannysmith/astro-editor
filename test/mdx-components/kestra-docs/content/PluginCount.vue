<template>
    <span>{{ totalPlugins }}</span>
</template>

<script setup lang="ts">
    import { computed } from "vue"
    import { usePluginsCount } from "~/composables/usePluginsCount"

    const props = defineProps<{
        subgroups?: any[]
    }>()

    const { totalPlugins } = usePluginsCount(
        props.subgroups ? computed<any[]>(() => props.subgroups ?? []) : undefined,
    )
</script>