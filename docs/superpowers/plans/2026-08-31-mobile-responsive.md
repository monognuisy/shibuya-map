# 모바일 반응형 · Tailwind v4 이행 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시부야역 3D 지도를 폰에서 1급으로 쓸 수 있게 만든다 — 터치 제스처를 넣고, 배치를 셸 둘로 나누고, 스타일을 Tailwind v4 로 옮긴다.

**Architecture:** 스타일 이행을 먼저 끝내고(Phase A) 그 위에 제스처(Phase B)와 셸(Phase C)을 올린다. 두 체계가 오래 공존하면 문제의 원인을 가릴 수 없다. 배치 책임은 `DesktopShell`/`MobileShell` 두 파일에 모으고, 패널 여섯 개는 내용만 갖는다. 제스처 수학은 three.js 와 분리된 순수 함수로 두어 vitest 로 검증한다.

**Tech Stack:** Astro 5.18.2 · Svelte 5.39 · three.js 0.180 · Tailwind CSS 4.3.3 (`@tailwindcss/vite`) · vitest 3.2

**Spec:** `docs/superpowers/specs/2026-08-31-mobile-responsive-design.md`

## Global Constraints

- Tailwind 는 **v4** 이며 `@tailwindcss/vite` 플러그인으로 붙인다. `@astrojs/tailwind` 는 v4 에서 폐지됐으므로 설치하지 않는다.
- `@apply` 를 쓰지 않는다. 반복되는 껍데기는 Svelte 컴포넌트로 승격한다.
- Tailwind 기본 브레이크포인트(`sm:` `md:` `lg:`)를 쓰지 않는다. 컴팩트 여부는 `compact:` 커스텀 variant 하나로만 표현한다.
- 색·크기·모서리·흐림·자간은 `@theme` 에 등록된 이름을, 여백은 `--spacing: 1px` 기반 숫자(`p-12` = 12px)를 쓴다. z-index 는 Tailwind 기본 눈금 `z-10` `z-20` `z-30` 만 쓴다.
- 임의값(`text-[10.5px]`)을 쓰지 않는다. `@theme` 에 등록된 이름만 쓴다. 등록되지 않은 값이 필요하면 먼저 `@theme` 에 추가한다.
- 컴팩트 판정 조건은 `(max-width: 820px), (max-height: 520px)` 이며 이 문자열은 `MapApp.svelte` 한 곳에만 존재한다.
- 마우스 조작감은 바뀌지 않는다 — 좌드래그 회전, 우드래그·shift 팬, 휠 줌.
- 각 태스크 끝에서 `pnpm check` 가 **0 errors** 여야 하고 `pnpm test` 가 통과해야 한다.
- 커밋 메시지는 저장소 관례를 따른다: `feat(scope):` / `fix(scope):` / `refactor(scope):` + 한국어 본문.

## File Structure

| 파일 | 책임 |
| --- | --- |
| `src/styles/global.css` | Tailwind 임포트, `@theme` 토큰, `compact` variant, JS 가 조립하는 라벨 클래스 |
| `src/lib/gesture.ts` | 두 포인터 → 배율·회전·중점 이동. three.js 를 모른다 |
| `src/lib/gesture.test.ts` | 위 함수 검증 |
| `src/lib/scene.ts` | 포인터 이벤트를 카메라 변화로 옮긴다 |
| `src/components/MapApp.svelte` | 데이터 로딩, 컴팩트 판정, 셸 선택, 3D 라벨 |
| `src/components/DesktopShell.svelte` | 데스크톱 배치만 |
| `src/components/MobileShell.svelte` | 상단바·시트·레벨 스트립 배치만 |
| `src/components/BottomSheet.svelte` | 스냅 3단계 시트. 내용을 모른다 |
| `src/components/*.svelte` (패널 6개) | 내용과 자기 내부 스타일만. 위치를 모른다 |

---

## Phase A — Tailwind v4 이행

### Task 1: Tailwind 설치와 토큰 이전

**Files:**
- Modify: `package.json`
- Modify: `astro.config.mjs`
- Modify: `src/styles/global.css`

**Interfaces:**
- Produces: `@theme` 토큰 이름 — 색 `bg` `panel` `panel2` `line` `line2` `tx` `tx2` `tx3` `amber` `amber-dim`, 폰트 `mono` `sans`, 크기 `text-2xs`(9px) `text-xs`(9.5px) `text-sm`(10.5px) `text-base`(12px) `text-lg`(15px) `text-xl`(19px), 간격 단위 `--spacing: 1px`, variant `compact:`

- [ ] **Step 1: 의존성 설치**

```bash
pnpm add -D tailwindcss@4.3.3 @tailwindcss/vite@4.3.3
```

- [ ] **Step 2: Vite 플러그인 등록**

`astro.config.mjs` 를 아래로 바꾼다.

```js
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  integrations: [svelte()],
  site: 'https://monognuisy.github.io',
  base: '/shibuya-map',
  build: { assets: 'assets' },
  vite: { plugins: [tailwind()] },
});
```

- [ ] **Step 3: `global.css` 를 Tailwind 로 바꾼다**

파일 전체를 아래로 교체한다. `:root` 변수 선언은 `@theme` 이 대신하므로 지운다.

