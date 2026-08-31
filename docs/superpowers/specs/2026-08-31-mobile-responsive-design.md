# 모바일 반응형 대응 · Tailwind v4 이행

2026-08-31

## 왜

지금 UI 는 데스크톱 전용이다. 폰에서 열면 두 가지가 깨진다.

**패널이 화면을 덮는다.** 246–280px 고정폭 패널 여섯 개가 네 모서리와 하단 중앙에
`position: fixed` 로 박혀 있다. 390px 폭에서는 좌우 패널이 겹쳐 3D 뷰가 거의 남지 않는다.

**터치로 지도를 조작할 수 없다.** `scene.ts` 의 `bindInput()` 이 포인터 하나만 본다.
줌은 `wheel` 이벤트뿐이라 핀치가 없고, 팬은 `e.button === 2 || e.shiftKey` 조건이라
터치로는 도달할 수 없다. 폰에서 가능한 조작은 회전 하나뿐이다.

한 번 손대다 만 흔적으로 `@media (max-width: 900px)` 가 다섯 곳에 흩어져 있다.
컨트롤 패널을 `display: none` 으로 숨기고, 레벨 레일을 가로로 눕히고, body 에
`overflow: auto` 를 주는 식이라 서로 맞지 않는다. 이 규칙들은 전부 걷어낸다.

## 목표

폰을 1급 대상으로 삼는다. 시부야역 현장에서 폰을 꺼내 길을 찾는 데까지 쓸 수 있어야 한다.
기능은 줄이지 않는다.

## 하지 않는 것

- 네이티브 앱·PWA·오프라인 캐싱
- UI 테스트 인프라 도입 (Playwright 등)
- 데이터 레이어 변경
- 데스크톱 조작감 변경 — 마우스 입력은 지금 그대로 둔다

## 결정

### 1. 배치 책임을 셸로 옮긴다

여섯 개 패널에서 `position: fixed` 와 좌표를 걷어내고 내용만 남긴다. 배치는 새로 만드는
셸 두 개가 책임진다.

```
MapApp.svelte
  ├ compact 판정
  ├ DesktopShell.svelte   네 모서리 배치 (지금과 동일한 결과)
  └ MobileShell.svelte    상단바 + 바텀시트 + 우측 레벨 스트립
        └ ControlPanel · Inspector · Itinerary · RoutePanel · NavBar · Attribution
```

패널 하나를 고치면 양쪽에 함께 반영되고, 배치를 바꿀 때는 셸 한 곳만 연다.
모바일 전용 컴포넌트를 따로 만들지 않는 이유는 경로 안내·인스펙터 로직이 두 벌로
갈라지면 데이터를 고칠 때마다 두 곳을 고쳐야 하기 때문이다.

### 2. 브레이크포인트는 폭과 높이를 함께 본다

```
compact = matchMedia('(max-width: 820px), (max-height: 520px)')
```

높이 조건이 필요한 이유는 가로 모드 폰(844×390)이다. 폭만 보면 데스크톱 배치가 걸려
패널이 세로로 넘친다. `pointer: coarse` 는 쓰지 않는다 — 터치 지원 노트북을 잘못 잡는다.

Svelte 5 에서 `$state` 와 `matchMedia` 리스너로 구현하고, 화면 회전 시 즉시 전환된다.

**패널은 자기가 컴팩트인지 묻지 않는다.** 배치는 셸이 정하지만, 패널 안쪽에도 폰에서
달라져야 하는 것이 있다 — 폰트 크기와 터치 타깃 높이다. 이것을 각 패널이 `matchMedia` 로
따로 판단하면 판정이 일곱 군데로 흩어져 지금과 같은 상태로 돌아간다.

셸이 감싸는 요소에 `data-compact` 를 걸고, 패널은 Tailwind 의 커스텀 variant 로 반응한다.

```css
@custom-variant compact (&:where([data-compact] *));
```

```svelte
<span class="text-2xs compact:text-sm">…</span>
```

