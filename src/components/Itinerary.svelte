<script lang="ts">
  import { formatDuration } from '~/lib/graph';
  import { legSummary } from '~/lib/itinerary';
  import { levelCode } from '~/lib/levels';
  import { OPERATOR_COLORS, VERTICAL_COLORS } from '~/lib/palette';
  import type { AppState } from '~/lib/store.svelte';

  let { app }: { app: AppState } = $props();
  const it = $derived(app.itinerary);

  const KIND_WORDS: Record<string, string> = {
    platform: '승강장',
    plaza: '광장',
    passage: '통로',
    building: '건물',
  };

  /**
   * 같은 지점에 연달아 닿는 경우(승강장 남쪽 끝 → 남쪽)에는 이름을 다시 쓰지
   * 않고 위치만 보여준다. 이름이 반복되면 목록이 읽히지 않는다.
   */
  const rows = $derived.by(() => {
    if (!it) return [];
    let lastId = it.origin?.id;
    return it.legs.map((leg) => {
      const repeat = Boolean(leg.arrival && leg.arrival.id === lastId);
      if (leg.arrival) lastId = leg.arrival.id;
      return { leg, repeat };
    });
  });
</script>

{#if it}
  <ol class="legs">
    {#if it.origin}
      <li class="stop start">
        <span class="dot" style="--c:{OPERATOR_COLORS[it.origin.operator]}"></span>
        <span class="nm">{it.origin.name}</span>
        <span class="lv">{levelCode(it.origin.level)}</span>
      </li>
    {/if}

    {#each rows as { leg, repeat }, i (i)}
      <li
        class="move"
        class:now={app.navOn && i === app.navLegIndex}
        data-kind={leg.kind}
      >
        <span class="rail" style="--c:{VERTICAL_COLORS[leg.kind] ?? '#5F6C7D'}"></span>
        <div class="body">
          <button
            class="verb"
            onclick={() => {
              if (app.navT === null) app.navT = 0;
              app.gotoLeg(i);
            }}>{legSummary(leg)}</button
          >
          <span class="num">{Math.round(leg.distance)} m · {formatDuration(leg.seconds)}</span>
          {#if leg.paid}<span class="badge paid">개찰 안</span>{/if}
          {#if leg.vertical}
            <span class="badge">{leg.vertical.name}</span>
          {/if}
          {#if leg.via.length}
            <span class="via">{leg.via.slice(0, 2).join(' · ')}</span>
          {/if}
        </div>
      </li>

      {#if leg.arrival}
        <li class="stop" class:last={i === rows.length - 1} class:repeat>
          <span class="dot" style="--c:{OPERATOR_COLORS[leg.arrival.operator]}"></span>
          {#if repeat}
            <span class="nm same">같은 {KIND_WORDS[leg.arrival.kind] ?? '지점'} 안</span>
          {:else}
            <button class="nm" onclick={() => (app.selectedId = leg.arrival!.id)}>
              {leg.arrival.name}
            </button>
          {/if}
          {#if leg.arrivalDetail}<span class="detail">{leg.arrivalDetail}</span>{/if}
          <span class="lv">{levelCode(leg.toLevel)}</span>
        </li>
      {/if}
    {/each}
  </ol>
{/if}

<style>
  .legs {
    list-style: none;
    margin: 9px 0 0;
    padding: 0 0 0 2px;
  }
  li {
    display: flex;
    align-items: flex-start;
    gap: 7px;
    font-size: 10.5px;
  }
  .stop {
    align-items: center;
    padding: 2px 0;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--c, var(--tx3));
    flex: none;
    margin-left: 2px;
    box-shadow: 0 0 0 2px rgba(14, 18, 24, 0.9);
  }
  .stop.repeat .dot {
    width: 5px;
    height: 5px;
    margin-left: 3px;
    opacity: 0.7;
  }
  .same {
    color: var(--tx3);
    font-size: 9.5px;
  }
  .stop.start .dot,
  .stop.last .dot {
    width: 9px;
    height: 9px;
    margin-left: 1px;
    background: var(--amber);
  }
  .nm {
    color: var(--tx);
  }
  button.nm {
    background: none;
    border: 0;
    padding: 0;
    font: inherit;
    color: var(--tx);
    cursor: pointer;
    text-align: left;
  }
  button.nm:hover {
    color: var(--amber);
  }
  .detail {
    font-size: 9.5px;
    color: var(--amber);
    border: 1px solid var(--amber-dim);
    border-radius: 3px;
    padding: 0 4px;
    flex: none;
  }
  .lv {
    font-family: var(--mono);
    font-size: 9px;
    color: var(--tx3);
    margin-left: auto;
    flex: none;
  }
  .move {
    padding: 1px 0;
  }
  .rail {
    width: 2px;
    align-self: stretch;
    min-height: 20px;
    background: var(--c);
    opacity: 0.55;
    margin-left: 4px;
    flex: none;
    border-radius: 1px;
  }
  .body {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 5px;
    padding: 2px 0 4px;
  }
  button.verb {
    background: none;
    border: 0;
    padding: 0;
    font: inherit;
    color: var(--tx2);
    cursor: pointer;
  }
  button.verb:hover {
    color: var(--tx);
  }
  .move.now {
    background: rgba(232, 178, 58, 0.09);
    border-radius: 4px;
  }
  .move.now button.verb {
    color: var(--amber);
    font-weight: 500;
  }
  .num {
    font-family: var(--mono);
    font-size: 9.5px;
    color: var(--tx3);
  }
  .badge {
    font-size: 9px;
    padding: 0 4px;
    border-radius: 3px;
    border: 1px solid var(--line2);
    color: var(--tx3);
  }
  .badge.paid {
    color: var(--tx2);
    border-color: var(--line2);
    background: var(--panel2);
  }
  .via {
    font-size: 9.5px;
    color: var(--tx3);
  }
</style>
