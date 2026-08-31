<script module lang="ts">
  /* 컴포넌트에서 타입을 내보내려면 module 문맥이어야 한다 */
  export type Snap = 'peek' | 'half' | 'full';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  let { snap = $bindable<Snap>('peek'), children }: { snap?: Snap; children: Snippet } = $props();

  let el: HTMLElement;

  /**
   * 시트 높이와 화면 높이를 재어 둔다. 끄는 동안 offsetHeight 를 읽으면
   * 프레임마다 강제 리플로가 걸려 손가락을 따라오지 못한다.
   */
  let sheetH = $state(0);
  let viewH = $state(0);

  $effect(() => {
    const measure = () => {
      sheetH = el?.offsetHeight ?? 0;
      viewH = innerHeight;
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (el) ro.observe(el);
    addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      removeEventListener('resize', measure);
    };
  });

  /** 스냅 단계별로 화면 아래에 감춰 두는 높이(px). 0 이면 다 열린 것. */
  const hiddenFor = (s: Snap) =>
    s === 'full' ? 0 : s === 'half' ? sheetH - Math.round(viewH * 0.45) : sheetH - 96;

  /** 끄는 중에만 값이 있다. 손을 떼면 null 로 돌아가 스냅으로 넘긴다. */
  let dragY = $state<number | null>(null);
  let startY = 0;
  let startHidden = 0;

  /**
   * 터치는 프레임보다 촘촘히 들어온다(120Hz 기기도 있다). 들어오는 대로
   * 상태를 바꾸면 그릴 수 있는 것보다 많이 그리게 되므로 프레임에 맞춰 접는다.
   */
  let pending = 0;
  let raf = 0;

  function apply() {
    raf = 0;
    if (dragY === null) return;
    const max = hiddenFor('peek');
    dragY = Math.min(max, Math.max(0, startHidden + (pending - startY)));
  }

  function down(e: PointerEvent) {
    startY = e.clientY;
    startHidden = hiddenFor(snap);
    dragY = startHidden;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function move(e: PointerEvent) {
    if (dragY === null) return;
    pending = e.clientY;
    if (!raf) raf = requestAnimationFrame(apply);
  }

  function up() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    if (dragY === null) return;
    // 끌어다 놓은 자리에서 가장 가까운 단계로 붙인다
    let best: Snap = 'full';
    let bestD = Infinity;
    for (const s of ['full', 'half', 'peek'] as Snap[]) {
      const d = Math.abs(hiddenFor(s) - dragY);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    snap = best;
    dragY = null;
  }

  const dragging = $derived(dragY !== null);
  const offset = $derived(dragY ?? hiddenFor(snap));
</script>

<!--
  배경을 불투명하게 둔다. 화면 높이만 한 면에 backdrop-filter 를 걸어 두면
  시트가 움직이는 동안 매 프레임 그 뒤를 다시 흐려야 해서 폰에서 눈에 띄게 끊긴다.
-->
<section
  bind:this={el}
  class="fixed inset-x-0 bottom-0 z-20 flex flex-col rounded-t-12 border-t border-line bg-panel"
  style="height: calc(100dvh - var(--topbar));
         transform: translateY({offset}px);
         transition: {dragging ? 'none' : 'transform 0.22s ease-out'};
         will-change: {dragging ? 'transform' : 'auto'};
         padding-bottom: env(safe-area-inset-bottom);"
>
  <!-- 손잡이. 여기만 끌 수 있게 해서 시트 안의 스크롤과 다투지 않는다. -->
  <div
    class="flex h-24 shrink-0 cursor-grab touch-none items-center justify-center"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
  >
    <div class="h-4 w-40 rounded-2 bg-line2"></div>
  </div>
  <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-14 pb-14">
    {@render children()}
  </div>
</section>
