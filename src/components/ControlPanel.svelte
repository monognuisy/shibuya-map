<script lang="ts">
  import { OPERATOR_COLORS, OPERATOR_LABELS, SOURCE_COLORS, SOURCE_LABELS } from '~/lib/palette';
  import { ALL_OPERATORS, type AppState } from '~/lib/store.svelte';
  import Btn from './Btn.svelte';
  import Pane from './Pane.svelte';

  let { app, onReset }: { app: AppState; onReset: () => void } = $props();

  const layerRows = [
    { key: 'curated', label: SOURCE_LABELS.curated, color: SOURCE_COLORS.curated },
    { key: 'landmarks', label: '주요 건물', color: '#7f8fa3' },
    { key: 'entrances', label: '지상 출입구', color: '#12A5C8' },
    { key: 'verticals', label: '계단 · 에스컬레이터 · EV', color: '#E8B23A' },
    { key: 'mlit', label: SOURCE_LABELS.mlit, color: SOURCE_COLORS.mlit },
    { key: 'osm', label: SOURCE_LABELS.osm, color: SOURCE_COLORS.osm },
    { key: 'buildings', label: '그 밖의 건물', color: '#2b3949' },
    { key: 'plates', label: '층 그리드', color: '#2b3644' },
  ] as const;
</script>

<Pane class="w-246 px-12 py-12">
  <div class="mb-12 last:mb-0">
    <div class="mb-6 font-mono text-2xs tracking-13 text-tx3 uppercase">레이어</div>
    {#each layerRows as row (row.key)}
      <label
        class="flex cursor-pointer items-center gap-6 py-2 text-sm text-tx2 select-none
               compact:min-h-40 compact:gap-8 compact:text-base"
      >
        <input
          type="checkbox"
          class="h-12 w-12 cursor-pointer accent-amber compact:h-16 compact:w-16"
          checked={app.layers[row.key]}
          onchange={(e) => (app.layers = { ...app.layers, [row.key]: e.currentTarget.checked })}
        />
        <span class="h-8 w-8 rounded-2" style="background:{row.color}"></span>
        {row.label}
      </label>
    {/each}
  </div>

  <div class="mb-12 last:mb-0">
    <div class="mb-6 font-mono text-2xs tracking-13 text-tx3 uppercase">사업자 · 종류</div>
    <div class="flex flex-wrap gap-4">
      {#each ALL_OPERATORS as op (op)}
        <button
          class="rounded-12 border px-8 py-3 font-sans text-sm transition-all duration-150 {app.operators.has(
            op,
          )
            ? 'cursor-pointer border-transparent font-medium text-bg'
            : 'cursor-pointer border-line2 bg-transparent text-tx3'}"
          style={app.operators.has(op)
            ? `background:${OPERATOR_COLORS[op as keyof typeof OPERATOR_COLORS]}`
            : ''}
          onclick={() => app.toggleOperator(op)}
        >
          {OPERATOR_LABELS[op as keyof typeof OPERATOR_LABELS]}
        </button>
      {/each}
    </div>
  </div>

  <div class="mb-12 last:mb-0">
    <div class="mb-6 font-mono text-2xs tracking-13 text-tx3 uppercase">표시</div>
    <div class="mb-6 flex items-center gap-8 text-sm text-tx2">
      <span>층 간격</span>
      <input
        type="range"
        class="w-full accent-amber compact:h-40"
        min="1"
        max="8"
        step="0.5"
        value={app.exaggeration}
        oninput={(e) => (app.exaggeration = Number(e.currentTarget.value))}
      />
      <span class="w-26 font-mono text-tx3">×{app.exaggeration}</span>
    </div>
    <div class="mb-6 flex items-center gap-8 text-sm text-tx2">
      <span>경로 굵기</span>
      <input
        type="range"
        class="w-full accent-amber compact:h-40"
        min="0.6"
        max="6"
        step="0.2"
        value={app.routeWidth}
        oninput={(e) => (app.routeWidth = Number(e.currentTarget.value))}
      />
      <span class="w-26 font-mono text-tx3">{app.routeWidth.toFixed(1)}</span>
    </div>
    <label
      class="flex cursor-pointer items-center gap-6 py-2 text-sm text-tx2 select-none
             compact:min-h-40 compact:gap-8 compact:text-base"
    >
      <input
        type="checkbox"
        class="h-12 w-12 cursor-pointer accent-amber compact:h-16 compact:w-16"
        checked={app.realHeights}
        onchange={(e) => (app.realHeights = e.currentTarget.checked)}
      />
      건물을 실제 높이로
    </label>
    <label
      class="flex cursor-pointer items-center gap-6 py-2 text-sm text-tx2 select-none
             compact:min-h-40 compact:gap-8 compact:text-base"
    >
      <input
        type="checkbox"
        class="h-12 w-12 cursor-pointer accent-amber compact:h-16 compact:w-16"
        checked={app.showPlanned}
        onchange={(e) => (app.showPlanned = e.currentTarget.checked)}
      />
      공사 중 시설 포함
    </label>
    <Btn onclick={onReset}>시점 초기화</Btn>
  </div>
</Pane>
