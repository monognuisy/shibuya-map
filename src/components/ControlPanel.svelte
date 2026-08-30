<script lang="ts">
  import { OPERATOR_COLORS, OPERATOR_LABELS, SOURCE_COLORS, SOURCE_LABELS } from '~/lib/palette';
  import { ALL_OPERATORS, type AppState } from '~/lib/store.svelte';

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

<section class="pane ctl">
  <div class="grp">
    <div class="glabel">레이어</div>
    {#each layerRows as row (row.key)}
      <label class="tog">
        <input
          type="checkbox"
          checked={app.layers[row.key]}
          onchange={(e) => (app.layers = { ...app.layers, [row.key]: e.currentTarget.checked })}
        />
        <span class="swatch" style="background:{row.color}"></span>
        {row.label}
      </label>
    {/each}
  </div>

  <div class="grp">
    <div class="glabel">사업자 · 종류</div>
    <div class="chips">
      {#each ALL_OPERATORS as op (op)}
        <button
          class="chip"
          class:on={app.operators.has(op)}
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

  <div class="grp">
    <div class="glabel">표시</div>
    <div class="row">
      <span>층 간격</span>
      <input
        type="range"
        min="1"
        max="8"
        step="0.5"
        value={app.exaggeration}
        oninput={(e) => (app.exaggeration = Number(e.currentTarget.value))}
      />
      <span class="num">×{app.exaggeration}</span>
    </div>
    <div class="row">
      <span>경로 굵기</span>
      <input
        type="range"
        min="0.6"
        max="6"
        step="0.2"
        value={app.routeWidth}
        oninput={(e) => (app.routeWidth = Number(e.currentTarget.value))}
      />
      <span class="num">{app.routeWidth.toFixed(1)}</span>
    </div>
    <label class="tog">
      <input
        type="checkbox"
        checked={app.realHeights}
        onchange={(e) => (app.realHeights = e.currentTarget.checked)}
      />
      건물을 실제 높이로
    </label>
    <label class="tog">
      <input
        type="checkbox"
        checked={app.showPlanned}
        onchange={(e) => (app.showPlanned = e.currentTarget.checked)}
      />
      공사 중 시설 포함
    </label>
    <button class="btn" onclick={onReset}>시점 초기화</button>
  </div>
</section>

<style>
  .ctl {
    position: fixed;
    bottom: 14px;
    left: 14px;
    padding: 11px 13px;
    width: 246px;
  }
  .grp {
    margin-bottom: 11px;
  }
  .grp:last-child {
    margin-bottom: 0;
  }
  .glabel {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: var(--tx3);
    margin-bottom: 6px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .chip {
    font-size: 10.5px;
    padding: 3px 8px;
    border-radius: 11px;
    cursor: pointer;
    border: 1px solid var(--line2);
    color: var(--tx3);
    background: transparent;
    font-family: var(--sans);
    transition: 0.15s;
  }
  .chip.on {
    color: #0e1218;
    font-weight: 500;
    border-color: transparent;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 10.5px;
    color: var(--tx2);
    margin-bottom: 6px;
  }
  .num {
    font-family: var(--mono);
    color: var(--tx3);
    width: 26px;
  }
  .swatch {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    display: inline-block;
  }
  input[type='range'] {
    appearance: none;
    flex: 1;
    height: 2px;
    background: var(--line2);
    border-radius: 2px;
    outline: none;
  }
  input[type='range']::-webkit-slider-thumb {
    appearance: none;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: var(--amber);
    cursor: pointer;
  }
  input[type='range']::-moz-range-thumb {
    width: 11px;
    height: 11px;
    border: none;
    border-radius: 50%;
    background: var(--amber);
    cursor: pointer;
  }
  @media (max-width: 900px) {
    .ctl {
      display: none;
    }
  }
</style>
