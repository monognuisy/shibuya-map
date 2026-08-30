<script lang="ts">
  import { LEVELS } from '~/lib/levels';
  import type { AppState } from '~/lib/store.svelte';

  let { app }: { app: AppState } = $props();

  const present = $derived(new Set(app.levels));
</script>

<nav class="pane rail" aria-label="층 선택">
  <button
    class="lv"
    class:act={app.activeLevel === null}
    onclick={() => (app.activeLevel = null)}
  >
    <span class="n">ALL</span><span class="d">전체 층</span>
  </button>
  {#each LEVELS as lv (lv.id)}
    {#if present.has(lv.id)}
      <button
        class="lv"
        class:act={app.activeLevel === lv.id}
        onclick={() => (app.activeLevel = app.activeLevel === lv.id ? null : lv.id)}
      >
        <span class="n">{lv.code}</span><span class="d">{lv.label}</span>
      </button>
    {/if}
  {/each}
</nav>

<style>
  .rail {
    position: fixed;
    top: 118px;
    left: 14px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .lv {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 3px 8px;
    border: 0;
    border-radius: 3px;
    background: transparent;
    cursor: pointer;
    font-family: var(--mono);
    font-size: 10.5px;
    color: var(--tx3);
    transition: 0.15s;
    text-align: left;
    width: 100%;
  }
  .lv:hover {
    background: var(--panel2);
    color: var(--tx2);
  }
  .lv.act {
    background: var(--amber);
    color: #0e1218;
    font-weight: 600;
  }
  .n {
    width: 28px;
    font-weight: 500;
  }
  .d {
    font-size: 9.5px;
    opacity: 0.72;
    font-family: var(--sans);
  }
  .lv.act .d {
    opacity: 0.85;
  }
  @media (max-width: 900px) {
    .rail {
      top: auto;
      bottom: 14px;
      left: 14px;
      right: 14px;
      flex-direction: row;
      overflow-x: auto;
    }
    .d {
      display: none;
    }
  }
</style>
