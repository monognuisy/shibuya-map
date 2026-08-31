<script lang="ts">
  import { LEVELS } from '~/lib/levels';
  import type { AppState } from '~/lib/store.svelte';

  let { app }: { app: AppState } = $props();

  const present = $derived(new Set(app.levels));
</script>

<nav
  class="fixed top-118 left-14 z-10 flex flex-col gap-1 rounded-6 border border-line bg-panel/94 p-6 backdrop-blur-12"
  aria-label="층 선택"
>
  <button
    class="flex w-full cursor-pointer items-center gap-9 rounded-3 border-0 px-8 py-3 text-left font-mono text-sm transition duration-150 {app.activeLevel ===
    null
      ? 'bg-amber font-semibold text-bg'
      : 'bg-transparent text-tx3 hover:bg-panel2 hover:text-tx2'}"
    onclick={() => (app.activeLevel = null)}
  >
    <span class="w-28 font-medium">ALL</span><span
      class="font-sans text-xs {app.activeLevel === null ? 'opacity-85' : 'opacity-70'}"
      >전체 층</span
    >
  </button>
  {#each LEVELS as lv (lv.id)}
    {#if present.has(lv.id)}
      <button
        class="flex w-full cursor-pointer items-center gap-9 rounded-3 border-0 px-8 py-3 text-left font-mono text-sm transition duration-150 {app.activeLevel ===
        lv.id
          ? 'bg-amber font-semibold text-bg'
          : 'bg-transparent text-tx3 hover:bg-panel2 hover:text-tx2'}"
        onclick={() => (app.activeLevel = app.activeLevel === lv.id ? null : lv.id)}
      >
        <span class="w-28 font-medium">{lv.code}</span><span
          class="font-sans text-xs {app.activeLevel === lv.id ? 'opacity-85' : 'opacity-70'}"
          >{lv.label}</span
        >
      </button>
    {/if}
  {/each}
</nav>
