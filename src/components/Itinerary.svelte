<script lang="ts">
  import { formatDuration } from '~/lib/graph';
  import { legSummary } from '~/lib/itinerary';
  import { levelCode } from '~/lib/levels';
  import { OPERATOR_COLORS, VERTICAL_COLORS } from '~/lib/palette';
  import type { AppState } from '~/lib/store.svelte';

  let { app }: { app: AppState } = $props();
  const it = $derived(app.itinerary);

  /** 근거의 강도를 한 낱말로. 링크 자체가 문헌으로 이어진다. */
  const SOURCE_WORDS: Record<string, string> = {
    official: '구내도',
    press: '보도',
    osm: 'OSM',
    secondary: '참고',
  };

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
  <ol class="mt-8 list-none pl-2">
    {#if it.origin}
      <li class="flex items-center gap-6 py-2 text-sm">
        <span
          class="ml-1 h-8 w-8 flex-none rounded-full ring-2 ring-bg/90"
          style="background:var(--color-amber)"
        ></span>
        <span class="text-tx">{it.origin.name}</span>
        <span class="ml-auto flex-none font-mono text-2xs text-tx3">{levelCode(it.origin.level)}</span>
      </li>
    {/if}

    {#each rows as { leg, repeat }, i (i)}
      {@const now = app.navOn && i === app.navLegIndex}
      <li
        class="flex items-start gap-6 py-1 text-sm {now ? 'rounded-4 bg-amber/9' : ''}"
        data-kind={leg.kind}
      >
        <span
          class="ml-4 w-2 flex-none self-stretch min-h-20 rounded-2 opacity-55"
          style="background:{VERTICAL_COLORS[leg.kind] ?? '#5F6C7D'}"
        ></span>
        <div class="flex flex-wrap items-baseline gap-4 pt-2 pb-4">
          <button
            class="cursor-pointer border-0 bg-transparent p-0 font-sans text-sm
                   {now ? 'font-medium text-amber' : 'font-light text-tx2 hover:text-tx'}"
            onclick={() => {
              if (app.navT === null) app.navT = 0;
              app.gotoLeg(i);
            }}>{legSummary(leg)}</button
          >
          <span class="font-mono text-xs text-tx3">{Math.round(leg.distance)} m · {formatDuration(leg.seconds)}</span>
          {#if leg.paid}<span class="rounded-3 border border-line2 bg-panel2 px-4 text-2xs text-tx2">개찰 안</span>{/if}
          {#if leg.vertical}
            <span class="rounded-3 border border-line2 px-4 text-2xs text-tx3">{leg.vertical.name}</span>
          {/if}
          {#if leg.via.length}
            <span class="text-xs text-tx3">{leg.via.slice(0, 2).join(' · ')}</span>
          {/if}
          {#if leg.refs.length || leg.unsourced}
            <span class="inline-flex items-baseline gap-4">
              {#each leg.refs as r (r)}
                {@const src = app.doc?.meta.linkSources[r]}
                {#if src}
                  <!-- #6fb3a0: 근거 배지 official 전용 색. 근거 배지에서만 쓰이는 두 색 중 하나라
                       계획의 유일한 임의값 예외 (Task 4, 계획 479줄) -->
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    data-kind={src.kind}
                    title="{src.title}{src.revision ? ` (${src.revision})` : ''}"
                    class="rounded-3 border border-current/25 px-4 text-2xs leading-relaxed
                           whitespace-nowrap text-tx3 no-underline hover:bg-current/12
                           data-[kind=official]:text-[#6fb3a0]"
                    >{SOURCE_WORDS[src.kind] ?? src.kind}</a
                  >
                {/if}
              {/each}
              {#if leg.unsourced}
                <!-- #b58a5a: 미대조 배지 전용 색. 근거 배지에서만 쓰이는 두 색 중 나머지 하나라
                     계획의 유일한 임의값 예외 (Task 4, 계획 479줄) -->
                <span
                  class="rounded-3 border border-current/25 px-4 text-2xs leading-relaxed
                         whitespace-nowrap text-[#b58a5a]"
                  title="사업자 공개 자료로 아직 대조하지 못한 구간입니다">미대조</span
                >
              {/if}
            </span>
          {/if}
        </div>
      </li>

      {#if leg.arrival}
        {@const last = i === rows.length - 1}
        <li class="flex items-center gap-6 py-2 text-sm">
          <span
            class="flex-none rounded-full ring-2 ring-bg/90 {repeat ? 'opacity-70' : ''}
                   {last ? 'ml-1 h-8 w-8' : repeat ? 'ml-3 h-4 w-4' : 'ml-2 h-6 w-6'}"
            style="background:{last ? 'var(--color-amber)' : OPERATOR_COLORS[leg.arrival.operator]}"
          ></span>
          {#if repeat}
            <span class="text-xs text-tx3">같은 {KIND_WORDS[leg.arrival.kind] ?? '지점'} 안</span>
          {:else}
            <button
              class="cursor-pointer border-0 bg-transparent p-0 text-left font-sans text-sm
                     font-light text-tx hover:text-amber"
              onclick={() => (app.selectedId = leg.arrival!.id)}
            >
              {leg.arrival.name}
            </button>
          {/if}
          {#if leg.arrivalDetail}<span
              class="flex-none rounded-3 border border-amber-dim px-4 text-xs text-amber"
              >{leg.arrivalDetail}</span
            >{/if}
          <span class="ml-auto flex-none font-mono text-2xs text-tx3">{levelCode(leg.toLevel)}</span>
        </li>
      {/if}
    {/each}
  </ol>
{/if}