```css
@import 'tailwindcss';

/*
 * 컴팩트(폰) 변형. 셸이 감싸는 요소에 data-compact 를 걸면 그 안쪽 전체가 반응한다.
 * 판정이 셸 한 곳에만 있게 하려고 Tailwind 기본 브레이크포인트를 쓰지 않는다.
 */
@custom-variant compact (&:where([data-compact], [data-compact] *));

@theme {
  --color-bg: #0e1218;
  --color-panel: #161d26;
  --color-panel2: #1d2530;
  --color-line: #28313e;
  --color-line2: #36424f;
  --color-tx: #e6ebf2;
  --color-tx2: #94a1b3;
  --color-tx3: #5f6c7d;
  --color-amber: #e8b23a;
  --color-amber-dim: #7a5f1e;

  --font-mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  --font-sans: 'IBM Plex Sans KR', system-ui, -apple-system, sans-serif;

  /* 계기판 같은 촘촘한 UI 라 기본 스케일 대신 이 프로젝트의 눈금을 쓴다 */
  --text-2xs: 9px;
  --text-xs: 9.5px;
  --text-sm: 10.5px;
  --text-base: 12px;
  --text-lg: 15px;
  --text-xl: 19px;

  /* p-6 이 6px 가 된다. 값이 곧 픽셀이라 이행 중 눈으로 대조하기 쉽다. */
  --spacing: 1px;

  /* 모서리·흐림·자간은 spacing 과 다른 눈금이라 따로 등록해야 유틸리티가 생긴다 */
  --radius-2: 2px;
  --radius-3: 3px;
  --radius-4: 4px;
  --radius-6: 6px;
  --radius-12: 12px;
  --blur-12: 12px;
  --tracking-title: 0.14em;
}

/*
 * 터치 최소 타깃은 40px 다. --spacing 이 1px 이므로 min-h-40 이 곧 40px 이라
 * 별도 토큰을 두지 않는다.
 */

@layer base {
  html,
  body {
    height: 100%;
    margin: 0;
  }
  body {
    background: var(--color-bg);
    color: var(--color-tx);
    font-family: var(--font-sans);
    font-weight: 300;
    overflow: hidden;
    overscroll-behavior: none;
    -webkit-font-smoothing: antialiased;
    color-scheme: dark;
  }
  canvas {
    display: block;
    cursor: grab;
    touch-action: none;
  }
  canvas.dragging {
    cursor: grabbing;
  }
}

/*
 * 3D 라벨. MapApp 이 el.className = `lb k-${kind}` 로 조립하므로 Tailwind
 * 스캐너가 읽지 못한다. 유틸리티로 옮기지 않고 여기 손으로 둔다.
 */
@layer components {
  .lb {
    position: absolute;
    top: 0;
    left: 0;
    font-family: var(--font-mono), var(--font-sans);
    font-size: var(--text-sm);
    letter-spacing: 0.01em;
    white-space: nowrap;
    padding: 2px 6px;
    border-radius: 3px;
    background: color-mix(in srgb, var(--color-bg) 82%, transparent);
    border: 1px solid var(--color-line);
    border-left: 2px solid var(--op, var(--color-line2));
    color: var(--color-tx2);
    pointer-events: auto;
    cursor: pointer;
    transition:
      opacity 0.18s,
      color 0.18s,
      border-color 0.18s;
  }
  .lb:hover {
    color: var(--color-tx);
    border-color: var(--color-line2);
    border-left-color: var(--op);
  }
  .lb.sel {
    color: var(--color-bg);
    background: var(--color-amber);
    border-color: var(--color-amber);
    font-weight: 600;
  }
  .lb.plan {
    border-style: dashed;
    color: var(--color-tx3);
  }
  .lb.hide {
    opacity: 0;
    pointer-events: none;
  }
  /* 건물·출입구는 배경 맥락이라 한 단계 눌러 둔다 */
  .lb.k-building,
  .lb.k-entrance {
    font-size: var(--text-xs);
    color: var(--color-tx3);
    background: color-mix(in srgb, var(--color-bg) 70%, transparent);
  }
  .lb.k-building:hover,
  .lb.k-entrance:hover {
    color: var(--color-tx2);
  }
  .lb.k-platform {
    font-weight: 500;
  }
}
```

이 교체로 `.pane` `.tog` `.btn` 이 사라진다. 다음 단계에서 컴포넌트로 대신한다.

- [ ] **Step 4: 사라진 공용 클래스를 컴포넌트로 만든다**

`src/components/Pane.svelte` 를 만든다. `.pane` 을 쓰던 모든 자리가 이것을 쓴다.

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  let { class: klass = '', children }: { class?: string; children: Snippet } = $props();
</script>

<div
  class="z-10 rounded-6 border border-line bg-panel/94 backdrop-blur-12 {klass}"
>
  {@render children()}
</div>
```

`src/components/Btn.svelte` 를 만든다. `.btn` 을 쓰던 자리가 이것을 쓴다.

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    class: klass = '',
    children,
    ...rest
  }: { class?: string; children: Snippet; [k: string]: unknown } = $props();
</script>

<button
  class="cursor-pointer rounded-4 border border-line2 bg-panel2 px-10 py-5
         font-sans text-sm text-tx2 transition duration-150
         hover:border-amber-dim hover:text-tx
         compact:min-h-40 compact:px-12 compact:py-8 compact:text-base {klass}"
  {...rest}
>
  {@render children()}
</button>
```

`.tog` 는 `ControlPanel` 에서만 쓰이므로 Task 3 에서 그 파일 안에서 처리한다.

- [ ] **Step 5: 빌드가 서는지 확인**

```bash
pnpm check && pnpm build
```

기대: 0 errors. 이 시점에는 컴포넌트들이 아직 옛 `<style>` 을 갖고 있어 화면이 부분적으로 깨져 보인다. 정상이다 — `.pane` `.btn` `.tog` 가 사라졌기 때문이며 Task 2–5 에서 복구된다.

- [ ] **Step 6: 커밋**

```bash
git add package.json pnpm-lock.yaml astro.config.mjs src/styles/global.css src/components/Pane.svelte src/components/Btn.svelte
git commit -m "$(cat <<'EOF'
feat(style): Tailwind v4 도입

토큰을 @theme 으로 옮긴다. v4 의 @theme 은 곧 CSS 변수를 만들므로
지금 구조와 개념이 같다. 간격 단위를 1px 로 두어 이행 중 값을 눈으로
대조할 수 있게 했다.

3D 라벨 클래스는 MapApp 이 문자열로 조립해 스캐너가 읽지 못하므로
@layer components 에 손으로 남긴다.
EOF
)"
```

---

### Task 2: 작은 컴포넌트 이행 — LevelRail · Attribution

**Files:**
- Modify: `src/components/LevelRail.svelte` (style 61줄 제거)
- Modify: `src/components/Attribution.svelte` (style 88줄 제거)

**Interfaces:**
- Consumes: Task 1 의 `@theme` 이름, `Pane.svelte`, `Btn.svelte`
- Produces: 없음 (두 파일 모두 잎 컴포넌트)

