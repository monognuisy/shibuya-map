<script lang="ts">
  import { formatDuration } from '~/lib/graph';
  import { levelCode } from '~/lib/levels';
  import type { AppState } from '~/lib/store.svelte';
  import Itinerary from './Itinerary.svelte';
  import Pane from './Pane.svelte';

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

<Pane
  class="fixed top-14 right-14 w-280 max-h-route overflow-y-auto px-13 py-11"
>
  <div class="mb-8 font-mono text-2xs tracking-13 text-tx3 uppercase">경로 안내</div>

  <label class="mb-6 block">
    <span class="mb-2 block text-xs text-tx3">출발</span>
    <select
      bind:value={app.fromId}
      class="w-full rounded-4 border border-line2 bg-panel2 px-8 py-4 font-sans
             text-sm text-tx cursor-pointer compact:min-h-40 compact:text-base"
    >
      {#each groups as g (g.kind)}
        <optgroup label={g.label}>
          {#each g.items as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
        </optgroup>
      {/each}
    </select>
  </label>
  <label class="mb-6 block">
    <span class="mb-2 block text-xs text-tx3">도착</span>
    <select
      bind:value={app.toId}
      class="w-full rounded-4 border border-line2 bg-panel2 px-8 py-4 font-sans
             text-sm text-tx cursor-pointer compact:min-h-40 compact:text-base"
    >
      {#each groups as g (g.kind)}
        <optgroup label={g.label}>
          {#each g.items as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
        </optgroup>
      {/each}
    </select>
  </label>

  <label
    class="flex cursor-pointer items-center gap-6 py-2 text-sm text-tx2 select-none
           compact:min-h-40 compact:gap-8 compact:text-base"
  >
    <input
      type="checkbox"
      bind:checked={app.barrierFree}
      class="h-12 w-12 cursor-pointer accent-amber compact:h-16 compact:w-16"
    />
    계단 · 에스컬레이터 회피 (배리어프리)
  </label>
  <label
    class="flex cursor-pointer items-center gap-6 py-2 text-sm text-tx2 select-none
           compact:min-h-40 compact:gap-8 compact:text-base"
  >
    <input
      type="checkbox"
      bind:checked={app.avoidPaidShortcut}
      class="h-12 w-12 cursor-pointer accent-amber compact:h-16 compact:w-16"
    />
    개찰 안쪽을 지름길로 쓰지 않기
  </label>

  {#if app.route}
    {@const r = app.route}
    <div class="mt-10 border-t border-line pt-9">
      <div class="font-mono text-xl font-semibold text-amber">{formatDuration(r.seconds)}</div>
      <div class="mt-2 text-10 text-tx2">
        {r.distance} m · 올라감 {r.climb} m · 내려감 {r.descend} m
      </div>
      <div class="mt-2 text-10 text-tx2">
        {#if r.gateCrossings === 0}
          개찰을 지나지 않습니다
        {:else}
          개찰 통과 {r.gateCrossings}회
        {/if}
      </div>
      <div class="mt-7 flex flex-wrap items-center gap-3">
        {#each r.levels as lv, i (i)}
          <span class="rounded-3 border border-line2 bg-panel2 px-5 py-1 font-mono text-xs text-tx2"
            >{levelCode(lv)}</span
          >{#if i < r.levels.length - 1}<span class="text-2xs text-tx3">→</span>{/if}
        {/each}
      </div>
    </div>
    <button
      class="mt-10 w-full cursor-pointer rounded-4 border border-amber bg-amber px-10 py-5
             font-sans text-sm font-medium text-bg transition duration-150
             hover:border-amber-dim hover:text-bg hover:opacity-90"
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
    <p class="mt-10 text-sm leading-normal text-tx3">출발과 도착이 같습니다.</p>
  {:else}
    <p class="mt-10 text-sm leading-normal text-tx3">
      선택한 조건으로 이어지는 경로가 없습니다.
      {#if app.barrierFree}배리어프리 조건을 풀면 찾을 수 있습니다.{/if}
      {#if app.avoidPaidShortcut}개찰 조건을 풀면 찾을 수 있습니다.{/if}
    </p>
  {/if}
</Pane>
