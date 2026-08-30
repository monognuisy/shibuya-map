<script lang="ts">
  import { formatDuration } from '~/lib/graph';
  import { levelCode } from '~/lib/levels';
  import type { AppState } from '~/lib/store.svelte';
  import Itinerary from './Itinerary.svelte';

  let { app }: { app: AppState } = $props();

  const GROUPS: { kind: string; label: string }[] = [
    { kind: 'platform', label: '승강장' },
    { kind: 'gate', label: '개찰' },
    { kind: 'plaza', label: '광장 · 콘코스' },
    { kind: 'passage', label: '연결통로' },
    { kind: 'building', label: '건물' },
    { kind: 'entrance', label: '지상 출입구' },
  ];

  // 수직 동선은 목적지로 고르기에 적절치 않아 뺀다.
  const groups = $derived(
    GROUPS.map((g) => ({
      ...g,
      items: app.places.filter(
        (p) => p.kind === g.kind && (!p.planned || app.showPlanned),
      ),
    })).filter((g) => g.items.length),
  );

</script>

<section class="pane route">
  <div class="glabel">경로 안내</div>

  <label class="fld">
    <span>출발</span>
    <select bind:value={app.fromId}>
      {#each groups as g (g.kind)}
        <optgroup label={g.label}>
          {#each g.items as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
        </optgroup>
      {/each}
    </select>
  </label>
  <label class="fld">
    <span>도착</span>
    <select bind:value={app.toId}>
      {#each groups as g (g.kind)}
        <optgroup label={g.label}>
          {#each g.items as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
        </optgroup>
      {/each}
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
    <button
      class="btn follow"
      onclick={() => {
        if (app.navOn) {
          app.navT = null;
          app.navPlaying = false;
        } else {
          app.navT = 0;
          app.navPlaying = true;
        }
      }}
    >
      {app.navOn ? '따라가기 끄기' : '경로 따라가기'}
    </button>
    <Itinerary {app} />
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
  .follow {
    width: 100%;
    margin-top: 10px;
    background: var(--amber);
    border-color: var(--amber);
    color: #0e1218;
    font-weight: 500;
  }
  .follow:hover {
    color: #0e1218;
    opacity: 0.9;
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
