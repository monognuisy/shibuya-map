<script lang="ts">
  import { formatDuration } from '~/lib/graph';
  import { levelCode } from '~/lib/levels';
  import { LINK_KIND_LABELS, OPERATOR_COLORS } from '~/lib/palette';
  import type { AppState } from '~/lib/store.svelte';

  let { app }: { app: AppState } = $props();

  const routable = $derived(app.places.filter((p) => !p.planned || app.showPlanned));

  /** 같은 종류가 이어지는 구간을 하나로 묶어 안내문을 만든다. */
  const legs = $derived.by(() => {
    const r = app.route;
    if (!r) return [];
    const out: { kind: string; distance: number; seconds: number; note?: string }[] = [];
    for (const s of r.steps) {
      const last = out[out.length - 1];
      const note = s.edge.n && s.edge.n !== '레이어 접합' ? s.edge.n : undefined;
      if (last && last.kind === s.edge.k && !note && !last.note) {
        last.distance += s.distance;
        last.seconds += s.seconds;
      } else {
        out.push({ kind: s.edge.k, distance: s.distance, seconds: s.seconds, note });
      }
    }
    return out.filter((l) => l.distance > 2 || l.kind !== 'walk');
  });
</script>

<section class="pane route">
  <div class="glabel">경로 안내</div>

  <label class="fld">
    <span>출발</span>
    <select bind:value={app.fromId}>
      {#each routable as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
    </select>
  </label>
  <label class="fld">
    <span>도착</span>
    <select bind:value={app.toId}>
      {#each routable as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
    </select>
  </label>

  <label class="tog">
    <input type="checkbox" bind:checked={app.barrierFree} />
    계단 · 에스컬레이터 회피 (배리어프리)
  </label>
  <label class="tog">
    <input type="checkbox" bind:checked={app.avoidPaidShortcut} />
    개찰 안쪽을 지름길로 쓰지 않기
  </label>

  {#if app.route}
    {@const r = app.route}
    <div class="summary">
      <div class="big">{formatDuration(r.seconds)}</div>
      <div class="sub">{r.distance} m · 올라감 {r.climb} m · 내려감 {r.descend} m</div>
      <div class="sub">
        {#if r.gateCrossings === 0}
          개찰을 지나지 않습니다
        {:else}
          개찰 통과 {r.gateCrossings}회
        {/if}
      </div>
      <div class="levels">
        {#each r.levels as lv, i (i)}
          <span class="lvchip">{levelCode(lv)}</span>{#if i < r.levels.length - 1}<span class="arr"
              >→</span
            >{/if}
        {/each}
      </div>
    </div>
    <ol class="legs">
      {#each legs as leg, i (i)}
        <li>
          <span class="k" data-kind={leg.kind}>{LINK_KIND_LABELS[leg.kind] ?? leg.kind}</span>
          <span class="m">{Math.round(leg.distance)} m</span>
          {#if leg.note}<span class="nt">{leg.note}</span>{/if}
        </li>
      {/each}
    </ol>
  {:else if app.fromId === app.toId}
    <p class="empty">출발과 도착이 같습니다.</p>
  {:else}
    <p class="empty">
      선택한 조건으로 이어지는 경로가 없습니다.
      {#if app.barrierFree}배리어프리 조건을 풀면 찾을 수 있습니다.{/if}
      {#if app.avoidPaidShortcut}개찰 조건을 풀면 찾을 수 있습니다.{/if}
    </p>
  {/if}
</section>

<style>
  .route {
    position: fixed;
    top: 14px;
    right: 14px;
    width: 280px;
    padding: 11px 13px;
    max-height: calc(100vh - 28px);
    overflow-y: auto;
  }
  .glabel {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: var(--tx3);
    margin-bottom: 8px;
  }
  .fld {
    display: block;
    margin-bottom: 6px;
  }
  .fld span {
    display: block;
    font-size: 9.5px;
    color: var(--tx3);
    margin-bottom: 2px;
  }
  select {
    width: 100%;
    font-family: var(--sans);
    font-size: 10.5px;
    padding: 4px 6px;
    border-radius: 4px;
    border: 1px solid var(--line2);
    background: var(--panel2);
    color: var(--tx);
  }
  .summary {
    margin-top: 10px;
    padding-top: 9px;
    border-top: 1px solid var(--line);
  }
  .big {
    font-family: var(--mono);
    font-size: 19px;
    color: var(--amber);
    font-weight: 600;
  }
  .sub {
    font-size: 10px;
    color: var(--tx2);
    margin-top: 2px;
  }
  .levels {
    margin-top: 7px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 3px;
  }
  .lvchip {
    font-family: var(--mono);
    font-size: 9.5px;
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--panel2);
    border: 1px solid var(--line2);
    color: var(--tx2);
  }
  .arr {
    color: var(--tx3);
    font-size: 9px;
  }
  .legs {
    list-style: none;
    margin: 9px 0 0;
    padding: 0;
    border-top: 1px solid var(--line);
    padding-top: 8px;
  }
  .legs li {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 10.5px;
    color: var(--tx2);
    padding: 2px 0;
  }
  .k {
    font-family: var(--mono);
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--panel2);
    border: 1px solid var(--line2);
    color: var(--tx3);
    flex: none;
  }
  .k[data-kind='stairs'] {
    color: #e8846a;
    border-color: #5a3b31;
  }
  .k[data-kind='escalator'] {
    color: var(--amber);
    border-color: var(--amber-dim);
  }
  .k[data-kind='elevator'] {
    color: #6fc3e0;
    border-color: #2c5566;
  }
  .m {
    font-family: var(--mono);
    color: var(--tx3);
    font-size: 9.5px;
  }
  .nt {
    color: var(--tx3);
    font-size: 9.5px;
  }
  .empty {
    margin-top: 10px;
    font-size: 10.5px;
    color: var(--tx3);
    line-height: 1.5;
  }
  @media (max-width: 900px) {
    .route {
      position: static;
      width: auto;
      margin: 0 14px 14px;
      max-height: none;
    }
  }
</style>
