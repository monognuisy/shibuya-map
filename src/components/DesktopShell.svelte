<script lang="ts">
  import type { AppState } from '~/lib/store.svelte';
  import Attribution from './Attribution.svelte';
  import ControlPanel from './ControlPanel.svelte';
  import Inspector from './Inspector.svelte';
  import LevelRail from './LevelRail.svelte';
  import NavBar from './NavBar.svelte';
  import RoutePanel from './RoutePanel.svelte';

  let { app, onReset }: { app: AppState; onReset: () => void } = $props();
</script>

<!-- 배치는 여기에만 있다. 패널들은 자기 위치를 모른다. -->
{#if app.navOn}
  <!-- bottom-42: 아래 가운데의 출처 버튼과 겹치지 않게 한 칸 올린다 -->
  <div class="fixed bottom-42 left-1/2 z-10 -translate-x-1/2">
    <NavBar {app} />
  </div>
{/if}
<div class="fixed top-118 left-14 z-10"><LevelRail {app} /></div>
<div class="fixed bottom-14 left-14 z-10"><ControlPanel {app} {onReset} /></div>
<div class="fixed top-14 right-14 z-10 max-h-route overflow-y-auto">
  <RoutePanel {app} />
</div>
<div class="fixed right-14 bottom-14 z-10"><Inspector {app} /></div>
<div class="fixed bottom-14 left-1/2 z-10 -translate-x-1/2"><Attribution {app} /></div>
