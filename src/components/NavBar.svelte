<script lang="ts">
  import { formatDuration } from '~/lib/graph';
  import { legSummary } from '~/lib/itinerary';
  import { levelCode } from '~/lib/levels';
  import type { AppState } from '~/lib/store.svelte';

  let { app }: { app: AppState } = $props();

  const it = $derived(app.itinerary);
  const legIndex = $derived(app.navLegIndex);
  const leg = $derived(it?.legs[legIndex]);
  const total = $derived(app.routeTotal);
  const progress = $derived(total > 0 ? Math.min(1, (app.navT ?? 0) / total) : 0);
</script>

<div class="pane nav">
  <div class="line">
    <button class="btn ico" onclick={() => app.gotoLeg(legIndex - 1)} aria-label="이전 구간">‹</button>
    <button
      class="btn ico play"
      onclick={() => (app.navPlaying = !app.navPlaying)}
      aria-label={app.navPlaying ? '일시정지' : '재생'}
    >
      {app.navPlaying ? '❚❚' : '▶'}
    </button>
    <button class="btn ico" onclick={() => app.gotoLeg(legIndex + 1)} aria-label="다음 구간">›</button>

    <div class="now">
      {#if leg}
        <span class="verb">{legSummary(leg)}</span>
        <span class="num">{Math.round(leg.distance)} m · {formatDuration(leg.seconds)}</span>
        {#if leg.arrival}
          <span class="to">
            → {leg.arrival.name}{#if leg.arrivalDetail}
              <span class="detail">{leg.arrivalDetail}</span>{/if}
            <span class="lv">{levelCode(leg.toLevel)}</span>
          </span>
        {/if}
      {:else}
        <span class="verb">도착</span>
      {/if}
    </div>

    <label class="speed">
      배속
      <select bind:value={app.navSpeed}>
        <option value={0.5}>0.5×</option>
        <option value={1}>1×</option>
        <option value={2}>2×</option>
        <option value={4}>4×</option>
        <option value={8}>8×</option>
      </select>
    </label>
    <button class="btn" onclick={() => (app.navT = null)}>나가기</button>
  </div>

  <input
    class="scrub"
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
  <div class="bar"><span style="width:{progress * 100}%"></span></div>
</div>

<style>
  .nav {
    position: fixed;
    /* 아래 가운데의 출처 버튼과 겹치지 않게 한 칸 올린다 */
    bottom: 42px;
    left: 50%;
    transform: translateX(-50%);
    width: min(720px, calc(100vw - 28px));
    padding: 9px 12px 7px;
    z-index: 6;
  }
  .line {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .ico {
    width: 28px;
    padding: 4px 0;
    text-align: center;
    font-family: var(--mono);
  }
  .play {
    background: var(--amber);
    border-color: var(--amber);
    color: #0e1218;
    font-weight: 600;
  }
  .now {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px;
    font-size: 11px;
    color: var(--tx2);
    min-width: 0;
  }
  .verb {
    color: var(--tx);
    font-weight: 500;
  }
  .num,
  .lv {
    font-family: var(--mono);
    font-size: 9.5px;
    color: var(--tx3);
  }
  .to {
    color: var(--tx2);
  }
  .detail {
    font-size: 9.5px;
    color: var(--amber);
    border: 1px solid var(--amber-dim);
    border-radius: 3px;
    padding: 0 4px;
    margin-left: 3px;
  }
  .speed {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 9.5px;
    color: var(--tx3);
  }
  .speed select {
    font-family: var(--mono);
    font-size: 10px;
    padding: 2px 4px;
    border-radius: 4px;
    border: 1px solid var(--line2);
    background: var(--panel2);
    color: var(--tx2);
  }
  .scrub {
    appearance: none;
    width: 100%;
    height: 12px;
    margin: 6px 0 0;
    background: transparent;
    cursor: pointer;
  }
  .scrub::-webkit-slider-thumb {
    appearance: none;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: var(--amber);
  }
  .scrub::-moz-range-thumb {
    width: 11px;
    height: 11px;
    border: none;
    border-radius: 50%;
    background: var(--amber);
  }
  .bar {
    height: 2px;
    background: var(--line2);
    border-radius: 1px;
    margin-top: -5px;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--amber);
    border-radius: 1px;
  }
</style>
