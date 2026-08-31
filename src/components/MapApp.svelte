<script lang="ts">
  import { onMount } from 'svelte';

  import { loadMap } from '~/lib/mapdoc';
  import { MapScene, type LabelBox } from '~/lib/scene';
  import { AppState } from '~/lib/store.svelte';
  import { applyUrl, toSearch } from '~/lib/urlstate';
  import { OPERATOR_COLORS } from '~/lib/palette';

  import Attribution from './Attribution.svelte';
  import NavBar from './NavBar.svelte';
  import ControlPanel from './ControlPanel.svelte';
  import Inspector from './Inspector.svelte';
  import LevelRail from './LevelRail.svelte';
  import Pane from './Pane.svelte';
  import RoutePanel from './RoutePanel.svelte';

  let { dataUrl }: { dataUrl: string } = $props();

  const app = new AppState();
  let stage: HTMLDivElement;
  let labelHost: HTMLDivElement;
  let scene: MapScene | null = null;
  let labelEls = new Map<string, HTMLElement>();


  onMount(() => {
    let raf = 0;
    let cancelled = false;

    loadMap(dataUrl)
      .then((doc) => {
        if (cancelled) return;
        app.doc = doc;
        applyUrl(app, location.search);
        scene = new MapScene(stage, doc, app.view, (id) => {
          app.selectedId = id;
        });
        buildLabels(scene.labels);
        let last = performance.now();
        const tick = (now: number) => {
          raf = requestAnimationFrame(tick);
          const dt = Math.min(0.1, (now - last) / 1000);
          last = now;
          if (!scene) return;
          positionLabels(scene.labels);

          // 경로 따라가기 재생
          if (app.navPlaying && app.navT !== null) {
            const next = app.navT + NAV_BASE_SPEED * app.navSpeed * dt;
            if (next >= app.routeTotal) {
              app.navT = app.routeTotal;
              app.navPlaying = false;
            } else {
              app.navT = next;
            }
          }
        };
        raf = requestAnimationFrame(tick);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        app.error = /WebGL/i.test(msg)
          ? 'WebGL 을 사용할 수 없습니다. 브라우저의 하드웨어 가속을 켜고 다시 열어 주세요.'
          : msg;
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      scene?.dispose();
      scene = null;
    };
  });

  /**
   * 경로를 따라가는 속도(씬 단위/초).
   * 실제 보행 속도(1.25 m/s)로는 500m 경로를 보는 데 7분이 걸려 쓸 수 없다.
   * 1× 에서 전체 경로를 30초 안팎에 훑도록 잡았다.
   */
  const NAV_BASE_SPEED = 18;

  /**
   * 상태를 씬에 반영하고, 그 직후에 경로 길이를 잰다.
   * `scene.routeLength` 는 반응형이 아니라서 setState 로 경로를 다시 만든 뒤
   * 같은 자리에서 읽지 않으면 0 인 채로 굳는다.
   */
  $effect(() => {
    const v = app.view;
    const it = app.itinerary;
    if (!scene) return;
    scene.setState(v);
    if (it) {
      app.routeTotal = scene.routeLength;
      app.legOffsets = it.legs.map((l) => scene!.lengthAtIndex(l.endIndex));
    } else {
      app.routeTotal = 0;
      app.legOffsets = [];
    }
  });

  /*
   * 따라가기 카메라.
   *
   * `scene?.setFollow(app.navT)` 로 쓰면 안 된다. 씬이 아직 null 인 첫 실행에서
   * 옵셔널 체이닝이 먼저 끊어져 `app.navT` 를 읽지 못하고, 그러면 이 이펙트는
   * 의존성을 하나도 등록하지 못해 두 번 다시 실행되지 않는다.
   */
  $effect(() => {
    const t = app.navT;
    scene?.setFollow(t);
  });

  // 따라가기에 들어가면 시점을 가깝게 낮춘다
  let wasNav = false;
  $effect(() => {
    const on = app.navOn;
    if (on !== wasNav) {
      wasNav = on;
      if (on) {
        scene?.setFollow(app.navT);
        scene?.enterFollowView();
      }
      else scene?.resetView();
    }
  });

  // 공유 가능한 링크가 되도록 주소창을 상태와 맞춘다 (히스토리는 남기지 않는다)
  $effect(() => {
    if (!app.doc) return;
    const qs = toSearch(app);
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  });

  $effect(() => {
    const id = app.selectedId;
    if (id) scene?.focus(id);
  });

  function onKey(e: KeyboardEvent) {
    if (!app.navOn) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === ' ') {
      e.preventDefault();
      app.navPlaying = !app.navPlaying;
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      app.gotoLeg(app.navLegIndex + (e.key === 'ArrowRight' ? 1 : -1));
    } else if (e.key === 'Escape') {
      app.navT = null;
    }
  }

  function buildLabels(labels: LabelBox[]) {
    labelEls = new Map();
    for (const l of labels) {
      const el = document.createElement('button');
      el.className = `lb k-${l.kind}`;
      el.textContent = l.text;
      el.style.setProperty(
        '--op',
        OPERATOR_COLORS[l.operator as keyof typeof OPERATOR_COLORS] ?? '#8A96A6',
      );
      el.addEventListener('click', () => (app.selectedId = l.id));
      labelHost.appendChild(el);
      labelEls.set(l.id, el);
    }
  }

  /**
   * 라벨은 매 프레임 위치가 바뀌므로 Svelte 반응성을 태우지 않고 DOM 을 직접 만진다.
   * 겹치는 라벨은 화면 격자에 한 개만 남겨 밀도를 줄인다.
   */
  /** 자리 다툼이 붙었을 때 어떤 라벨을 남길지. 작을수록 우선. */
  const LABEL_RANK: Record<string, number> = {
    platform: 0,
    gate: 1,
    plaza: 2,
    passage: 3,
    building: 4,
    entrance: 5,
    vertical: 6,
  };

  function positionLabels(labels: LabelBox[]) {
    const occupied = new Set<string>();
    const sorted = [...labels].sort(
      (a, b) =>
        (LABEL_RANK[a.kind] ?? 9) - (LABEL_RANK[b.kind] ?? 9) || a.screen.depth - b.screen.depth,
    );
    for (const l of sorted) {
      const el = labelEls.get(l.id);
      if (!el) continue;
      const s = l.screen;
      const onScreen =
        s.visible &&
        s.depth < 1 &&
        s.x > -60 &&
        s.y > -20 &&
        s.x < labelHost.clientWidth + 60 &&
        s.y < labelHost.clientHeight + 20;
      const cell = `${Math.round(s.x / 132)}:${Math.round(s.y / 26)}`;
      const selected = app.selectedId === l.id;
      const show = onScreen && (selected || !occupied.has(cell));
      if (show && !selected) occupied.add(cell);
      el.classList.toggle('hide', !show);
      el.classList.toggle('sel', selected);
      el.classList.toggle('plan', l.planned);
      if (show) el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)`;
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="fixed inset-0">
  <div class="absolute inset-0" bind:this={stage}></div>
  <div class="pointer-events-none absolute inset-0 overflow-hidden" bind:this={labelHost}></div>

  <header
    class="fixed top-14 left-14 z-10 max-w-288 rounded-6 border border-line bg-panel/94 px-14 py-12
           backdrop-blur-12"
  >
    <h1 class="m-0 font-mono text-base font-semibold tracking-title text-tx">SHIBUYA STATION</h1>
    <p class="mt-3 text-sm text-tx3">시부야역 입체 보행 네트워크</p>
    {#if app.doc}
      <p class="mt-7 font-mono text-2xs tracking-4 text-amber">
        공식 보행망 {app.doc.meta.counts.mlitLinks} 링크 · OSM {app.doc.meta.counts.osmSegments} 구간
        · 역 구내 {app.doc.meta.counts.curatedPlaces} 지점
      </p>
    {/if}
  </header>

  {#if app.error}
    <Pane class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-18 py-14 text-11 text-tx2">
      지도를 표시할 수 없습니다. <code class="mt-6 block text-10 text-tx3">{app.error}</code>
    </Pane>
  {:else if !app.doc}
    <Pane class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-18 py-14 text-11 text-tx2">
      데이터 로딩 중…
    </Pane>
  {:else}
    {#if app.navOn}
      <NavBar {app} />
    {/if}
    <LevelRail {app} />
    <ControlPanel {app} onReset={() => scene?.resetView()} />
    <RoutePanel {app} />
    <Inspector {app} />
    <Attribution {app} />
  {/if}
</div>