**이행 규칙 (Task 2–5 공통)**

1. `<style>` 블록을 통째로 지우고 같은 규칙을 마크업의 `class` 로 옮긴다.
2. 값 대응은 1:1 로 한다. `padding: 11px 13px` → `px-13 py-11`. 이번 단계에서 값을 다듬지 않는다 — 다듬기는 Task 5 에서 한 번에 한다. 그래야 "내가 깨뜨렸나"와 "내가 바꿨나"를 구분할 수 있다.
3. 색은 이름으로. `color: var(--tx3)` → `text-tx3`, `background: var(--panel2)` → `bg-panel2`.
4. `rgba(14, 18, 24, 0.82)` 같은 알파 색은 `bg-bg/82` 로.
5. `position: fixed` 와 `top/left/right/bottom` 은 **지우지 않고 그대로 유틸리티로 옮긴다.** 배치를 셸로 옮기는 것은 Task 9 다.
6. `@media (max-width: 900px)` 블록은 **전부 지운다.** 이 다섯 곳이 서로 맞지 않는 반쯤 된 모바일 대응이며 Phase C 가 대신한다.
7. JS 가 계산하는 값(`style="--c:{color}"`, `style="background:{row.color}"`)은 인라인 스타일로 남긴다. Tailwind 는 동적 값을 만들 수 없다.

- [ ] **Step 1: LevelRail 이행**

`src/components/LevelRail.svelte` 의 `<style>` 을 지우고 마크업에 클래스를 단다. 예를 들어 현재의

```css
.rail {
  position: fixed;
  top: 118px;
  left: 14px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
```

는 이렇게 된다.

```svelte
<div class="fixed top-118 left-14 flex flex-col gap-1 p-6">
```

`@media (max-width: 900px)` 블록(78–90줄)은 지운다.

- [ ] **Step 2: Attribution 이행**

같은 규칙으로 `src/components/Attribution.svelte` 의 `<style>` 88줄을 지운다. 바깥 `.pane` 자리는 `Pane.svelte` 로 바꾼다.

- [ ] **Step 3: 남은 style 이 없는지 확인**

```bash
grep -c "<style>" src/components/LevelRail.svelte src/components/Attribution.svelte
```

기대: 두 파일 모두 `0`.

- [ ] **Step 4: 빌드와 눈 확인**

```bash
pnpm check && pnpm build && pnpm dev
```

브라우저에서 확인: 레벨 레일이 좌측에 세로로 붙어 있고 버튼 간격이 이행 전과 같다. 하단 가운데 "데이터 출처 · 라이선스" 버튼을 눌러 패널이 열리고 링크 목록이 이행 전과 같다.

- [ ] **Step 5: 커밋**

```bash
git add src/components/LevelRail.svelte src/components/Attribution.svelte
git commit -m "refactor(style): 레벨 레일·출처 패널을 Tailwind 로"
```

---

### Task 3: ControlPanel · Inspector 이행

**Files:**
- Modify: `src/components/ControlPanel.svelte` (style 92줄 제거)
- Modify: `src/components/Inspector.svelte` (style 124줄 제거)

**Interfaces:**
- Consumes: Task 1 의 `@theme` 이름, `Pane.svelte`, `Btn.svelte`
- Produces: 없음

- [ ] **Step 1: `.tog` 를 ControlPanel 안으로 옮긴다**

`global.css` 에서 사라진 `.tog` 는 `ControlPanel` 의 레이어 체크박스에서만 쓰인다. 마크업에 직접 단다.

```svelte
<label
  class="flex cursor-pointer items-center gap-6 py-2 text-sm text-tx2 select-none
         compact:min-h-40 compact:gap-8 compact:text-base"
>
  <input
    type="checkbox"
    class="h-12 w-12 cursor-pointer accent-amber compact:h-16 compact:w-16"
    checked={app.layers[row.key]}
    onchange={(e) => (app.layers = { ...app.layers, [row.key]: e.currentTarget.checked })}
  />
  <span class="h-8 w-8 rounded-2" style="background:{row.color}"></span>
  {row.label}
</label>
```

색 스와치는 JS 값이므로 인라인 스타일로 남는다.

- [ ] **Step 2: ControlPanel 나머지 이행**

`<style>` 92줄을 지운다. `@media (max-width: 900px) { .ctl { display: none } }` (185–189줄)은 지운다 — 폰에서 컨트롤 패널을 숨기던 규칙이며 Phase C 에서 시트의 설정 탭이 대신한다.

슬라이더는 컴팩트에서 잡기 쉬워야 한다.

```svelte
<input
  type="range"
  class="w-full accent-amber compact:h-40"
  min="1" max="8" step="0.5"
  value={app.exaggeration}
  oninput={(e) => (app.exaggeration = Number(e.currentTarget.value))}
/>
```

- [ ] **Step 3: Inspector 이행**

`<style>` 124줄을 지우고 `@media (max-width: 900px)` 블록(175–181줄)도 지운다. 바깥은 `Pane.svelte` 로.

- [ ] **Step 4: 남은 style 확인**

```bash
grep -c "<style>" src/components/ControlPanel.svelte src/components/Inspector.svelte
```

기대: 두 파일 모두 `0`.

- [ ] **Step 5: 빌드와 눈 확인**

```bash
pnpm check && pnpm build
```

브라우저에서: 좌하단 컨트롤 패널의 레이어 체크박스·사업자 칩·슬라이더가 이행 전과 같은 모양이고 동작한다. 지도에서 지점을 클릭하면 우하단 인스펙터가 뜬다.

- [ ] **Step 6: 커밋**

```bash
git add src/components/ControlPanel.svelte src/components/Inspector.svelte
git commit -m "refactor(style): 컨트롤 패널·인스펙터를 Tailwind 로"
```

---

### Task 4: RoutePanel · Itinerary 이행

**Files:**
- Modify: `src/components/RoutePanel.svelte` (style 147줄 제거)
- Modify: `src/components/Itinerary.svelte` (style 159줄 제거)

**Interfaces:**
- Consumes: Task 1 의 `@theme` 이름, `Pane.svelte`, `Btn.svelte`
- Produces: 없음

- [ ] **Step 1: RoutePanel 이행**

