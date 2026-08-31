<script lang="ts">
  import { formatDuration } from '~/lib/graph';
  import { legSummary } from '~/lib/itinerary';
  import { levelCode } from '~/lib/levels';
  import type { AppState } from '~/lib/store.svelte';
  import Btn from './Btn.svelte';
  import Pane from './Pane.svelte';

  let { app }: { app: AppState } = $props();

  const it = $derived(app.itinerary);
  const legIndex = $derived(app.navLegIndex);
  const leg = $derived(it?.legs[legIndex]);
  const total = $derived(app.routeTotal);
  const progress = $derived(total > 0 ? Math.min(1, (app.navT ?? 0) / total) : 0);
</script>

<Pane class="w-nav pt-8 px-12 pb-6">
  <div class="flex items-center gap-6">
    <button
      class="w-28 cursor-pointer rounded-4 border border-line2 bg-panel2 px-0 py-4 text-center
             font-mono text-sm text-tx2 transition duration-150 hover:border-amber-dim hover:text-tx"
      onclick={() => app.gotoLeg(legIndex - 1)}
      aria-label="이전 구간">‹</button
    >
    <button
      class="w-28 cursor-pointer rounded-4 border border-amber bg-amber px-0 py-4 text-center
             font-mono text-sm font-semibold text-bg transition duration-150 hover:border-amber-dim
             hover:text-tx"
      onclick={() => (app.navPlaying = !app.navPlaying)}
      aria-label={app.navPlaying ? '일시정지' : '재생'}
    >
      {app.navPlaying ? '❚❚' : '▶'}
    </button>
    <button
      class="w-28 cursor-pointer rounded-4 border border-line2 bg-panel2 px-0 py-4 text-center
             font-mono text-sm text-tx2 transition duration-150 hover:border-amber-dim hover:text-tx"
      onclick={() => app.gotoLeg(legIndex + 1)}
      aria-label="다음 구간">›</button
    >

    <div class="flex min-w-0 flex-1 flex-wrap items-baseline gap-6 text-sm text-tx2">
      {#if leg}
        <span class="font-medium text-tx">{legSummary(leg)}</span>
        <span class="font-mono text-xs text-tx3"
          >{Math.round(leg.distance)} m · {formatDuration(leg.seconds)}</span
        >
        {#if leg.arrival}
          <span class="text-tx2">
            → {leg.arrival.name}{#if leg.arrivalDetail}
              <span class="ml-3 rounded-3 border border-amber-dim px-4 text-xs text-amber"
                >{leg.arrivalDetail}</span
              >{/if}
            <span class="font-mono text-xs text-tx3">{levelCode(leg.toLevel)}</span>
          </span>
        {/if}
      {:else}
        <span class="font-medium text-tx">도착</span>
      {/if}
    </div>

    <label class="flex items-center gap-4 text-xs text-tx3">
      배속
      <select
        bind:value={app.navSpeed}
        class="cursor-pointer rounded-4 border border-line2 bg-panel2 px-4 py-2 font-mono text-sm
               text-tx2"
      >
        <option value={0.5}>0.5×</option>
        <option value={1}>1×</option>
        <option value={2}>2×</option>
        <option value={4}>4×</option>
        <option value={8}>8×</option>
      </select>
    </label>
    <Btn onclick={() => (app.navT = null)}>나가기</Btn>
  </div>

  <input
    class="mt-6 w-full cursor-pointer accent-amber"
    type="range"
    min="0"
    max={total}
    step="1"
    value={app.navT ?? 0}
    oninput={(e) => {
      app.navT = Number(e.currentTarget.value);
      app.navPlaying = false;
    }}
    aria-label="경로 진행"
  />
  <div class="-mt-4 h-2 rounded-2 bg-line2">
    <span class="block h-full rounded-2 bg-amber" style="width:{progress * 100}%"></span>
  </div>
</Pane>