이렇게 하면 판정이 셸 한 곳에만 있고, 패널은 자기 크기 규칙만 마크업에 들고 있다.
Tailwind 기본 브레이크포인트(`sm:` `md:`)는 이 프로젝트에서 쓰지 않는다 — 폭만 보므로
가로 모드 폰을 놓치고, 셸 판정과 어긋난 두 개의 기준이 생긴다.

### 3. 터치 제스처는 지도 앱 표준을 따른다

| 입력 | 동작 |
| --- | --- |
| 터치 1개 드래그 | 팬 |
| 터치 1개 탭 | 지점 선택 |
| 터치 2개 오무리기 | 줌 |
| 터치 2개 비틀기 | 회전 |
| 터치 2개 상하 이동 | 기울기 |
| 마우스 | 지금 그대로 (좌=회전, 우·shift=팬, 휠=줌) |

한 손가락을 회전이 아니라 팬에 주는 이유는, 현장에서 길을 찾을 때 이동과 줌이 주된
조작이고 회전은 가끔이기 때문이다. 구글·애플 지도와 같은 배치라 배울 것이 없다.

입체 구조를 둘러보려면 두 손가락을 써야 한다는 것이 비용이다. 회전을 한 손가락에 두면
지도를 옮기려던 사람이 화면이 도는 것을 보게 되는데, 그쪽이 더 나쁘다.

`e.pointerType` 으로 분기하므로 데스크톱 조작감은 변하지 않는다.

### 4. 제스처 수학은 순수 함수로 분리한다

`src/lib/gesture.ts` 에 두 포인터를 받아 `{ scale, rotation, centroid }` 를 내는 함수를
둔다. three.js 없이 vitest 로 검증할 수 있고, `scene.ts` 는 그 결과를 카메라에 적용하는
일만 한다.

이 프로젝트에는 UI 테스트 인프라가 없고 이번에 도입하지 않는다. 대신 틀리기 쉬운
부분(각도 랩어라운드, 포인터가 셋 이상일 때, 한 손가락이 떨어질 때의 점프)을 순수 함수로
떼어내 테스트한다. 레이아웃은 devtools 디바이스 모드와 실제 기기로 확인한다.

### 5. 바텀시트

의존성을 늘리지 않고 `BottomSheet.svelte` 를 직접 만든다. 스냅 세 단계 —
`peek 96px` / `half 45dvh` / `full calc(100dvh - 56px)`. `vh` 가 아니라 `dvh` 를 쓰는 이유는
모바일 브라우저의 주소창 때문이다.

시트 헤더에 세그먼트 `경로 | 정보 | 설정` 을 두고, **기본 선택은 상태를 따라간다.**

| 상태 | 기본 탭 |
| --- | --- |
| 경로가 있음 | 경로 (RoutePanel + Itinerary) |
| 지점이 선택됨 | 정보 (Inspector) |
| 그 외 | 설정 (ControlPanel + Attribution) |

3D 뷰에서 지점을 탭하면 시트가 `half` 로 올라온다. 경로 따라가기 `NavBar` 는 시트 위에
떠 있고 시트가 `full` 이면 숨는다.

### 6. 나머지 배치

- 레벨 레일 — 우측 세로 스트립, 버튼 40×36
- 상단바 — 높이 56px, 타이틀과 뷰 리셋만
- 출처 — 설정 탭 안으로
- `env(safe-area-inset-*)` 반영, `index.astro` 의 viewport 에 `viewport-fit=cover` 추가
- 캔버스에 `touch-action: none`, body 에 `overscroll-behavior: none` — 브라우저 기본 줌과
  당겨서 새로고침을 막는다
- 3D 라벨의 겹침 판정 격자를 컴팩트에서 132×26 → 116×32 로 넓히고 폰트를 키운다

### 7. Tailwind v4 로 전면 이행

**설치.** `@tailwindcss/vite` 플러그인을 쓴다. `@astrojs/tailwind` 통합은 v4 에서 폐지됐다.
설치된 Astro 는 5.18.2 로 Vite 플러그인 방식(5.2 이상)이 바로 된다.