`<style>` 147줄을 지운다. `@media (max-width: 900px)` 블록(247–255줄)도 지운다.

`<select>` 는 터치에서 작으면 못 누르므로 컴팩트 높이를 준다.

```svelte
<select
  class="w-full rounded-4 border border-line2 bg-panel2 px-8 py-4 font-sans
         text-sm text-tx cursor-pointer compact:min-h-40 compact:text-base"
>
```

- [ ] **Step 2: Itinerary 이행**

`<style>` 159줄을 지운다. Task 앞선 세션에서 넣은 근거 배지(`.src` `.src a` `.src .unsourced`)도 함께 옮긴다.

```svelte
<a
  href={src.url}
  target="_blank"
  rel="noreferrer noopener"
  data-kind={src.kind}
  class="rounded-3 border border-current/25 px-4 text-2xs leading-relaxed
         whitespace-nowrap text-tx3 no-underline hover:bg-current/12
         data-[kind=official]:text-[#6fb3a0]"
>
```

`#6fb3a0` 과 `#b58a5a` 는 근거 배지 전용 색이다. 두 곳에서만 쓰이므로 `@theme` 에 넣지 않고 임의값으로 둔다 — 이것이 Global Constraints 의 "임의값 금지"에 대한 유일한 예외이며, 이유를 주석으로 남긴다.

- [ ] **Step 3: 남은 style 확인**

```bash
grep -c "<style>" src/components/RoutePanel.svelte src/components/Itinerary.svelte
```

기대: 두 파일 모두 `0`.

- [ ] **Step 4: 빌드와 눈 확인**

```bash
pnpm check && pnpm build
```

브라우저에서: 우상단 경로 패널에서 출발·도착을 고르면 경로가 그려지고, 구간 목록에 `구내도` `보도` `OSM` `참고` 배지가 이행 전과 같은 모양으로 뜬다.

- [ ] **Step 5: 커밋**

```bash
git add src/components/RoutePanel.svelte src/components/Itinerary.svelte
git commit -m "refactor(style): 경로 패널·안내 목록을 Tailwind 로"
```

---

### Task 5: NavBar · MapApp 이행과 스케일 정규화

**Files:**
- Modify: `src/components/NavBar.svelte` (style 110줄 제거)
- Modify: `src/components/MapApp.svelte` (style 59줄 제거)
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: Task 1 의 `@theme` 이름
- Produces: 정규화된 간격 눈금 — `1 2 3 4 6 8 10 12 14`

- [ ] **Step 1: NavBar 이행**

`<style>` 110줄을 지운다. `.nav` 의 `bottom: 42px` 주석("아래 가운데의 출처 버튼과 겹치지 않게 한 칸 올린다")은 클래스 옆 주석으로 옮긴다.

- [ ] **Step 2: MapApp 이행**

`<style>` 59줄을 지운다. `.head` `.loading` `.err` 를 유틸리티로 옮긴다.

- [ ] **Step 3: 남은 style 확인**

```bash
grep -rc "<style>" src/components/*.svelte
```

기대: 모든 파일 `0`. 이 시점에서 컴포넌트 CSS 840줄이 전부 사라진다.

- [ ] **Step 4: 간격 눈금을 정규화한다**

지금까지는 값을 1:1 로 옮겼으므로 `p-5` `p-7` `p-9` `p-11` `p-13` 이 섞여 있다. 이제 한 번에 아래 표대로 치환한다.

| 지금 | 바꿀 값 | 등장 |
| --- | --- | --- |
| 5 | 4 | 3회 |
| 7 | 6 | 4회 |
| 9 | 8 | 7회 |
| 11 | 12 | 3회 |
| 13 | 12 | 1회 |

`1 2 3 4 6 8 10 12 14` 만 남는다. 시각 변화는 최대 2px 다.

```bash
grep -rn "\b\(p\|px\|py\|pt\|pb\|pl\|pr\|m\|mx\|my\|mt\|mb\|gap\)-\(5\|7\|9\|11\|13\)\b" src/components/
```

위 목록의 자리를 표대로 고친 뒤 다시 실행해 결과가 비어야 한다.

- [ ] **Step 5: 폰트 눈금도 정규화한다**

`text-[10px]` `text-[11px]` 이 남아 있으면 `text-sm`(10.5px)으로, `text-[14px]` 는 `text-lg`(15px)로 바꾼다.

```bash
grep -rn "text-\[" src/components/
```

기대: 근거 배지 색(`text-[#6fb3a0]` `text-[#b58a5a]`) 외에는 결과가 없다.

- [ ] **Step 6: 빌드와 눈 확인**

```bash
pnpm check && pnpm test && pnpm build
```

브라우저에서 데스크톱 배치 전체를 이행 전과 비교한다: 좌상단 타이틀, 좌측 레벨 레일, 좌하단 컨트롤, 우상단 경로, 우하단 인스펙터, 하단 가운데 출처. 경로를 만들고 따라가기를 재생해 NavBar 가 뜨는지 본다.

- [ ] **Step 7: 커밋**

```bash
git add src/components/NavBar.svelte src/components/MapApp.svelte src/styles/global.css
git commit -m "$(cat <<'EOF'
refactor(style): Tailwind 이행 완료 · 간격 눈금 정규화

컴포넌트 CSS 840줄이 사라졌다. 이행 중에는 값을 1:1 로 옮겨 "깨뜨린 것"과
"바꾼 것"을 섞지 않았고, 마지막에 한 번에 눈금을 맞췄다.

간격이 5 6 7 9 11 12 13 14 로 흩어져 있던 것을 1 2 3 4 6 8 10 12 14 로
줄였다. 시각 변화는 최대 2px 다.
EOF
)"
```

---

## Phase B — 터치 제스처

### Task 6: 제스처 수학

**Files:**
- Create: `src/lib/gesture.ts`
- Test: `src/lib/gesture.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `interface Pt { x: number; y: number }`
  - `interface Pinch { dist: number; angle: number; cx: number; cy: number }`
  - `interface PinchDelta { scale: number; rotation: number; dx: number; dy: number }`
  - `pinchOf(a: Pt, b: Pt): Pinch`
  - `wrapAngle(a: number): number`
  - `pinchDelta(prev: Pinch, next: Pinch): PinchDelta`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/gesture.test.ts` 를 만든다.

