<script lang="ts">
  import type { Snippet } from 'svelte';
  let { class: klass = '', children }: { class?: string; children: Snippet } = $props();
</script>

<div
  class="z-10 rounded-6 border border-line bg-panel/94 backdrop-blur-12 {klass}"
>
  {@render children()}
</div>