```js
// astro.config.mjs
import tailwind from '@tailwindcss/vite';
export default defineConfig({ vite: { plugins: [tailwind()] } });
```

**토큰 이전.** `global.css` 의 CSS 변수를 `@theme` 으로 옮긴다. v4 의 `@theme` 은 곧
CSS 변수를 만들므로 지금 구조와 개념이 같다.

```css
@import 'tailwindcss';
@theme {
  --color-bg: #0e1218;
  --color-panel: #161d26;
  --color-amber: #e8b23a;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
  --text-2xs: 9px;
  --text-xs: 10.5px;
}
```

**폰트·간격 스케일을 고정한다.** 지금 폰트 크기가 9 / 9.5 / 10 / 10.5 / 11 / 12 / 13 로,
간격이 5 / 6 / 7 / 9 / 11 / 13 / 14 로 제각각이다. 이 앱은 계기판 같은 촘촘한 UI 라 작은
값이 의도된 것이므로 Tailwind 기본 스케일을 쓰지 않고, `@theme` 에 이 프로젝트의 스케일을
등록한다. 등록된 값만 쓰고 `text-[10.5px]` 같은 임의값은 쓰지 않는다. 임의값이 늘면
Tailwind 를 쓰는 이유가 사라진다.

**`@apply` 는 쓰지 않는다.** v4 에서 Svelte 의 `<style>` 안에 쓰려면 블록마다
`@reference` 가 필요하고, 그렇게 하면 유틸리티를 마크업에 두는 이점이 사라진다.
반복되는 껍데기는 `@apply` 가 아니라 Svelte 컴포넌트로 승격한다.

**손으로 남기는 CSS.** 두 가지는 유틸리티로 옮기지 않는다.

- `.lb` / `.k-*` — 3D 라벨. `MapApp.svelte:158` 에서 `el.className = \`lb k-${l.kind}\`` 로
  JS 가 조립하므로 Tailwind 스캐너가 읽지 못한다. `@layer components` 에 둔다.
- three.js 캔버스 관련 규칙 — 마크업이 없다.

**이행 순서.** 컴포넌트를 한 번에 하나씩 옮기고, 옮긴 파일에서는 `<style>` 을 비운다.
두 체계가 오래 공존하지 않도록 이행을 먼저 끝낸 뒤 모바일 셸을 올린다.

## 파일

**새로**

| 파일 | 하는 일 |
| --- | --- |
| `src/components/DesktopShell.svelte` | 데스크톱 배치 |
| `src/components/MobileShell.svelte` | 상단바 · 바텀시트 · 레벨 스트립 |
| `src/components/BottomSheet.svelte` | 스냅 3단계 시트 |
| `src/lib/gesture.ts` | 두 포인터 → scale · rotation · centroid |
| `src/lib/gesture.test.ts` | 위 함수 검증 |

**수정**

| 파일 | 무엇을 |
| --- | --- |
| `src/lib/scene.ts` | 다중 포인터 입력, `touch-action` |
| `src/components/MapApp.svelte` | compact 판정, 셸 분기, 라벨 격자 |
| 패널 6개 | `position: fixed` 제거, Tailwind 이행 |
| `src/styles/global.css` | `@theme` 토큰, `@layer components` 에 라벨 |
| `src/pages/index.astro` | `viewport-fit=cover` |
| `astro.config.mjs` | `@tailwindcss/vite` |
| `package.json` | `tailwindcss` · `@tailwindcss/vite` |

## 검증

- `pnpm test` — 기존 15개 + `gesture.test.ts`
- `pnpm check` — 0 errors 유지
- 데스크톱에서 조작감·배치가 변하지 않았는지 육안 확인
- devtools 디바이스 모드에서 iPhone SE(375×667) · iPhone 15(393×852) · 가로 모드
- 실제 기기에서 핀치 줌·두 손가락 회전·시트 드래그