```ts
import { describe, expect, it } from 'vitest';
import { pinchDelta, pinchOf, wrapAngle } from './gesture';

const at = (ax: number, ay: number, bx: number, by: number) =>
  pinchOf({ x: ax, y: ay }, { x: bx, y: by });

describe('pinchOf', () => {
  it('거리·각·중점을 낸다', () => {
    const p = pinchOf({ x: 0, y: 0 }, { x: 30, y: 40 });
    expect(p.dist).toBe(50);
    expect(p.cx).toBe(15);
    expect(p.cy).toBe(20);
    expect(p.angle).toBeCloseTo(Math.atan2(40, 30));
  });
});

describe('wrapAngle', () => {
  it('반 바퀴를 넘으면 반대쪽으로 접는다', () => {
    expect(wrapAngle(1.9 * Math.PI)).toBeCloseTo(-0.1 * Math.PI);
    expect(wrapAngle(-1.9 * Math.PI)).toBeCloseTo(0.1 * Math.PI);
  });
  it('범위 안이면 그대로 둔다', () => {
    expect(wrapAngle(0.5)).toBe(0.5);
  });
});

describe('pinchDelta', () => {
  it('두 배로 벌리면 배율이 2 다', () => {
    expect(pinchDelta(at(0, 0, 100, 0), at(0, 0, 200, 0)).scale).toBeCloseTo(2);
  });

  it('90도 비틀면 회전이 PI/2 다', () => {
    expect(pinchDelta(at(0, 0, 100, 0), at(0, 0, 0, 100)).rotation).toBeCloseTo(Math.PI / 2);
  });

  it('180도 경계를 넘어도 작은 각으로 센다', () => {
    // 거의 +180° 에서 거의 -180° 로. 실제로 손가락이 움직인 각은 아주 작다.
    const d = pinchDelta(at(0, 0, -100, 2), at(0, 0, -100, -2));
    expect(Math.abs(d.rotation)).toBeLessThan(0.2);
  });

  it('중점이 움직인 만큼 dx·dy 가 나온다', () => {
    const d = pinchDelta(at(0, 0, 100, 0), at(10, 20, 110, 20));
    expect(d.dx).toBeCloseTo(10);
    expect(d.dy).toBeCloseTo(20);
  });

  it('손가락이 겹칠 만큼 가까우면 배율·회전을 버린다', () => {
    // 4px 떨어진 두 점에서 배율을 재면 작은 흔들림이 큰 줌으로 증폭된다.
    const d = pinchDelta(at(0, 0, 4, 0), at(0, 0, 40, 0));
    expect(d.scale).toBe(1);
    expect(d.rotation).toBe(0);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
pnpm vitest run src/lib/gesture.test.ts
```

기대: FAIL — `Failed to resolve import "./gesture"`

- [ ] **Step 3: 최소 구현을 쓴다**

`src/lib/gesture.ts` 를 만든다.

```ts
/**
 * 두 손가락 제스처의 수학.
 *
 * three.js 를 모르는 순수 함수로 둔다. 틀리기 쉬운 곳 — 각도가 180도를 넘을 때,
 * 손가락이 겹칠 만큼 가까울 때 — 을 카메라 코드와 떼어놓고 검증하기 위해서다.
 */

/** 화면 좌표 한 점 */
export interface Pt {
  x: number;
  y: number;
}

/** 두 포인터가 만드는 상태. 프레임마다 하나 만들어 이전 것과 비교한다. */
export interface Pinch {
  /** 두 점 사이 거리(px) */
  dist: number;
  /** 두 점이 이루는 각(rad) */
  angle: number;
  cx: number;
  cy: number;
}

export interface PinchDelta {
  /** 벌어진 배율. 1 이면 그대로 */
  scale: number;
  /** 회전(rad). 항상 (-PI, PI] */
  rotation: number;
  /** 중점 이동 */
  dx: number;
  dy: number;
}

export function pinchOf(a: Pt, b: Pt): Pinch {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return {
    dist: Math.hypot(dx, dy),
    angle: Math.atan2(dy, dx),
    cx: (a.x + b.x) / 2,
    cy: (a.y + b.y) / 2,
  };
}

/**
 * 각을 (-PI, PI] 로 접는다.
 * 179도에서 -179도로 넘어갈 때 -358도가 아니라 +2도로 세기 위해서다.
 */
export function wrapAngle(a: number): number {
  let r = a;
  while (r <= -Math.PI) r += 2 * Math.PI;
  while (r > Math.PI) r -= 2 * Math.PI;
  return r;
}

/**
 * 이보다 가까우면 배율·회전을 믿지 않는다. 손가락이 겹치면 작은 흔들림이
 * 큰 줌으로 증폭된다.
 */
const MIN_DIST = 12;

export function pinchDelta(prev: Pinch, next: Pinch): PinchDelta {
  const usable = prev.dist >= MIN_DIST && next.dist >= MIN_DIST;
  return {
    scale: usable ? next.dist / prev.dist : 1,
    rotation: usable ? wrapAngle(next.angle - prev.angle) : 0,
    dx: next.cx - prev.cx,
    dy: next.cy - prev.cy,
  };
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
pnpm test
```

기대: 기존 15개 + 새 8개 = 23개 통과.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/gesture.ts src/lib/gesture.test.ts
git commit -m "$(cat <<'EOF'
feat(input): 두 손가락 제스처 수학

