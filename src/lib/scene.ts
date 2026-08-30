/**
 * three.js 씬. 층을 수직으로 벌려 쌓은 2.5D 뷰.
 *
 * 좌표 변환: 지도 (x=동, y=북, level) → three (x, y=표고, z=-북)
 * 표고는 `levelZ(level) * exaggeration` 으로 과장한다. 시부야역의 실제 층 범위는
 * 약 52m 인데 평면 범위는 1.2km 라, 과장 없이는 층 구분이 보이지 않는다.
 */
import * as THREE from 'three';

import { levelZ } from './levels';
import { OPERATOR_COLORS, SOURCE_COLORS, hex } from './palette';
import type { MapDoc, PlaceDoc, XY } from './mapdoc';

export interface ViewState {
  exaggeration: number;
  /** null 이면 전체 층 */
  activeLevel: number | null;
  layers: {
    buildings: boolean;
    landmarks: boolean;
    entrances: boolean;
    mlit: boolean;
    osm: boolean;
    curated: boolean;
    plates: boolean;
  };
  /** 주요 건물을 실제 높이로 세울지, 낮게 눌러 볼지 */
  realHeights: boolean;
  operators: Set<string>;
  showPlanned: boolean;
  selectedId: string | null;
  routeNodes: number[] | null;
}

export interface LabelBox {
  id: string;
  text: string;
  operator: string;
  level: number;
  planned: boolean;
  kind: string;
  position: THREE.Vector3;
  screen: { x: number; y: number; visible: boolean; depth: number };
}

const GROUND = 0x141a22;
/** 지상 레벨 네트워크와 겹쳐 깜빡이지 않도록 건물·층판을 살짝 내린다. */
const BUILDING_Y = -1.6;
const PLATE_Y = -2.6;

export class MapScene {
  readonly labels: LabelBox[] = [];

  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera!: THREE.PerspectiveCamera;
  private root = new THREE.Group();

  private gPlates = new THREE.Group();
  private gBuildings = new THREE.Group();
  private gEdges = new THREE.Group();
  private gPlaces = new THREE.Group();
  private gRoute = new THREE.Group();
  private gRisers = new THREE.Group();

  private placeMeshes: { place: PlaceDoc; mesh: THREE.Object3D }[] = [];
  private edgeLines = new Map<string, THREE.LineSegments>();
  private raycaster = new THREE.Raycaster();

  /** 궤도 카메라 파라미터 */
  private theta = 0.9;
  private phi = 0.72;
  private distance = 620;
  private target = new THREE.Vector3(0, 0, 0);

  private state: ViewState;
  private frame = 0;
  private disposed = false;

  constructor(
    private el: HTMLElement,
    private doc: MapDoc,
    state: ViewState,
    private onPick: (id: string | null) => void,
  ) {
    this.state = state;
    this.init();
    this.build();
    this.apply();
    this.loop();
  }

  /* ------------------------------------------------------------ 초기화 */

