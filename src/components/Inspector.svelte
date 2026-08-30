<script lang="ts">
  import { levelCode } from '~/lib/levels';
  import {
    KIND_LABELS,
    OPERATOR_COLORS,
    OPERATOR_LABELS,
    PROVENANCE_LABELS,
  } from '~/lib/palette';
  import type { AppState } from '~/lib/store.svelte';

  let { app }: { app: AppState } = $props();
  const p = $derived(app.selected);
</script>

{#if p}
  <aside class="pane inspect">
    <button class="close" onclick={() => (app.selectedId = null)} aria-label="닫기">×</button>
    <div class="head">
      <span
        class="dot"
        style="background:{OPERATOR_COLORS[p.operator as keyof typeof OPERATOR_COLORS]}"
      ></span>
      {#if p.kind !== 'building'}
        <span class="op">{OPERATOR_LABELS[p.operator as keyof typeof OPERATOR_LABELS]}</span>
      {/if}
      <span class="lv">{levelCode(p.level)}</span>
      <span class="kind">{KIND_LABELS[p.kind] ?? p.kind}</span>
      {#if p.planned}<span class="plan">공사중</span>{/if}
    </div>
    <h2>{p.name}</h2>
    {#if p.nameJa}<div class="ja">{p.nameJa}</div>{/if}
    {#if p.desc}<p class="desc">{p.desc}</p>{/if}
    {#if p.connectLevels?.length}
      <div class="conn">
        <span class="clabel">역·통로와 이어지는 층</span>
        {#each [...p.connectLevels].sort((a, b) => b - a) as lv (lv)}
          <span class="lvchip">{levelCode(lv)}</span>
        {/each}
      </div>
    {/if}
    {#if p.tags}
      <dl class="tags">
        {#each Object.entries(p.tags) as [k, v] (k)}
          <dt>{k}</dt>
          <dd>{v}</dd>
        {/each}
      </dl>
    {/if}
    <div class="prov" class:warn={p.provenance === 'curated'}>
      출처 · {PROVENANCE_LABELS[p.provenance] ?? p.provenance}
    </div>
    <div class="acts">
      <button class="btn" onclick={() => (app.fromId = p.id)}>출발지로</button>
      <button class="btn" onclick={() => (app.toId = p.id)}>도착지로</button>
    </div>
  </aside>
{/if}

<style>
  .inspect {
    position: fixed;
    bottom: 14px;
    right: 14px;
    width: 280px;
    padding: 12px 13px;
  }
  .close {
    position: absolute;
    top: 6px;
    right: 8px;
    background: none;
    border: 0;
    color: var(--tx3);
    font-size: 15px;
    cursor: pointer;
    line-height: 1;
  }
  .close:hover {
    color: var(--tx);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 9px;
    font-family: var(--mono);
    letter-spacing: 0.06em;
    color: var(--tx3);
    text-transform: uppercase;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }
  .lv,
  .kind,
  .plan {
    padding: 1px 5px;
    border-radius: 3px;
    border: 1px solid var(--line2);
  }
  .plan {
    color: var(--amber);
    border-color: var(--amber-dim);
  }
  h2 {
    font-size: 14px;
    font-weight: 500;
    margin: 7px 0 1px;
    color: var(--tx);
  }
  .ja {
    font-size: 10px;
    color: var(--tx3);
  }
  .desc {
    margin-top: 8px;
    font-size: 11px;
    line-height: 1.65;
    color: var(--tx2);
  }
  .conn {
    margin-top: 9px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
  }
  .clabel {
    font-size: 9.5px;
    color: var(--tx3);
    margin-right: 2px;
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
  .tags {
    margin: 9px 0 0;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 10px;
    font-size: 10px;
  }
  dt {
    color: var(--tx3);
  }
  dd {
    margin: 0;
    color: var(--tx2);
    font-family: var(--mono);
  }
  .prov.warn {
    color: var(--amber);
  }
  .prov {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid var(--line);
    font-size: 9px;
    color: var(--tx3);
  }
  .acts {
    display: flex;
    gap: 5px;
    margin-top: 8px;
  }
  @media (max-width: 900px) {
    .inspect {
      position: static;
      width: auto;
      margin: 0 14px 14px;
    }
  }
</style>
