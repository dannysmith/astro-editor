<template>
    <div class="guides">
        <div class="guides-filters">
            <div class="guides-search">
                <input
                    type="text"
                    class="guides-search-input"
                    placeholder="Search guides"
                    aria-label="Search guides"
                    v-model="search"
                />
                <Magnify class="guides-search-icon" />
            </div>
            <div class="guides-filter">
                <MultiSelect
                    name="topic"
                    v-model="topic"
                    :options="topicOptions"
                />
            </div>
            <div class="guides-filter">
                <MultiSelect
                    name="stage"
                    v-model="stage"
                    :options="stageOptions"
                />
            </div>
            <button
                v-if="hasActiveFilters"
                type="button"
                class="guides-clear"
                @click="removeFilter"
            >
                <DeleteOutline />
                <span>Clear filters</span>
            </button>
        </div>

        <p class="guides-count">
            {{ filtered.length }}
            {{ filtered.length === 1 ? "Guide" : "Guides" }}
        </p>

        <Suspense>
            <div class="guides-grid">
                <a
                    class="guide-card"
                    :href="item.path"
                    v-for="item in paginated"
                    :key="item.path"
                >
                    <div class="guide-card-head">
                        <div class="guide-card-logo">
                            <img
                                v-if="item.icon"
                                class="guide-card-logo-img"
                                :src="item.icon"
                                :alt="item.title"
                                width="48"
                                height="48"
                                loading="lazy"
                            />
                            <BookOpenVariantOutline
                                v-else
                                class="guide-card-logo-icon"
                            />
                        </div>
                        <div class="guide-card-body">
                            <h3 class="guide-card-title">{{ item.title }}</h3>
                            <MarkdownRendererSSR
                                :content="item.description"
                                class="guide-card-description"
                            />
                        </div>
                    </div>
                    <div class="guide-card-tags">
                        <span
                            v-if="item.stage"
                            class="guide-tag"
                            :class="stageClasses[item.stage]"
                        >
                            {{ item.stage }}
                        </span>
                        <span
                            v-for="topicName in item.topics"
                            :key="topicName"
                            class="guide-tag"
                        >
                            {{ topicName }}
                        </span>
                    </div>
                </a>
            </div>
        </Suspense>

        <p v-if="!filtered.length" class="guides-empty">
            No guides match your filters.
        </p>

        <PaginationContainer
            v-else
            :totalItems="filtered.length"
            :currentUrl="currentUrl"
            :sizeOptions="PAGE_SIZE_OPTIONS"
            :defaultSize="DEFAULT_PAGE_SIZE"
            nofollow
            @update="onPaginationUpdate"
        />
    </div>
</template>

<script setup>
    import { computed, onMounted, ref } from "vue"
    import Magnify from "vue-material-design-icons/Magnify.vue"
    import DeleteOutline from "vue-material-design-icons/DeleteOutline.vue"
    import BookOpenVariantOutline from "vue-material-design-icons/BookOpenVariantOutline.vue"
    import MultiSelect from "~/components/select/MultiSelect.vue"
    import MarkdownRendererSSR from "~/components/MarkdownRendererSSR.vue"
    import PaginationContainer from "~/components/common/PaginationContainer.vue"

    const props = defineProps({
        pageUrl: {
            type: String,
            default: undefined,
        },
        navigation: {
            type: Array,
            default: undefined,
        },
    })

    const stage = ref([])
    const topic = ref([])
    const search = ref("")
    const stageOptions = ["Getting Started", "Intermediate", "Advanced"]
    const topicOptions = [
        "Scripting",
        "DevOps",
        "Integrations",
        "Version Control",
        "Kestra Workflow Components",
        "Kestra Concepts",
        "Best Practices",
    ]

    const stageClasses = {
        "Getting Started": "guide-tag-stage-success",
        Intermediate: "guide-tag-stage-warning",
        Advanced: "guide-tag-stage-danger",
    }

    const currentUrl = ref(props.pageUrl)

    onMounted(() => {
        currentUrl.value = window.location.href
    })

    const removeFilter = () => {
        stage.value = []
        topic.value = []
        search.value = ""
    }

    const hasActiveFilters = computed(
        () =>
            stage.value.length > 0 || topic.value.length > 0 || !!search.value,
    )

    const filtered = computed(() => {
        let results = props.navigation ?? []

        if (stage.value.length > 0) {
            results = results.filter((item) => stage.value.includes(item.stage))
        }

        if (topic.value.length > 0) {
            results = results.filter((item) => {
                for (const t of topic.value) {
                    if (!item.topics?.includes(t)) return false
                }
                return true
            })
        }

        if (search.value) {
            const q = search.value.toLowerCase()
            results = results.filter(
                (item) =>
                    (item.title || "").toLowerCase().includes(q) ||
                    (item.description || "").toLowerCase().includes(q),
            )
        }

        return results
    })

    const DEFAULT_PAGE_SIZE = 8
    const PAGE_SIZE_OPTIONS = [8, 16, 32, 64]

    const pageSize = ref(DEFAULT_PAGE_SIZE)
    const currentPage = ref(1)

    const onPaginationUpdate = ({ size, page }) => {
        pageSize.value = size
        currentPage.value = page
    }

    const paginated = computed(() => {
        const lastPage = Math.max(
            1,
            Math.ceil(filtered.value.length / pageSize.value),
        )
        const page = Math.min(currentPage.value, lastPage)
        const start = (page - 1) * pageSize.value
        return filtered.value.slice(start, start + pageSize.value)
    })
