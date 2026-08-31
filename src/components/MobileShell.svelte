<script lang="ts">
  import type { AppState } from '~/lib/store.svelte';
  import Attribution from './Attribution.svelte';
  import BottomSheet, { type Snap } from './BottomSheet.svelte';
  import ControlPanel from './ControlPanel.svelte';
  import Inspector from './Inspector.svelte';
  import LevelRail from './LevelRail.svelte';
  import NavBar from './NavBar.svelte';
  import RoutePanel from './RoutePanel.svelte';

  let { app, onReset }: { app: AppState; onReset: () => void } = $props();

  type Tab = 'route' | 'info' | 'settings';
  const TABS: { key: Tab; label: string }[] = [
    { key: 'route', label: '경로' },
    { key: 'info', label: '정보' },
    { key: 'settings', label: '설정' },
  ];

  /** 사용자가 직접 고른 탭. 없으면 상태를 따라간다. */
  let picked = $state<Tab | null>(null);
  const auto = $derived<Tab>(app.route ? 'route' : app.selectedId ? 'info' : 'settings');
  const tab = $derived(picked ?? auto);

  let snap = $state<Snap>('peek');

  /** 지도에서 지점을 고르면 시트를 절반까지 올린다. 접힌 채면 왜 골랐는지 알 수 없다. */
  let lastSelected: string | null = null;
  $effect(() => {
    if (app.selectedId && app.selectedId !== lastSelected && snap === 'peek') snap = 'half';
    lastSelected = app.selectedId;
  });
</script>

<header
  class="fixed inset-x-0 top-0 z-30 flex min-h-56 items-center justify-between
         border-b border-line bg-bg/92 px-14 backdrop-blur-12"
  style="padding-top: env(safe-area-inset-top);"
>
  <div>
    <h1 class="m-0 font-mono text-base font-semibold tracking-title text-tx">
      SHIBUYA STATION
    </h1>
    <p class="m-0 text-2xs text-tx3">시부야역 입체 보행 네트워크</p>
  </div>
  <button
    class="min-h-40 min-w-40 rounded-4 border border-line2 bg-panel2 text-sm text-tx2"
    onclick={onReset}
    aria-label="시점 초기화">⟳</button
  >
</header>

<div class="fixed top-72 right-8 z-10"><LevelRail {app} /></div>

{#if app.navOn && snap !== 'full'}
  <div class="fixed inset-x-8 bottom-104 z-20"><NavBar {app} /></div>
{/if}

<BottomSheet bind:snap>
  <div class="mb-12 flex gap-2 rounded-6 border border-line bg-panel2 p-2">
    {#each TABS as t (t.key)}
      <button
        class="min-h-40 flex-1 cursor-pointer rounded-4 text-sm
               {tab === t.key ? 'bg-amber font-medium text-bg' : 'text-tx2'}"
        onclick={() => (picked = t.key)}>{t.label}</button
      >
    {/each}
  </div>

  {#if tab === 'route'}
    <RoutePanel {app} />
  {:else if tab === 'info'}
    <Inspector {app} />
  {:else}
    <ControlPanel {app} {onReset} />
    <div class="mt-14"><Attribution {app} /></div>
  {/if}
</BottomSheet>