카메라 코드와 떼어놓은 순수 함수로 둔다. 각이 180도를 넘을 때와 손가락이
겹칠 만큼 가까울 때가 틀리기 쉬운데, three.js 없이 검증할 수 있다.
EOF
)"
```

---

### Task 7: 다중 포인터 입력

**Files:**
- Modify: `src/lib/scene.ts:667-722` (`bindInput`, `pick`)

**Interfaces:**
- Consumes: Task 6 의 `pinchOf` `pinchDelta` `Pt` `Pinch`
- Produces: 없음 (내부 동작만 바뀐다)

- [ ] **Step 1: import 를 추가한다**

`src/lib/scene.ts` 상단 import 블록에 넣는다.

```ts
import { pinchDelta, pinchOf, type Pinch, type Pt } from './gesture';
```

- [ ] **Step 2: `bindInput` 을 교체한다**

`scene.ts` 의 `private bindInput() { ... }` 전체를 아래로 바꾼다.

```ts
private bindInput() {
  const cv = this.renderer.domElement;

  /** 눌려 있는 포인터. 터치는 여럿일 수 있다. */
  const pts = new Map<number, Pt>();
  /** 두 손가락일 때의 직전 상태 */
  let pinch: Pinch | null = null;
  let moved = 0;
  let button = 0;

  /** 앞의 두 포인터로 핀치 상태를 만든다. 셋 이상이면 나머지는 무시한다. */
  const twoOf = (): Pinch | null => {
    const it = pts.values();
    const a = it.next().value;
    const b = it.next().value;
    return a && b ? pinchOf(a, b) : null;
  };

  const rotate = (dx: number, dy: number) => {
    if (this.follow) {
      // 따라가는 중에는 진행 방향을 기준으로 좌우만 돌린다
      this.yawOffset -= dx * 0.005;
      this.phi = clamp(this.phi - dy * 0.005, 0.05, Math.PI / 2 - 0.02);
    } else {
      this.theta -= dx * 0.005;
      this.phi = clamp(this.phi - dy * 0.005, 0.08, Math.PI / 2 - 0.02);
    }
  };

  const pan = (dx: number, dy: number) => {
    const s = this.distance * 0.0016;
    const right = new THREE.Vector3(Math.cos(this.theta), 0, -Math.sin(this.theta));
    const fwd = new THREE.Vector3(Math.sin(this.theta), 0, Math.cos(this.theta));
    this.target.addScaledVector(right, -dx * s).addScaledVector(fwd, -dy * s);
  };

  cv.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) {
      moved = 0;
      button = e.button;
    }
    if (pts.size === 2) pinch = twoOf();
    cv.setPointerCapture(e.pointerId);
    cv.classList.add('dragging');
  });

  cv.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);

    if (pts.size >= 2) {
      const next = twoOf();
      if (pinch && next) {
        const d = pinchDelta(pinch, next);
        // 벌리면 가까워진다
        this.distance = clamp(this.distance / d.scale, 25, 4000);
        this.theta -= d.rotation;
        this.phi = clamp(this.phi - d.dy * 0.004, 0.08, Math.PI / 2 - 0.02);
      }
      pinch = next;
      return;
    }

    // 포인터 하나. 터치는 팬, 마우스는 지금까지와 같다.
    if (e.pointerType === 'touch' || button === 2 || e.shiftKey) pan(dx, dy);
    else rotate(dx, dy);
  });

  const release = (e: PointerEvent) => {
    const wasSingle = pts.size === 1;
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pts.size > 0) return;
    cv.classList.remove('dragging');
    // 손가락은 마우스보다 굵어 가만히 눌러도 몇 px 이 움직인다
    const slop = e.pointerType === 'touch' ? 10 : 5;
    if (wasSingle && moved < slop) this.pick(e);
  };
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', release);
  cv.addEventListener('contextmenu', (e) => e.preventDefault());

  cv.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      this.distance = clamp(this.distance * (1 + Math.sign(e.deltaY) * 0.12), 25, 4000);
    },
    { passive: false },
  );
}
```

- [ ] **Step 3: 빌드와 데스크톱 회귀 확인**

```bash
pnpm check && pnpm test && pnpm dev
```

마우스로 확인 — 조작감이 바뀌면 안 된다:
- 좌드래그 → 회전
- 우드래그 → 팬
- shift+좌드래그 → 팬
- 휠 → 줌
- 지점 클릭 → 인스펙터가 열린다
- 지점을 클릭했다 5px 미만 움직여도 선택된다

- [ ] **Step 4: 터치 확인**

devtools 디바이스 모드는 손가락 두 개를 흉내내지 못하므로 **실제 폰**에서 확인한다. `pnpm dev --host` 로 띄우고 같은 네트워크의 폰으로 접속한다.

- 한 손가락 드래그 → 지도가 따라 움직인다 (돌지 않는다)
- 두 손가락 오무리기 → 줌
- 두 손가락 비틀기 → 회전
- 두 손가락 상하 → 기울기
- 지점 탭 → 선택된다
- 페이지 자체가 스크롤되거나 브라우저 줌이 걸리지 않는다

- [ ] **Step 5: 커밋**

```bash
git add src/lib/scene.ts
git commit -m "$(cat <<'EOF'
feat(input): 터치로 지도를 조작할 수 있게

지금까지 폰에서 되는 조작은 회전 하나뿐이었다. 줌이 wheel 이벤트뿐이라
핀치가 없었고, 팬은 우클릭·shift 조건이라 터치로 도달할 수 없었다.

포인터를 Map 으로 추적해 두 손가락을 받는다. 한 손가락은 팬에 준다 —
현장에서 길을 찾을 때 이동과 줌이 주된 조작이고, 지도를 옮기려던 사람이
화면이 도는 것을 보는 쪽이 더 나쁘다. 마우스 조작감은 그대로 둔다.
EOF
)"
```

---

## Phase C — 셸과 모바일 배치

### Task 8: 컴팩트 판정과 DesktopShell

**Files:**
- Create: `src/components/DesktopShell.svelte`
- Modify: `src/components/MapApp.svelte`
- Modify: 패널 6개 — 자기 `fixed` 위치 클래스만 제거

**Interfaces:**
- Consumes: Task 1 의 `compact:` variant
- Produces:
  - `MapApp` 안의 `let compact = $state(false)`
  - `DesktopShell` props: `{ app: AppState; onReset: () => void }`

- [ ] **Step 1: 패널에서 위치를 걷어낸다**

여섯 파일의 최상위 요소에서 `fixed` 와 `top-* left-* right-* bottom-*` 클래스를 지운다. 크기(`w-280`)와 여백(`p-13`)은 남긴다.

| 파일 | 지울 클래스 |
| --- | --- |
| `ControlPanel.svelte` | `fixed bottom-14 left-14` |
| `Inspector.svelte` | `fixed bottom-14 right-14` |
| `RoutePanel.svelte` | `fixed top-14 right-14` |
| `LevelRail.svelte` | `fixed top-118 left-14` |
| `NavBar.svelte` | `fixed bottom-42 left-1/2 -translate-x-1/2` |
| `Attribution.svelte` | `fixed bottom-14 left-1/2 -translate-x-1/2` |

이 단계 뒤 패널들은 문서 흐름에 쌓여 화면이 깨진다. 다음 단계에서 셸이 다시 놓는다.

- [ ] **Step 2: DesktopShell 을 만든다**

```svelte
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
  <div class="fixed bottom-42 left-1/2 z-20 -translate-x-1/2">
    <NavBar {app} />
  </div>
{/if}
<div class="fixed top-118 left-14 z-10"><LevelRail {app} /></div>
<div class="fixed bottom-14 left-14 z-10"><ControlPanel {app} {onReset} /></div>
<div class="fixed top-14 right-14 z-10 max-h-[calc(100dvh-28px)] overflow-y-auto">
  <RoutePanel {app} />