</script>

<style lang="scss" scoped>
    :deep(.material-design-icon__svg) {
        bottom: 0;
    }

    .guides-filters {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
    }

    .guides-search {
        position: relative;
        flex: 0 1 305px;
    }

    .guides-search-input {
        width: 100%;
        height: 50px;
        padding: 4px 48px 4px 16px;
        border: 1px solid var(--ks-border-secondary);
        border-radius: 4px;
        background-color: var(--ks-background-input);
        color: var(--ks-content-primary);
        font-size: $font-size-sm;
        &::placeholder {
            color: var(--ks-content-primary);
        }
        &:focus {
            outline: none;
            border-color: var(--ks-border-active);
        }
    }

    .guides-search-icon {
        position: absolute;
        top: 50%;
        right: 16px;
        transform: translateY(-50%);
        color: var(--ks-content-primary);
        pointer-events: none;
    }

    .guides-filter {
        flex: 0 0 168px;
    }

    .guides-clear {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 0;
        border: none;
        background: none;
        color: var(--ks-content-secondary);
        font-size: $font-size-sm;
        cursor: pointer;
    }

    .guides-search-input,
    .guides-clear {
        &:focus-visible {
            outline: 2px solid var(--ks-border-active);
            outline-offset: 2px;
        }
    }

    @include media-breakpoint-down(sm) {
        .guides-search,
        .guides-filter {
            flex: 1 1 100%;
        }
    }

    .guides-count {
        margin: 20px 0;
        font-size: $font-size-base;
        line-height: 24px;
        font-weight: 600;
        color: var(--ks-content-primary);
    }

    .guides-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        @include media-breakpoint-down(md) {
            grid-template-columns: minmax(0, 1fr);
        }
    }

    .guide-card {
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-height: 152px;
        padding: 16px;
        border: 1px solid var(--ks-border-secondary);
        border-radius: 8px;
        background-color: var(--ks-background-primary);
        box-shadow: 2px 3px 16px 0px var(--ks-shadows-light);
        color: var(--ks-content-primary);
        text-decoration: none;
        transition: border-color 0.3s;
        &:hover {
            border-color: var(--ks-border-active);
        }
    }

    .guide-card-head {
        display: flex;
        gap: 16px;
    }

    .guide-card-logo {
        display: grid;
        place-items: center;
        flex-shrink: 0;
        width: 60px;
        height: 60px;
        border: 1px solid var(--ks-border-primary);
        border-radius: 8px;
        background-color: $white;
    }

    .guide-card-logo-img {
        width: 48px;
        height: 48px;
        object-fit: contain;
    }

    .guide-card-logo-icon {
        font-size: 24px;
        color: var(--ks-icon-color);
    }

    .guide-card-body {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
    }

    .guide-card-title {
        margin: 0;
        font-size: $font-size-base;
        line-height: 24px;
        font-weight: 600;
        color: var(--ks-content-primary);
    }

    .guide-card-description {
        height: 32px;
        overflow: hidden;
        :deep(p) {
            margin: 0;
            font-size: $font-size-xs;
            line-height: 16px;
            color: var(--ks-content-secondary);
            overflow: hidden;
            display: -webkit-box;
            line-clamp: 2;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }
    }

    .guide-card-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: auto;
    }

    .guide-tag {
        padding: 2px 8px;
        border-radius: 40px;
        background-color: var(--guide-tag-bg, var(--ks-background-tertiary));
        color: var(--guide-tag-fg, var(--ks-content-secondary));
        font-size: $font-size-xs;
        line-height: 16px;
        font-weight: 600;
        white-space: nowrap;
    }

    $stage-tags: (
        "success": "tag-success",
        "warning": "alert-warning",
        "danger": "alert-danger",
    );

    @each $stage, $family in $stage-tags {
        .guide-tag-stage-#{$stage} {
            --guide-tag-bg: var(--ks-background-#{$family});
            --guide-tag-fg: var(--ks-content-#{$family});
        }
    }

    .guides-empty {
        margin: 0;
        color: var(--ks-content-secondary);
        font-size: $font-size-sm;
    }
</style>
