<script lang="ts">
  import { levelCode } from '~/lib/levels';
  import {
    KIND_LABELS,
    OPERATOR_COLORS,
    OPERATOR_LABELS,
    PROVENANCE_LABELS,
  } from '~/lib/palette';
  import type { AppState } from '~/lib/store.svelte';
  import Btn from './Btn.svelte';
  import Pane from './Pane.svelte';

  let { app }: { app: AppState } = $props();
  const p = $derived(app.selected);
</script>

{#if p}
  <Pane class="fixed bottom-14 right-14 w-280 px-12 py-12">
    <button
      class="absolute top-6 right-8 cursor-pointer border-0 bg-transparent text-lg leading-none text-tx3 hover:text-tx"
      onclick={() => (app.selectedId = null)}
      aria-label="닫기">×</button
    >
    <div class="flex flex-wrap items-center gap-6 font-mono text-2xs tracking-6 text-tx3 uppercase">
      <span
        class="h-6 w-6 rounded-full"
        style="background:{OPERATOR_COLORS[p.operator as keyof typeof OPERATOR_COLORS]}"
      ></span>
      {#if p.kind !== 'building'}
        <span>{OPERATOR_LABELS[p.operator as keyof typeof OPERATOR_LABELS]}</span>
      {/if}
      <span class="rounded-3 border border-line2 px-4 py-1">{levelCode(p.level)}</span>
      <span class="rounded-3 border border-line2 px-4 py-1">{KIND_LABELS[p.kind] ?? p.kind}</span>
      {#if p.planned}<span class="rounded-3 border border-amber-dim px-4 py-1 text-amber"
          >공사중</span
        >{/if}
    </div>
    <h2 class="mt-6 mb-1 text-lg font-medium text-tx">{p.name}</h2>
    {#if p.nameJa}<div class="text-sm text-tx3">{p.nameJa}</div>{/if}
    {#if p.desc}<p class="mt-8 text-sm leading-165 text-tx2">{p.desc}</p>{/if}
    {#if p.connectLevels?.length}
      <div class="mt-8 flex flex-wrap items-center gap-4">
        <span class="mr-2 text-xs text-tx3">역·통로와 이어지는 층</span>
        {#each [...p.connectLevels].sort((a, b) => b - a) as lv (lv)}
          <span class="rounded-3 border border-line2 bg-panel2 px-4 py-1 font-mono text-xs text-tx2"
            >{levelCode(lv)}</span
          >
        {/each}
      </div>
    {/if}
    {#if p.tags}
      <dl class="mt-8 grid grid-cols-[auto_1fr] gap-x-10 gap-y-2 text-sm">
        {#each Object.entries(p.tags) as [k, v] (k)}
          <dt class="text-tx3">{k}</dt>
          <dd class="m-0 font-mono text-tx2">{v}</dd>
        {/each}
      </dl>
    {/if}
    <div
      class="mt-10 border-t border-line pt-8 font-mono text-2xs {p.provenance === 'curated'
        ? 'text-amber'
        : 'text-tx3'}"
    >
      출처 · {PROVENANCE_LABELS[p.provenance] ?? p.provenance}
    </div>
    <div class="mt-8 flex gap-4">
      <Btn onclick={() => (app.fromId = p.id)}>출발지로</Btn>
      <Btn onclick={() => (app.toId = p.id)}>도착지로</Btn>
    </div>
  </Pane>
{/if}