</div>
<div class="fixed right-14 bottom-14 z-10"><Inspector {app} /></div>
<div class="fixed bottom-14 left-1/2 z-20 -translate-x-1/2"><Attribution {app} /></div>
```

- [ ] **Step 3: MapApp 에서 컴팩트를 판정하고 셸을 고른다**

`MapApp.svelte` 의 `<script>` 에 넣는다.

```ts
import DesktopShell from './DesktopShell.svelte';

/**
 * 폭만 보면 가로 모드 폰(844×390)이 데스크톱 배치에 걸려 패널이 세로로 넘친다.
 * pointer: coarse 는 터치 지원 노트북을 잘못 잡으므로 쓰지 않는다.
 * 이 조건은 저장소에서 여기 한 곳에만 있어야 한다.
 */
let compact = $state(false);

$effect(() => {
  const mq = matchMedia('(max-width: 820px), (max-height: 520px)');
  const sync = () => (compact = mq.matches);
  sync();
  mq.addEventListener('change', sync);
  return () => mq.removeEventListener('change', sync);
});
```

마크업의 패널 나열 부분을 바꾼다.

```svelte
{:else}
  <DesktopShell {app} onReset={() => scene?.resetView()} />
{/if}
```

- [ ] **Step 4: 데스크톱 회귀 확인**

```bash
pnpm check && pnpm test && pnpm build
```

브라우저 창을 넓게 두고 여섯 패널이 Task 5 직후와 같은 자리에 있는지 확인한다. 경로 따라가기를 켜서 NavBar 가 하단에 뜨는지도 본다.

- [ ] **Step 5: 커밋**

```bash
git add src/components/
git commit -m "$(cat <<'EOF'
refactor(ui): 배치 책임을 셸로 옮긴다

