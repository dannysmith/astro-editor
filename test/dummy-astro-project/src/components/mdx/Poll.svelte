<script lang="ts">
  // Svelte 5 component with typed $props()
  interface Props {
    /** The question to ask */
    question: string
    options: string[]
    layout?: 'list' | 'grid'
    /** How many options a reader may pick */
    maxChoices?: number
    showResults?: boolean
  }

  let { question, options, layout = 'list', maxChoices = 1, showResults = false }: Props = $props()
</script>

<fieldset class={`poll poll-${layout}`}>
  <legend>{question}</legend>
  {#each options as option}
    <label>
      <input type={maxChoices > 1 ? 'checkbox' : 'radio'} name={question} value={option} />
      {option}
    </label>
  {/each}
  {#if showResults}<p>Results appear after voting.</p>{/if}
</fieldset>
