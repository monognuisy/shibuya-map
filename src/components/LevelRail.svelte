<script lang="ts">
  import { LEVELS } from '~/lib/levels';
  import type { AppState } from '~/lib/store.svelte';

  /**
   * `collapsible` 은 셸이 정한다. 패널은 자기가 컴팩트인지 묻지 않는다 —
   * 접힘은 배치의 문제이고, 배치를 아는 것은 셸뿐이다.
   */
  let { app, collapsible = false }: { app: AppState; collapsible?: boolean } = $props();

  const present = $derived(new Set(app.levels));

  /** 접을 수 있을 때만 의미가 있다. 데스크톱에서는 늘 펼친 채다. */
  let open = $state(false);
  const shown = $derived(!collapsible || open);

  const currentCode = $derived(
    app.activeLevel === null
      ? 'ALL'
      : (LEVELS.find((l) => l.id === app.activeLevel)?.code ?? 'ALL'),
  );

  /** 고르면 접는다. 층을 바꾼 결과를 보려면 지도가 보여야 한다. */
  function choose(id: number | null) {
    app.activeLevel = id;
    if (collapsible) open = false;
  }
</script>

{#snippet row(id: number | null, code: string, label: string)}
  {@const active = app.activeLevel === id}
  <button
    class="flex w-full cursor-pointer items-center gap-8 rounded-3 border-0 px-8 py-3 text-left
           font-mono text-sm transition duration-150
           compact:min-h-40 compact:justify-center compact:gap-0 compact:px-0 compact:text-base
           {active
      ? 'bg-amber font-semibold text-bg'
      : 'bg-transparent text-tx3 hover:bg-panel2 hover:text-tx2'}"
    onclick={() => choose(id !== null && active ? null : id)}
  >
    <span class="w-28 font-medium">{code}</span>
    {#if !collapsible}
      <span class="font-sans text-xs compact:text-sm {active ? 'opacity-85' : 'opacity-70'}"
        >{label}</span
      >
    {/if}
  </button>
{/snippet}

<nav
  class="flex flex-col gap-1 rounded-6 border border-line bg-panel/94 p-6 backdrop-blur-12"
  aria-label="층 선택"
>
  {#if collapsible}
    <!-- 접었을 때는 지금 보고 있는 층을, 펼쳤을 때는 닫기를 보여준다 -->
    <button
      class="flex min-h-40 w-full cursor-pointer items-center justify-center rounded-3 border-0
             bg-panel2 font-mono text-base font-medium text-tx2"
      onclick={() => (open = !open)}
      aria-expanded={open}
      aria-label={open ? '층 목록 접기' : '층 목록 펼치기'}
    >
      {open ? '✕' : currentCode}
    </button>
  {/if}

  {#if shown}
    <div class="flex flex-col gap-1 compact:max-h-rail compact:overflow-y-auto">
      {@render row(null, 'ALL', '전체 층')}
      {#each LEVELS as lv (lv.id)}
        {#if present.has(lv.id)}
          {@render row(lv.id, lv.code, lv.label)}
        {/if}
      {/each}
    </div>
  {/if}
</nav>