패널 여섯 개가 각자 position: fixed 를 들고 있어, 폰 대응이 @media 다섯
곳에 흩어진 채 서로 맞지 않았다. 패널에서 위치를 걷어내고 DesktopShell
한 곳에 모았다. 패널은 이제 자기가 어디 놓이는지 모른다.
EOF
)"
```

---

### Task 9: BottomSheet

**Files:**
- Create: `src/components/BottomSheet.svelte`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `type Snap = 'peek' | 'half' | 'full'`
  - props `{ snap: Snap (bindable); children: Snippet }`

- [ ] **Step 1: BottomSheet 를 만든다**

```svelte
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

  /** 시트가 다 열렸을 때 위에 남기는 높이 — 상단바 56px */
  const TOP = 56;
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
  style="height: calc(100dvh - {TOP}px);
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
```

- [ ] **Step 2: 타입 확인**

```bash
pnpm check
```

기대: 0 errors. 아직 아무도 이 컴포넌트를 쓰지 않으므로 화면은 변하지 않는다.

- [ ] **Step 3: 커밋**

```bash
git add src/components/BottomSheet.svelte
git commit -m "feat(ui): 바텀시트 — 스냅 3단계"
```

---

### Task 10: MobileShell

**Files:**
- Create: `src/components/MobileShell.svelte`
- Modify: `src/components/MapApp.svelte`

**Interfaces:**
- Consumes: Task 9 의 `BottomSheet` 와 `Snap`, Task 8 의 `compact`
- Produces: `MobileShell` props `{ app: AppState; onReset: () => void }`

- [ ] **Step 1: MobileShell 을 만든다**

```svelte
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
  class="fixed inset-x-0 top-0 z-30 flex h-56 items-center justify-between
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
        class="min-h-40 flex-1 rounded-4 text-sm
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
```

- [ ] **Step 2: MapApp 에서 셸을 갈라 끼운다**

```svelte
{:else}
  <div data-compact={compact ? '' : undefined}>
    {#if compact}
      <MobileShell {app} onReset={() => scene?.resetView()} />
    {:else}
      <DesktopShell {app} onReset={() => scene?.resetView()} />
    {/if}
  </div>
{/if}
```

`data-compact` 를 컴팩트일 때만 달아야 Task 1 의 `compact:` variant 가 이 안쪽에서만 걸린다.

`import MobileShell from './MobileShell.svelte';` 를 추가한다.

컴팩트에서는 좌상단 헤더가 상단바와 겹치므로 감춘다.

```svelte
{#if !compact}
  <header class="fixed top-14 left-14 …">…</header>
{/if}
```

- [ ] **Step 3: 확인**

```bash
pnpm check && pnpm test && pnpm build && pnpm dev --host
```

devtools 디바이스 모드 iPhone SE(375×667):
- 상단바가 보이고 3D 뷰가 화면 대부분을 차지한다
- 시트가 아래에 96px 만 보인다
- 손잡이를 끌면 절반·전체로 붙는다
- 지도에서 지점을 탭하면 시트가 절반까지 올라오고 정보 탭이 선택된다
- 출발·도착을 고르면 경로 탭으로 바뀐다
- 창을 넓히면 즉시 데스크톱 배치로 돌아간다

가로 모드(844×390): 높이 조건에 걸려 모바일 배치가 유지된다.

- [ ] **Step 4: 커밋**

```bash
git add src/components/MobileShell.svelte src/components/MapApp.svelte
git commit -m "$(cat <<'EOF'
feat(ui): 모바일 셸 — 상단바와 바텀시트

시트 탭은 상태를 따라간다. 경로가 있으면 경로, 지점을 고르면 정보,
아니면 설정이다. 사용자가 직접 고르면 그쪽이 이긴다.

지점을 탭하면 시트가 절반까지 올라온다. 접힌 채로 두면 무엇을 골랐는지
알 수 없다.
EOF
)"
```

---

### Task 11: 컴팩트 마감 — 타이포 · 안전영역 · 라벨

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/components/MapApp.svelte` (라벨 격자)
- Modify: 패널 6개 (`compact:` 클래스 추가)

**Interfaces:**
- Consumes: Task 1 의 `compact:` variant, Task 10 의 `data-compact`
- Produces: 없음

- [ ] **Step 1: viewport 에 `viewport-fit=cover` 를 넣는다**

`src/pages/index.astro` 의 viewport meta 를 바꾼다.

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

이것이 있어야 `env(safe-area-inset-*)` 가 0 이 아닌 값을 낸다.

- [ ] **Step 2: 패널 본문에 컴팩트 크기를 단다**

여섯 패널의 본문 텍스트에 한 단계 큰 크기를 더한다. 규칙은 `text-2xs → compact:text-sm`, `text-xs → compact:text-sm`, `text-sm → compact:text-base`.

누르는 것에는 최소 타깃을 준다.

```svelte
<button class="… compact:min-h-40 compact:px-12">
```

`RoutePanel` 과 `Inspector` 가 데스크톱에서 `w-280` 을 갖고 있는데 시트 안에서는 폭을 시트가 정해야 한다.

```svelte
<div class="w-280 compact:w-full">
```

- [ ] **Step 3: 라벨 겹침 격자를 넓힌다**

`MapApp.svelte` 의 `positionLabels` 안에서 격자 크기를 컴팩트에 따라 바꾼다. 현재 코드는

```ts
const cell = `${Math.round(s.x / 132)}:${Math.round(s.y / 26)}`;
```

이며 아래로 바꾼다.

```ts
// 폰에서는 라벨이 커지고 화면이 좁아 더 성기게 걸러야 겹치지 않는다
const cw = compact ? 116 : 132;
const ch = compact ? 32 : 26;
const cell = `${Math.round(s.x / cw)}:${Math.round(s.y / ch)}`;
```

라벨 글자도 컴팩트에서 키운다. `global.css` 의 `@layer components` 에 더한다.

```css
[data-compact] .lb {
  font-size: var(--text-base);
  padding: 3px 8px;
}
[data-compact] .lb.k-building,
[data-compact] .lb.k-entrance {
  font-size: var(--text-sm);
}
```

- [ ] **Step 4: 안전영역을 확인한다**

`MobileShell` 의 상단바는 Task 10 에서 `padding-top: env(safe-area-inset-top)` 을 이미 갖는다. 레벨 스트립이 노치에 물리지 않도록 위치를 고친다.

```svelte
<div class="fixed right-8 z-10" style="top: calc(72px + env(safe-area-inset-top));">
```

- [ ] **Step 5: 전체 확인**

```bash
pnpm check && pnpm test && pnpm build
```

devtools 디바이스 모드 iPhone 15(393×852)에서:
- 본문 글자가 데스크톱보다 크고 읽힌다
- 체크박스·칩·셀렉트가 40px 이상이라 손가락으로 눌린다
- 3D 라벨이 겹치지 않는다
- 시트를 전체로 열어도 상단바가 가려지지 않는다

실제 아이폰(노치 있는 기기)에서:
- 상단바가 노치 아래에서 시작한다
- 시트 바닥이 홈 인디케이터에 물리지 않는다

- [ ] **Step 6: 커밋**

```bash
git add src/pages/index.astro src/components/ src/styles/global.css
git commit -m "$(cat <<'EOF'
feat(ui): 컴팩트 타이포·터치 타깃·안전영역

폰에서 본문을 한 단계 키우고 누르는 것에 최소 40px 을 준다. 라벨은
커지는 만큼 겹침 격자를 넓혀 성기게 걸러낸다.

viewport-fit=cover 가 있어야 env(safe-area-inset-*) 가 값을 내므로
같이 넣는다.
EOF
)"
```

---

## Self-Review

**스펙 대응**

| 스펙 항목 | 태스크 |
| --- | --- |
| 배치 책임을 셸로 | 8, 10 |
| 브레이크포인트 (폭·높이) | 8 |
| `data-compact` + `compact:` variant | 1, 10, 11 |
| 터치 제스처 (지도 앱 표준) | 7 |
| 제스처 수학 순수 함수 분리 | 6 |
| 바텀시트 스냅 3단계 | 9 |
| 시트 탭이 상태를 따라감 | 10 |
| 레벨 스트립 · 상단바 · 출처 이동 | 10 |
| safe-area · `viewport-fit=cover` | 11 |
| `touch-action` · `overscroll-behavior` | 1, 7 |
| 라벨 격자 116×32 | 11 |
| Tailwind v4 `@tailwindcss/vite` | 1 |
| `@theme` 토큰 이전 | 1 |
| 폰트·간격 스케일 고정 | 1, 5 |
| `@apply` 금지 → 컴포넌트 승격 | 1 (`Pane` `Btn`) |
| 라벨 클래스 손으로 남김 | 1 |
| 이행을 먼저 끝내고 셸 | Phase A → C 순서 |
| 흩어진 `@media` 다섯 개 제거 | 1, 2, 3, 4 |

빠진 항목 없음.

**타입 일관성**

`pinchOf` `pinchDelta` `wrapAngle` `Pt` `Pinch` `PinchDelta` 는 Task 6 에서 정의되고 Task 7 에서 같은 이름으로 쓰인다. `Snap` 은 Task 9 에서 정의되고 Task 10 에서 임포트한다. `compact` 는 Task 8 에서 만들어 Task 10·11 에서 쓴다. `Pane` `Btn` 은 Task 1 에서 만들어 Task 2–4 에서 쓴다.
