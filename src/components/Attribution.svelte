<script lang="ts">
  import type { AppState } from '~/lib/store.svelte';
  import Pane from './Pane.svelte';
  let { app }: { app: AppState } = $props();
  let open = $state(false);
  const meta = $derived(app.doc?.meta ?? null);
</script>

<div class="relative">
  <button
    class="cursor-pointer rounded-4 border border-line bg-panel/90 px-10 py-4 font-mono text-2xs tracking-8 text-tx3 uppercase hover:border-line2 hover:text-tx2"
    onclick={() => (open = !open)}>데이터 출처 · 라이선스</button
  >
  {#if open && meta}
    <Pane class="absolute bottom-28 left-1/2 w-attr-sheet -translate-x-1/2 px-15 py-12 text-left">
      <button
        class="absolute top-6 right-8 cursor-pointer border-0 bg-transparent text-lg text-tx3"
        onclick={() => (open = false)}
        aria-label="닫기">×</button
      >
      <h3 class="mb-8 font-mono text-sm tracking-12 text-tx3 uppercase">데이터 출처</h3>
      <ul class="m-0 grid list-none gap-8 p-0">
        {#each meta.sources as s (s.key)}
          <li class="grid gap-2">
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer noopener"
              class="justify-self-start border-b border-line2 text-sm text-tx no-underline hover:text-amber"
              >{s.title}</a
            >
            <span class="text-xs text-tx3 leading-normal">{s.license}</span>
            <span class="text-xs text-tx3 leading-normal">취득 {s.fetchedAt.slice(0, 10)}</span>
          </li>
        {/each}
        <li class="grid gap-2">
          <span class="justify-self-start border-b border-line2 text-sm text-tx"
            >역 구내 레이어 (개찰 · 승강장 · 연락통로)</span
          >
          <span class="text-xs text-tx3 leading-normal"
            >본 프로젝트 자체 작성. <strong>공식 오픈데이터가 아닙니다.</strong></span
          >
          <span class="text-xs text-tx3 leading-normal"
            >시부야역 실내지도는 국토교통성 「屋内地図オープンデータ」 공개 대상에 포함되어 있지
            않습니다. 좌표는 OSM 의 승강장·통로 형상에 앵커링하고, 어디와 어디가 이어지는지는 각
            사업자가 공개한 구내도로 하나씩 대조했습니다. 대조 기준은 東急 「東横線・田園都市線渋谷駅
            立体図」(2026-08-21판), 京王 「渋谷駅階層図」(2026-03판), 東京メトロ·JR 東日本 공개
            구내도와 각 사업자 보도자료이며, 마지막 대조는 2026-08-31 입니다.</span
          >
        </li>
      </ul>
      <div class="mt-12 border-t border-line pt-8 font-mono text-2xs text-tx3">
        노드 {meta.counts.graphNodes?.toLocaleString()} · 엣지 {meta.counts.graphEdges?.toLocaleString()}
        · 건물 {meta.counts.buildings?.toLocaleString()} · 빌드 {meta.builtAt.slice(0, 10)}
      </div>
    </Pane>
  {/if}
</div>
