<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    class: klass = '',
    children,
    ...rest
  }: { class?: string; children: Snippet; [k: string]: unknown } = $props();
</script>

<button
  class="cursor-pointer rounded-4 border border-line2 bg-panel2 px-10 py-5
         font-sans text-sm text-tx2 transition duration-150
         hover:border-amber-dim hover:text-tx
         compact:min-h-40 compact:px-12 compact:py-8 compact:text-base {klass}"
  {...rest}
>
  {@render children()}
</button>
