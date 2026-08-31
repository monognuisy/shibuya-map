<script module lang="ts">
  /* 컴포넌트에서 타입을 내보내려면 module 문맥이어야 한다 */
  export type Snap = 'peek' | 'half' | 'full';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    snap = $bindable<Snap>('peek'),
    children,
  }: { snap?: Snap; children: Snippet } = $props();

  /** 스냅 단계별로 화면 아래에 감춰 두는 높이(px). 0 이면 다 열린 것. */
  const HIDDEN: Record<Snap, (h: number) => number> = {
    full: () => 0,
    half: (h) => h - Math.round(innerHeight * 0.45),
    peek: (h) => h - 96,
  };

  let el: HTMLElement;
  /** 끄는 중에만 값이 있다. 손을 떼면 null 로 돌아가 스냅으로 넘긴다. */
  let dragY = $state<number | null>(null);
  let startY = 0;
  let startHidden = 0;

  const hiddenFor = (s: Snap) => (el ? HIDDEN[s](el.offsetHeight) : 0);

  function down(e: PointerEvent) {
    startY = e.clientY;
    startHidden = hiddenFor(snap);
    dragY = startHidden;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function move(e: PointerEvent) {
    if (dragY === null) return;
    const max = hiddenFor('peek');
    dragY = Math.min(max, Math.max(0, startHidden + (e.clientY - startY)));
  }

  function up() {
    if (dragY === null) return;
    // 끌어다 놓은 자리에서 가장 가까운 단계로 붙인다
    const snaps: Snap[] = ['full', 'half', 'peek'];
    let best = snaps[0]!;
    let bestD = Infinity;
    for (const s of snaps) {
      const d = Math.abs(hiddenFor(s) - dragY);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    snap = best;
    dragY = null;
  }

  const offset = $derived(dragY ?? hiddenFor(snap));
</script>

<section
  bind:this={el}
  class="fixed inset-x-0 bottom-0 z-20 flex flex-col rounded-t-12 border-t border-line
         bg-panel/96 backdrop-blur-12"
  style="height: calc(100dvh - var(--topbar));
         transform: translateY({offset}px);
         transition: {dragY === null ? 'transform 0.22s ease-out' : 'none'};
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