  private init() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(this.el.clientWidth, this.el.clientHeight);
    this.el.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      40,
      this.el.clientWidth / this.el.clientHeight,
      1,
      12000,
    );

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.72));
    const key = new THREE.DirectionalLight(0xffffff, 0.5);
    key.position.set(300, 800, 400);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.2);
    fill.position.set(-400, 200, -300);
    this.scene.add(fill);

    this.root.add(
      this.gPlates,
      this.gBuildings,
      this.gRisers,
      this.gEdges,
      this.gPlaces,
      this.gRoute,
    );
    this.scene.add(this.root);

    this.bindInput();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(this.el);
  }

  private resize() {
    const w = this.el.clientWidth;
    const h = this.el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /* ------------------------------------------------------------ 씬 구성 */

  private y(level: number): number {
    return levelZ(level) * this.state.exaggeration;
  }

  private build() {
    this.buildPlates();
    this.buildBuildings();
    this.buildEdges();
    this.buildPlaces();
    this.buildRisers();
  }

  /**
   * 각 지점에서 지상면까지 수선을 내린다. 층을 벌려 놓으면 무엇이 무엇의
   * 위/아래에 있는지가 사라지는데, 이 선 하나로 대응 관계가 즉시 읽힌다.
   */
  private buildRisers() {
    const mat = new THREE.LineBasicMaterial({
      color: 0x3c4a5b,
      transparent: true,
      opacity: 0.5,
    });
    const pts: number[] = [];
    for (const p of this.doc.places) {
      pts.push(p.x, 0, -p.y, p.x, 0, -p.y);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const seg = new THREE.LineSegments(geo, mat);
    this.gRisers.add(seg);
    this.applyRiserHeights();
  }

  private applyRiserHeights() {
    const seg = this.gRisers.children[0] as THREE.LineSegments | undefined;
    if (!seg) return;
    const pos = seg.geometry.getAttribute('position') as THREE.BufferAttribute;
    this.doc.places.forEach((p, i) => {
      pos.setY(i * 2, 0);
      pos.setY(i * 2 + 1, this.y(p.level));
    });
    pos.needsUpdate = true;
  }

  /** 층마다 얇은 반투명 판을 깔아 층 구분을 만든다. */
  private buildPlates() {
    const levels = [...new Set(this.doc.places.map((p) => p.level))].sort((a, b) => a - b);
    const size = 760;
    for (const lv of levels) {
      const g = new THREE.Group();
      g.userData.level = lv;

      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({
          color: 0x1b2430,
          transparent: true,
          opacity: 0.22,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = PLATE_Y;
      plane.userData.baseOpacity = 0.22;
      g.add(plane);

      const grid = new THREE.GridHelper(size, 8, 0x33404f, 0x232d39);
      const gm = grid.material as THREE.Material & { opacity: number };
      gm.transparent = true;
      gm.opacity = 0.3;
      grid.position.y = PLATE_Y;
      grid.userData.baseOpacity = 0.3;
      g.add(grid);

      this.gPlates.add(g);
    }
  }

  private buildBuildings() {
    // 지도 좌표 (x=동, y=북) → three 는 rotation.x=-90° 로 눕히므로
    // Shape 에는 (x, y) 를 그대로 넣으면 (x, 높이, -y) 가 된다.
    const fill = new THREE.MeshBasicMaterial({
      color: 0x1e2733,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x475769,
      transparent: true,
      opacity: 0.8,
    });

    for (const b of this.doc.buildings) {
      // 주요 건물은 places 쪽에서 입체로 그리므로 여기서는 건너뛴다.
      if (b.landmark) continue;
      const mesh = new THREE.Mesh(this.shapeOf(b.ring), fill);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = BUILDING_Y;
      this.gBuildings.add(mesh);

      const pts = b.ring.map((p) => new THREE.Vector3(p[0], BUILDING_Y + 0.05, -p[1]));
      this.gBuildings.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), edgeMat));
    }
  }

  private shapeOf(ring: XY[]): THREE.ShapeGeometry {
    return new THREE.ShapeGeometry(
      new THREE.Shape(ring.map((p) => new THREE.Vector2(p[0], p[1]))),
    );
  }

  /** 폴리곤을 위로 뽑아 올린다. 두께 1 로 만들고 scale.y 로 높이를 준다. */
  private prismOf(ring: XY[]): THREE.ExtrudeGeometry {
    return new THREE.ExtrudeGeometry(
      new THREE.Shape(ring.map((p) => new THREE.Vector2(p[0], p[1]))),
      { depth: 1, bevelEnabled: false },
    );
  }

  /** 소스별로 하나의 LineSegments 로 합쳐 드로우콜을 줄인다. */
  private buildEdges() {
    const groups = new Map<
      string,
      { pts: number[]; levels: number[]; src: string; planned: boolean }
    >();
    const bucket = (key: string, src: string, planned: boolean) => {
      let g = groups.get(key);
      if (!g) groups.set(key, (g = { pts: [], levels: [], src, planned }));
      return g;
    };
    const ns = this.doc.graph.nodes;

    for (const e of this.doc.graph.edges) {
      const a = ns[e.a]!;
      const b = ns[e.b]!;
      const key = e.src + (e.p ? ':planned' : '');
      const g = bucket(key, e.src, Boolean(e.p));
      g.pts.push(a[0], 0, -a[1], b[0], 0, -b[1]);
      g.levels.push(a[2], b[2]);
    }

    for (const [key, g] of groups) {
      if (!g.pts.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pts, 3));
      geo.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(new Float32Array(g.pts.length), 3),
      );
      const mat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: g.planned ? 0.4 : g.src === 'curated' ? 0.7 : g.src === 'mlit' ? 0.8 : 0.6,
      });
      const seg = new THREE.LineSegments(geo, mat);
      seg.userData.src = g.src;
      seg.userData.planned = g.planned;
      seg.userData.levels = g.levels;
      seg.userData.base = new THREE.Color(
        hex(SOURCE_COLORS[g.src as keyof typeof SOURCE_COLORS]),
      );
      this.edgeLines.set(key, seg);
      this.gEdges.add(seg);
    }
    this.applyEdgeHeights();
    this.applyEdgeColors();
  }

  /** 활성 층 밖의 링크는 색을 배경 쪽으로 눌러 뒤로 보낸다. */
  private applyEdgeColors() {
    const active = this.state.activeLevel;
    for (const seg of this.edgeLines.values()) {
      const levels = seg.userData.levels as number[];
      const base = seg.userData.base as THREE.Color;
      const col = seg.geometry.getAttribute('color') as THREE.BufferAttribute;
      for (let i = 0; i < levels.length; i++) {
        const on = active === null || Math.abs(levels[i]! - active) < 0.5;
        const k = on ? 1 : 0.2;
        col.setXYZ(i, base.r * k, base.g * k, base.b * k);
      }
      col.needsUpdate = true;
    }
  }

  /** 층 과장값이 바뀔 때마다 정점 y 를 다시 쓴다. */
  private applyEdgeHeights() {
    const ns = this.doc.graph.nodes;
    const cursor: Record<string, number> = {};
    for (const key of this.edgeLines.keys()) cursor[key] = 0;

    for (const e of this.doc.graph.edges) {
      const key = e.src + (e.p ? ':planned' : '');
      const seg = this.edgeLines.get(key);
      if (!seg) continue;
      const pos = seg.geometry.getAttribute('position') as THREE.BufferAttribute;
      const i = cursor[key]!;
      pos.setY(i, this.y(ns[e.a]![2]));
      pos.setY(i + 1, this.y(ns[e.b]![2]));
      cursor[key] = i + 2;
    }
    for (const seg of this.edgeLines.values()) {
      (seg.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  private buildPlaces() {
    for (const p of this.doc.places) {
      const color = hex(OPERATOR_COLORS[p.operator as keyof typeof OPERATOR_COLORS] ?? '#8A96A6');
      const obj =
        p.kind === 'building'
          ? this.buildingFeature(p, color)
          : p.footprints?.length
            ? this.shapeFeature(p, color)
            : p.kind === 'entrance'
              ? this.entranceFeature(p, color)
              : this.pointFeature(p, color);
      obj.userData.place = p;
      this.gPlaces.add(obj);
      this.placeMeshes.push({ place: p, mesh: obj });

      this.labels.push({
        id: p.id,
        text: p.name,
        operator: p.operator,
        level: p.level,
        planned: Boolean(p.planned),
        kind: p.kind,
        position: new THREE.Vector3(p.x, 0, -p.y),
        screen: { x: 0, y: 0, visible: false, depth: 0 },
      });
    }
    this.applyPlaceHeights();
  }

  /** 승강장·연락통로: 실제 폴리곤을 얇은 슬래브로 세운다. */
  private shapeFeature(p: PlaceDoc, color: number): THREE.Object3D {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({
      color,
      transparent: true,
      opacity: p.planned ? 0.32 : 0.66,
      side: THREE.DoubleSide,
    });
    const lineMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: p.planned ? 0.5 : 0.95,
    });
    for (const ring of p.footprints!) {
      const mesh = new THREE.Mesh(this.prismOf(ring), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.scale.y = p.kind === 'passage' ? 1.6 : 2.6;
      g.add(mesh);
      const pts = ring.map((q) => new THREE.Vector3(q[0], 0.1, -q[1]));
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    }
    return g;
  }

  /** 주요 건물: 발자국을 실제 높이만큼(또는 낮게 눌러) 세운다. */
  private buildingFeature(p: PlaceDoc, color: number): THREE.Object3D {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({
      color: p.planned ? 0x4a5464 : 0x35424f,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x7f8fa3,
      transparent: true,
      opacity: 0.85,
    });
    for (const ring of p.footprints ?? []) {
      const mesh = new THREE.Mesh(this.prismOf(ring), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.userData.buildingPrism = true;
      g.add(mesh);
      const pts = ring.map((q) => new THREE.Vector3(q[0], 0.1, -q[1]));
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    }
    g.userData.realHeight = p.height ?? 24;
    void color;
    return g;
  }

  /** 지상 출입구: 작은 기둥 */
  private entranceFeature(p: PlaceDoc, color: number): THREE.Object3D {
    const g = new THREE.Group();
    const geo = new THREE.CylinderGeometry(2.6, 2.6, 7, 8);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.85 }),
    );
    mesh.position.set(p.x, 3.5, -p.y);
    g.add(mesh);
    return g;
  }

  private pointFeature(p: PlaceDoc, color: number): THREE.Object3D {
    const size = p.kind === 'gate' ? 11 : p.kind === 'plaza' ? 26 : 14;
    const geo = new THREE.BoxGeometry(size, p.kind === 'gate' ? 5 : 2.6, size);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshLambertMaterial({
        color,
        transparent: true,
        opacity: p.planned ? 0.36 : 0.82,
      }),
    );
    mesh.position.set(p.x, 0, -p.y);
    const g = new THREE.Group();
    g.add(mesh);
    g.add(this.outline(geo, mesh.position, 0, color, p.planned));
    return g;
  }

  private outline(
    geo: THREE.BufferGeometry,
    pos: THREE.Vector3,
    rotY: number,
    color: number,
    planned?: boolean,
  ): THREE.LineSegments {
    const seg = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: planned ? 0.5 : 0.95 }),
    );
    seg.position.copy(pos);
    seg.rotation.y = rotY;
    return seg;
  }

  private applyPlaceHeights() {
    for (const { place, mesh } of this.placeMeshes) {
      mesh.position.y = this.y(place.level);
    }
    for (const l of this.labels) {
      l.position.y = this.y(l.level) + 6;
    }
    let i = 0;
    for (const child of this.gPlates.children) {
      child.position.y = this.y((child.userData.level as number) ?? 1);
      i++;
    }
    void i;
  }

  /* ------------------------------------------------------------ 상태 반영 */

  setState(next: ViewState) {
    const exaggerationChanged = next.exaggeration !== this.state.exaggeration;
    const routeChanged = next.routeNodes !== this.state.routeNodes;
    this.state = next;
    if (exaggerationChanged) {
      this.applyEdgeHeights();
      this.applyPlaceHeights();
      this.applyRiserHeights();
    }
    if (routeChanged) this.buildRoute();
    this.apply();
  }

  private apply() {
    const s = this.state;

    this.gPlates.visible = s.layers.plates;
    this.gRisers.visible = s.layers.curated;
    this.gBuildings.visible = s.layers.buildings;

    for (const seg of this.edgeLines.values()) {
      const src = seg.userData.src as string;
      const planned = seg.userData.planned as boolean;
      seg.visible =
        (s.layers[src as 'mlit' | 'osm' | 'curated'] ?? true) && (!planned || s.showPlanned);
    }
    this.applyEdgeColors();

    for (const { place, mesh } of this.placeMeshes) {
      const visible = this.placeVisible(place, s);
      mesh.visible = visible;
      // 건물은 배경 맥락이라 층을 걸러도 완전히 지우지 않는다.
      const dim = place.kind === 'building' ? 0.45 : 0.14;
      setOpacity(mesh, this.placeOnActiveLevel(place, s) || place.id === s.selectedId ? 1 : dim);

      if (place.kind === 'building') {
        const h = s.realHeights ? Math.min(place.height ?? 24, 160) * 0.55 : 16;
        mesh.traverse((o) => {
          if (o.userData.buildingPrism) o.scale.y = h;
        });
      }
    }

    for (const l of this.labels) {
      const place = this.doc.places.find((p) => p.id === l.id)!;
      l.screen.visible = this.placeVisible(place, s) && this.placeOnActiveLevel(place, s);
    }

    // 층을 하나 고르면 나머지 판은 흐리게
    for (const g of this.gPlates.children) {
      const lv = g.userData.level as number;
      const on = s.activeLevel === null || Math.abs(lv - s.activeLevel) < 0.5;
      g.traverse((o) => {
        const m = (o as THREE.Object3D & { material?: THREE.Material }).material;
        const base = (o.userData.baseOpacity as number | undefined) ?? 0.3;
        if (m && 'opacity' in m) {
          (m as THREE.Material & { opacity: number }).opacity = on ? base : base * 0.2;
        }
      });
    }
  }

  private placeVisible(p: PlaceDoc, s: ViewState): boolean {
    if (p.planned && !s.showPlanned) return false;
    if (p.kind === 'building') return s.layers.landmarks;
    if (p.kind === 'entrance') return s.layers.entrances;
    return s.layers.curated && s.operators.has(p.operator);
  }

  private placeOnActiveLevel(p: PlaceDoc, s: ViewState): boolean {
    return s.activeLevel === null || Math.abs(p.level - s.activeLevel) < 0.5;
  }

  private buildRoute() {
    this.gRoute.clear();
    const nodesIdx = this.state.routeNodes;
    if (!nodesIdx || nodesIdx.length < 2) return;
    const ns = this.doc.graph.nodes;
    const pts = nodesIdx.map((i) => {
      const n = ns[i]!;
      return new THREE.Vector3(n[0], this.y(n[2]) + 1.5, -n[1]);
    });
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.02);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, Math.min(pts.length * 6, 900), 5, 8, false),
      new THREE.MeshBasicMaterial({
        color: 0xffd166,
        transparent: true,
        opacity: 0.98,
        // 다른 층에 가려도 경로 전체가 보여야 한다.
        depthTest: false,
      }),
    );
    tube.renderOrder = 10;
    this.gRoute.add(tube);

    for (const end of [pts[0]!, pts[pts.length - 1]!]) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(8, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xffc94d, depthTest: false }),
      );
      dot.position.copy(end);
      this.gRoute.add(dot);
    }
  }

  /* -------------------------------------------------------------- 입력 */

  private bindInput() {
    const cv = this.renderer.domElement;
    let drag: { x: number; y: number; button: number } | null = null;
    let moved = 0;

    cv.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, button: e.button };
      moved = 0;
      cv.setPointerCapture(e.pointerId);
      cv.classList.add('dragging');
    });

    cv.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      moved += Math.abs(dx) + Math.abs(dy);
      if (drag.button === 2 || e.shiftKey) {
        const s = this.distance * 0.0016;
        const right = new THREE.Vector3(Math.cos(this.theta), 0, -Math.sin(this.theta));
        const fwd = new THREE.Vector3(Math.sin(this.theta), 0, Math.cos(this.theta));
        this.target.addScaledVector(right, -dx * s).addScaledVector(fwd, -dy * s);
      } else {
        this.theta -= dx * 0.005;
        this.phi = clamp(this.phi - dy * 0.005, 0.08, Math.PI / 2 - 0.02);
      }
      drag.x = e.clientX;
      drag.y = e.clientY;
    });

    const end = (e: PointerEvent) => {
      cv.classList.remove('dragging');
      if (drag && moved < 5) this.pick(e);
      drag = null;
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', () => {
      cv.classList.remove('dragging');
      drag = null;
    });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());

    cv.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.distance = clamp(this.distance * (1 + Math.sign(e.deltaY) * 0.12), 90, 4000);
      },
      { passive: false },
    );
  }

  private pick(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.gPlaces.children, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.place) o = o.parent;
      if (o?.userData.place && o.visible) {
        this.onPick((o.userData.place as PlaceDoc).id);
        return;
      }
    }
    this.onPick(null);
  }

  /** 특정 지점으로 카메라를 이동. */
  focus(id: string) {
    const p = this.doc.places.find((q) => q.id === id);
    if (!p) return;
    this.target.set(p.x, this.y(p.level), -p.y);
    this.distance = Math.min(this.distance, 420);
  }

  resetView() {
    this.theta = 0.9;
    this.phi = 0.72;
    this.distance = 620;
    this.target.set(0, 0, 0);
  }

  /* -------------------------------------------------------------- 루프 */

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    const r = this.distance;
    this.camera.position.set(
      this.target.x + r * Math.cos(this.phi) * Math.sin(this.theta),
      this.target.y + r * Math.sin(this.phi),
      this.target.z + r * Math.cos(this.phi) * Math.cos(this.theta),
    );
    this.camera.lookAt(this.target);
    this.renderer.render(this.scene, this.camera);
    this.projectLabels();
  };

  private projectLabels() {
    const w = this.el.clientWidth;
    const h = this.el.clientHeight;
    const v = new THREE.Vector3();
    for (const l of this.labels) {
      v.copy(l.position).project(this.camera);
      l.screen.x = ((v.x + 1) / 2) * w;
      l.screen.y = ((1 - v.y) / 2) * h;
      l.screen.depth = v.z;
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function setOpacity(o: THREE.Object3D, k: number) {
  o.traverse((child) => {
    const m = (child as THREE.Mesh).material as THREE.Material | undefined;
    if (m && 'opacity' in m) {
      const base = (child as THREE.Mesh).userData.baseOpacity as number | undefined;
      const b = base ?? (m as THREE.Material & { opacity: number }).opacity;
      (child as THREE.Mesh).userData.baseOpacity = b;
      (m as THREE.Material & { opacity: number }).opacity = b * k;
    }
  });
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export { GROUND };
