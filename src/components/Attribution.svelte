<script lang="ts">
  import type { AppState } from '~/lib/store.svelte';
  let { app }: { app: AppState } = $props();
  let open = $state(false);
  const meta = $derived(app.doc?.meta ?? null);
</script>

<div class="attr">
  <button class="link" onclick={() => (open = !open)}>데이터 출처 · 라이선스</button>
  {#if open && meta}
    <div class="pane sheet">
      <button class="close" onclick={() => (open = false)} aria-label="닫기">×</button>
      <h3>데이터 출처</h3>
      <ul>
        {#each meta.sources as s (s.key)}
          <li>
            <a href={s.url} target="_blank" rel="noreferrer noopener">{s.title}</a>
            <span class="lic">{s.license}</span>
            <span class="at">취득 {s.fetchedAt.slice(0, 10)}</span>
          </li>
        {/each}
        <li>
          <span class="curated">역 구내 레이어 (개찰 · 승강장 · 연락통로)</span>
          <span class="lic"
            >본 프로젝트 자체 작성. <strong>공식 오픈데이터가 아닙니다.</strong></span
          >
          <span class="at"
            >시부야역 실내지도는 국토교통성 「屋内地図オープンデータ」 공개 대상에 포함되어 있지
            않습니다. 좌표는 OSM 의 승강장·통로 형상에 앵커링하고, 어디와 어디가 이어지는지는 각
            사업자가 공개한 구내도로 하나씩 대조했습니다. 대조 기준은 東急 「東横線・田園都市線渋谷駅
            立体図」(2026-08-21판), 京王 「渋谷駅階層図」(2026-03판), 東京メトロ·JR 東日本 공개
            구내도와 각 사업자 보도자료이며, 마지막 대조는 2026-08-31 입니다.</span
          >
        </li>
      </ul>
      <div class="counts">
        노드 {meta.counts.graphNodes?.toLocaleString()} · 엣지 {meta.counts.graphEdges?.toLocaleString()}
        · 건물 {meta.counts.buildings?.toLocaleString()} · 빌드 {meta.builtAt.slice(0, 10)}
      </div>
    </div>
  {/if}
</div>

<style>
  .attr {
    position: fixed;
    bottom: 14px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 5;
  }
  .link {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--tx3);
    background: rgba(22, 29, 38, 0.9);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 4px 10px;
    cursor: pointer;
  }
  .link:hover {
    color: var(--tx2);
    border-color: var(--line2);
  }
  .sheet {
    position: absolute;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%);
    width: min(560px, 92vw);
    padding: 13px 15px;
    text-align: left;
  }
  .close {
    position: absolute;
    top: 6px;
    right: 9px;
    background: none;
    border: 0;
    color: var(--tx3);
    cursor: pointer;
    font-size: 15px;
  }
  h3 {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--tx3);
    margin-bottom: 8px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 9px;
  }
  li {
    display: grid;
    gap: 2px;
  }
  a,
  .curated {
    font-size: 11px;
    color: var(--tx);
    text-decoration: none;
    border-bottom: 1px solid var(--line2);
    justify-self: start;
  }
  a:hover {
    color: var(--amber);
  }
  .lic,
  .at {
    font-size: 9.5px;
    color: var(--tx3);
    line-height: 1.5;
  }
  .counts {
    margin-top: 11px;
    padding-top: 8px;
    border-top: 1px solid var(--line);
    font-family: var(--mono);
    font-size: 9px;
    color: var(--tx3);
  }
</style>
