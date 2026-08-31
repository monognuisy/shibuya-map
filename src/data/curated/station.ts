/**
 * 시부야역 구내 레이어 (자체 작성).
 *
 * ── 왜 필요한가
 * 국토교통성 「屋内地図オープンデータ」에 시부야역은 포함되어 있지 않고,
 * 「歩行空間ネットワークデータ(渋谷地区)」는 전 노드가 옥외(in_out=1)다.
 * 즉 개찰·승강장·지하 연락통로를 담은 공식 오픈데이터가 존재하지 않는다.
 *
 * ── 어떻게 만들었나
 * 좌표는 가능한 한 실측 데이터에 앵커링했다.
 *   · 승강장 중심선 → OSM `railway=platform` 폴리곤과 `railway=rail|subway` 선형
 *   · 개찰 위치     → OSM `train_station_entrance` / `indoor=corridor`(name=○○改札)
 *   · 그 밖         → 각 사업자 공개 구내도를 참고한 근사값
 * ── 무엇으로 대조했나 (2026-08-31 기준)
 * 링크(무엇과 무엇이 이어지는가)는 각 사업자 공개 구내도로 한 건씩 확인했다.
 *   · 東急·東京メトロ 지하 구간 → 「東横線・田園都市線渋谷駅立体図」 2026-08-21판
 *   · 京王 井の頭線            → 「渋谷駅階層図」 2026-03판 · 京王 배리어프리 설비 안내
 *   · JR 개찰 구성·이설        → JR 東日本 공개 정보 및 이설 보도(2024-07-21 신남개찰,
 *                                2025-01-26 하치코개찰, 2021-10-10 중앙개찰 통합)
 *   · 데크·자유통로            → 東急·東京メトロ 보도자료, 시부야경제신문 보도
 * 승강장·개찰의 층 번호는 OSM 의 level 태그와 전부 일치함을 확인했다.
 *
 * 따라서 **공식 데이터가 아니다.** 모든 피처는 provenance='curated' 로 표시되며
 * UI 에서 공식 레이어와 구분해 보여준다.
 *
 * 층 번호는 일본식(1F=1, B1=-1). OSM 의 level 태그 관례와 맞춰 두었다.
 */
import type { LinkKind, Operator, PlaceKind } from '~/lib/types';

export interface CuratedPlace {
  id: string;
  name: string;
  nameJa: string;
  kind: PlaceKind;
  operator: Operator;
  level: number;
  /** 대표점 [lat, lon] */
  at: [number, number];
  /** 선형 피처의 중심선 [[lat, lon], ...] */
  line?: [number, number][];
  /** 통로/승강장 폭(m) */
  width?: number;
  desc?: string;
  planned?: boolean;
  /**
   * 개찰 안쪽(유료 구역)인가.
   * 승강장과 개찰 안 콘코스만 true 다. 개찰 자체는 경계이므로 false.
   * 이 표시를 바탕으로 각 링크가 개찰 안/밖 중 어디를 지나는지 정한다.
   */
  paid?: boolean;
  tags?: Record<string, string>;
}

export interface CuratedLink {
  /** 지점 id. 건물처럼 층마다 접속점이 있는 경우 `bldg-hikarie@-3` 로 층을 지정한다. */
  from: string;
  to: string;
  kind: LinkKind;
  /** 생략하면 두 지점의 평면거리로 계산 */
  distance?: number;
  barrierFree?: boolean;
  note?: string;
  planned?: boolean;
}

/* ------------------------------------------------------------------ 승강장 */

const platforms: CuratedPlace[] = [
  {
    id: 'plat-jr-yamanote',
    paid: true,
    name: 'JR 야마노테선 승강장',
    nameJa: 'JR山手線ホーム',
    kind: 'platform',
    operator: 'jr',
    level: 2,
    at: [35.65845, 139.70156],
    line: [
      [35.65745, 139.70206],
      [35.65810, 139.70170],
      [35.65880, 139.70136],
      [35.65945, 139.70131],
    ],
    width: 12,
    desc: '1·2번선 섬식. 시부야역의 남북 중심축이며, 선형은 OSM 山手線 궤도 데이터에서 따왔다.',
    tags: { 번선: '1·2', 형식: '섬식 1면 2선' },
  },
  {
    id: 'plat-jr-saikyo',
    paid: true,
    name: 'JR 사이쿄선·쇼난신주쿠라인 승강장',
    nameJa: 'JR埼京線・湘南新宿ラインホーム',
    kind: 'platform',
    operator: 'jr',
    level: 2,
    at: [35.65845, 139.70173],
    line: [
      [35.65748, 139.70223],
      [35.65812, 139.70187],
      [35.65882, 139.70152],
      [35.65946, 139.70147],
    ],
    width: 11,
    desc: '2020년 6월 1일 야마노테선 옆으로 이설. 그 전에는 남쪽으로 약 350m 떨어져 있었다.',
    tags: { 번선: '3·4', 이설: '2020-06-01' },
  },
  {
    id: 'plat-ginza',
    paid: true,
    name: '긴자선 승강장',
    nameJa: '銀座線ホーム',
    kind: 'platform',
    operator: 'metro',
    level: 3,
    at: [35.65904, 139.70262],
    line: [
      [35.65898, 139.70213],
      [35.65904, 139.70262],
      [35.65909, 139.70311],
    ],
    width: 14,
    desc: '지상 3층 고가. M자 아치 지붕의 섬식 1면 2선. 2020년 1월 3일 동쪽으로 약 130m 이설됐다.',
    tags: { 이설: '2020-01-03', 형식: '섬식 1면 2선' },
  },
  {
    id: 'plat-dt-hanzomon',
    paid: true,
    name: '덴엔토시선·한조몬선 승강장',
    nameJa: '田園都市線・半蔵門線ホーム',
    kind: 'platform',
    operator: 'tokyu',
    level: -3,
    at: [35.6595, 139.70149],
    line: [
      [35.65952, 139.70035],
      [35.6595, 139.70149],
      [35.65948, 139.70262],
    ],
    width: 17,
    desc: '지하 3층 섬식 1면 2선. 동서 방향이라 남북 방향인 JR과 직각으로 교차한다. 개찰 안에서 도요코·후쿠토신선 콘코스로 이어진다.',
    tags: { 번선: '1·2' },
  },
  {
    id: 'plat-toyoko-fukutoshin-34',
    paid: true,
    name: '도요코선·후쿠토신선 3·4번선 승강장',
    nameJa: '東横線・副都心線 3・4番線ホーム',
    kind: 'platform',
    operator: 'tokyu',
    level: -5,
    at: [35.65881, 139.70276],
    line: [
      [35.65818, 139.70279],
      [35.65881, 139.70276],
      [35.65943, 139.70272],
    ],
    width: 10,
    desc: '지하 5층. 메이지도리 아래를 따라 남북으로 뻗어 있다. 시부야역에서 가장 깊은 층.',
  },
  {
    id: 'plat-toyoko-fukutoshin-56',
    paid: true,
    name: '도요코선·후쿠토신선 5·6번선 승강장',
    nameJa: '東横線・副都心線 5・6番線ホーム',
    kind: 'platform',
    operator: 'tokyu',
    level: -5,
    at: [35.65877, 139.70259],
    line: [
      [35.65815, 139.70262],
      [35.65877, 139.70259],
      [35.65939, 139.70255],
    ],
    width: 10,
    desc: '지하 5층. 3·4번선과 나란한 두 번째 섬식 승강장.',
  },
  {
    id: 'plat-inokashira',
    paid: true,
    name: '이노카시라선 승강장',
    nameJa: '京王井の頭線ホーム',
    kind: 'platform',
    operator: 'keio',
    level: 2,
    at: [35.65833, 139.69853],
    line: [
      [35.65836, 139.69793],
      [35.65833, 139.69853],
      [35.6583, 139.69913],
    ],
    width: 20,
    desc: '마크시티 안 2층. 하차 전용 승강장을 포함해 두 면이며, 다른 노선과 떨어져 있어 환승 시 마크시티 자유통로를 지난다.',
  },
];

/* -------------------------------------------------------------------- 개찰 */

const gates: CuratedPlace[] = [
  {
    id: 'gate-jr-chuo',
    name: 'JR 중앙개찰',
    nameJa: 'JR中央改札',
    kind: 'gate',
    operator: 'jr',
    level: 3,
    at: [35.65862, 139.70149],
    desc: '선로 위 교상 개찰. 2021년 10월 10일 옛 중앙개찰이 폐지되고 2020년 1월 신설된 중앙동개찰과 통합돼 지금 자리로 옮겼다. 스크램블스퀘어 입구, 긴자선 개찰, 서측 데크로 각각 바로 이어지는 사실상의 메인 게이트.',
    tags: { 통합: '2021-10-10' },
  },
  {
    id: 'gate-jr-hachiko',
    name: 'JR 하치코개찰',
    nameJa: 'JRハチ公改札',
    kind: 'gate',
    operator: 'jr',
    level: 1,
    at: [35.65929, 139.70133],
    desc: '2025년 1월 26일 이설. 하치코 광장에 면한 출입구와 교번 옆 출입구를 폐지하고, 하치코구치–미야마스자카구치를 잇는 1층 동서 연락통로에 면해 새로 냈다. 종전보다 미야마스자카(동) 쪽이며 자동개찰기는 17대에서 14대로 줄었다. 통로는 중앙에 칸막이를 두어 일방통행이라, 개찰을 나오면 하치코 쪽으로 나가고 반대로 들어갈 때는 동쪽 끝까지 갔다가 U턴해야 한다. 좌표는 OSM 동서 연락통로(level=1) 선형 위.',
    tags: { 이설: '2025-01-26', 개찰기: '14대', 제약: '통로 일방통행' },
  },
  {
    id: 'gate-jr-minami',
    name: 'JR 남개찰',
    nameJa: 'JR南改札',
    kind: 'gate',
    operator: 'jr',
    level: 1,
    at: [35.65782, 139.70168],
    desc: '지상 남쪽 개찰. 시부야 스트림·시부야 브리지 방면. 좌표는 OSM indoor room(name=南改札)에서 가져왔다.',
  },
  {
    id: 'gate-jr-shinminami',
    name: 'JR 신남개찰',
    nameJa: 'JR新南改札',
    kind: 'gate',
    operator: 'jr',
    level: 3,
    at: [35.65714, 139.70232],
    desc: '2024년 7월 21일 새 교상역사로 이전. 원래 위치보다 400m 북쪽으로 올라와 남측 북쪽 자유통로에 면한다.',
    tags: { 이전: '2024-07-21' },
  },
  {
    id: 'gate-gz-scramble',
    name: '긴자선 스크램블스퀘어 방면 개찰',
    nameJa: '銀座線スクランブルスクエア方面改札',
    kind: 'gate',
    operator: 'metro',
    level: 3,
    at: [35.65899, 139.70208],
    desc: '승강장과 같은 3층. 층 이동 없이 JR 중앙개찰까지 갈 수 있어 JR 환승 최단 경로.',
  },
  {
    id: 'gate-gz-hikarie',
    name: '긴자선 히카리에 방면 개찰',
    nameJa: '銀座線ヒカリエ方面改札',
    kind: 'gate',
    operator: 'metro',
    level: 2,
    at: [35.65912, 139.70318],
    desc: 'IC카드 전용. 승강장에서 한 층 내려간다.',
    tags: { 제약: 'IC카드 전용' },
  },
  {
    id: 'gate-gz-meiji',
    name: '긴자선 메이지도리 방면 개찰',
    nameJa: '銀座線明治通り方面改札',
    kind: 'gate',
    operator: 'metro',
    level: 1,
    at: [35.65915, 139.70336],
    desc: '지상 1층. 도요코·후쿠토신·한조몬선 환승 방면.',
  },
  {
    id: 'gate-ty-hikarie1',
    name: '시부야히카리에 1개찰',
    nameJa: '渋谷ヒカリエ1改札',
    kind: 'gate',
    operator: 'tokyu',
    level: -3,
    at: [35.65852, 139.70307],
    desc: '다이칸야마 방면 쪽 지하 3층. 히카리에·스크램블스퀘어와 지하로 직결되며 JR·긴자선 환승에 쓰인다.',
  },
  {
    id: 'gate-ty-hikarie2',
    name: '시부야히카리에 2개찰',
    nameJa: '渋谷ヒカリエ2改札',
    kind: 'gate',
    operator: 'tokyu',
    level: -3,
    at: [35.65844, 139.70318],
    desc: '1개찰 바로 앞. 사실상 어느 쪽을 써도 무방하다.',
  },
  {
    id: 'gate-ty-miyachuo',
    name: '미야마스자카 중앙개찰',
    nameJa: '宮益坂中央改札',
    kind: 'gate',
    operator: 'tokyu',
    level: -2,
    at: [35.65932, 139.70213],
    desc: '부채꼴 모양의 대형 개찰. 도요코·후쿠토신선과 덴엔토시·한조몬선이 공용해 상시 혼잡하다.',
  },
  {
    id: 'gate-ty-miyahigashi',
    name: '미야마스자카 동개찰',
    nameJa: '宮益坂東改札',
    kind: 'gate',
    operator: 'tokyu',
    level: -2,
    at: [35.65946, 139.70275],
    desc: '지하 2층 동쪽. 미야마스자카·아오야마 방면 출구와 가깝다.',
  },
  {
    id: 'gate-dt-hachiko',
    name: '하치코개찰 (지하)',
    nameJa: 'ハチ公改札',
    kind: 'gate',
    operator: 'tokyu',
    level: -2,
    at: [35.65937, 139.70073],
    desc: '지하 2층. 하치코 광장·스크램블 교차로 방면 지상 출구와 가장 가깝다. JR 하치코개찰과는 이름만 같고 다른 개찰이다.',
  },
  {
    id: 'gate-dt-dogenzaka',
    name: '도겐자카개찰',
    nameJa: '道玄坂改札',
    kind: 'gate',
    operator: 'tokyu',
    level: -2,
    at: [35.65926, 139.70004],
    desc: '지하 2층 서쪽. 도겐자카·시부치카·마크시티 방면.',
  },
  {
    id: 'gate-keio-chuo',
    name: '게이오 중앙 출입구',
    nameJa: '京王中央口',
    kind: 'gate',
    operator: 'keio',
    level: 2,
    at: [35.65882, 139.69967],
    desc: '승강장과 같은 2층. 마크시티 EAST 2층에 직결되고, 여기서 자유통로를 따라 하치코 광장으로 나간다. 좌표는 OSM indoor corridor(name=中央改札).',
  },
  {
    id: 'gate-keio-nishi',
    name: '게이오 서 출입구',
    nameJa: '京王西口',
    kind: 'gate',
    operator: 'keio',
    level: 1,
    at: [35.65831, 139.69841],
    desc: '지상 1층. 서측 로터리·버스 정류장 방면.',
  },
  {
    id: 'gate-keio-avenue',
    name: '게이오 아베뉴 출입구',
    nameJa: '京王アベニュー口',
    kind: 'gate',
    operator: 'keio',
    level: 4,
    at: [35.65836, 139.69849],
    desc: '마크시티 WEST 4층 직결. 고속버스 터미널(5층)로 갈 때 쓰며 통행 가능 시간은 07:30–22:00.',
    tags: { 통행시간: '07:30–22:00' },
  },
];

/* ------------------------------------------------------- 광장 · 콘코스 */

const spaces: CuratedPlace[] = [
  {
    id: 'plaza-hachiko',
    name: '하치코 광장',
    nameJa: 'ハチ公広場',
    kind: 'plaza',
    operator: 'facility',
    level: 1,
    at: [35.65922, 139.70102],
    desc: '스크램블 교차로와 맞닿은 지상 광장. 시부야 동선의 상당 부분이 이 지상 레벨에 몰려 혼잡의 원인이 된다.',
  },
  {
    id: 'plaza-shibuchika',
    name: '시부치카 지하상가',
    nameJa: 'しぶちか',
    kind: 'plaza',
    operator: 'facility',
    level: -1,
    at: [35.6591, 139.70005],
    desc: '지하 1층 상가. 지하 2층 도겐자카·하치코개찰과 지상 도겐자카 방면을 잇는 완충 공간.',
  },
  {
    id: 'plaza-east-underground',
    name: '동측 지하광장',
    nameJa: '渋谷駅東口地下広場',
    kind: 'plaza',
    operator: 'facility',
    level: -2,
    at: [35.6589, 139.70265],
    desc: '미야마스자카 개찰·히카리에 개찰·스크램블스퀘어 지하를 잇는 지하 광장. 지상 메이지도리를 건너지 않고 동서로 이동할 수 있다.',
  },
  {
    id: 'conc-b4-transfer',
    paid: true,
    name: '지하 4층 환승 콘코스',
    nameJa: '地下4階乗換コンコース',
    kind: 'plaza',
    operator: 'tokyu',
    level: -4,
    at: [35.6592, 139.70255],
    desc: '덴엔토시·한조몬선(B3)과 도요코·후쿠토신선(B5)을 개찰 안에서 잇는 중간층 콘코스.',
  },
];

/* ------------------------------------------------------------------ 연락통로 */

const passages: CuratedPlace[] = [
  {
    id: 'pass-nishi-deck',
    name: '서측 연락통로 (시부니시 데크)',
    nameJa: '西口連絡通路・しぶにしデッキ',
    kind: 'passage',
    operator: 'passage',
    level: 2,
    at: [35.65845, 139.70055],
    line: [
      [35.65879, 139.70039],
      [35.65867, 139.70041],
      [35.65853, 139.70047],
      [35.65839, 139.70052],
      [35.65835, 139.70082],
      [35.65840, 139.70096],
      [35.65845, 139.70103],
    ],
    width: 10,
    desc: '2020년 9월 26일 공용 개시. 시부야역과 후쿠라스를 지상 2층 레벨로 연결한다. 이 데크가 열리면서 옛 도큐백화점 도요코점 안 통로와 JR 다마가와개찰이 폐쇄됐다. 북쪽 끝은 마크시티 자유통로의 오카모토 다로 벽화 「내일의 신화」 아래에 뚫은 개구부로, 동쪽 끝은 JR 중앙개찰 대계단 앞으로 이어진다. 하치코 광장으로는 직접 내려가는 수단이 없고 마크시티 자유통로를 거쳐야 한다. 선형은 OSM `しぶにしデッキ` 에서 가져왔다.',
    tags: { 공용개시: '2020-09-26' },
  },
  {
    id: 'pass-markcity-free',
    name: '마크시티 자유통로',
    nameJa: 'マークシティ自由通路',
    kind: 'passage',
    operator: 'passage',
    level: 2,
    at: [35.65896, 139.70035],
    line: [
      [35.65882, 139.69967],
      [35.65896, 139.70035],
      [35.65913, 139.70092],
    ],
    width: 9,
    desc: '마크시티 2층 EAST 와 게이오 중앙 출입구를 직결. 여기서 하치코 광장 쪽으로 내려간다.',
  },
  {
    id: 'pass-nishi-hodo',
    name: '시부야역 서측 육교',
    nameJa: '渋谷駅西口歩道橋',
    kind: 'passage',
    operator: 'passage',
    level: 2,
    at: [35.65726, 139.70097],
    line: [
      [35.65803, 139.70043],
      [35.65763, 139.70073],
      [35.65726, 139.70097],
      [35.65700, 139.70110],
    ],
    width: 6,
    desc: '국토교통성이 재정비한 육교. 후쿠라스 내부 통로를 지나 이 육교를 건너면 사쿠라가오카·사쿠라스테이지 방면으로 간다.',
  },
  {
    id: 'pass-minami-kita-jiyu',
    name: '남측 북쪽 자유통로',
    nameJa: '渋谷駅南口北側自由通路',
    kind: 'passage',
    operator: 'passage',
    level: 3,
    at: [35.65718, 139.70206],
    line: [
      [35.65722, 139.70149],
      [35.65718, 139.70206],
      [35.65714, 139.70262],
    ],
    width: 8,
    desc: 'JR 선로 위를 3층 레벨로 가로지르는 자유통로. 서쪽은 사쿠라스테이지, 동쪽은 시부야 스트림에 접속한다. 2023년 12월 1일 잠정 공용, 통행 05:30–23:30.',
    tags: { 공용개시: '2023-12-01', 통행시간: '05:30–23:30' },
  },
  {
    id: 'pass-minami-kosen',
    name: '남측 육교 (남쪽 과선인도교)',
    nameJa: '渋谷駅南跨線人道橋',
    kind: 'passage',
    operator: 'passage',
    level: 3,
    at: [35.65648, 139.70255],
    line: [
      [35.65652, 139.70202],
      [35.65648, 139.70255],
      [35.65644, 139.70308],
    ],
    width: 6,
    desc: '사쿠라스테이지 남단과 시부야 3초메(호텔 메츠) 방면을 잇는다. 통행 05:30–24:30 으로 북측 자유통로보다 한 시간 길다.',
    tags: { 공용개시: '2023-12-01', 통행시간: '05:30–24:30' },
  },
  {
    id: 'pass-ss-stream',
    name: '스크램블스퀘어–스트림 연결데크',
    nameJa: 'ストリーム接続デッキ',
    kind: 'passage',
    operator: 'passage',
    level: 3,
    at: [35.65783, 139.70298],
    line: [
      [35.65818, 139.70281],
      [35.65783, 139.70298],
      [35.65748, 139.70316],
    ],
    width: 10,
    desc: '스크램블스퀘어 동동과 시부야 스트림을 잇는 넓은 데크.',
  },
  {
    id: 'pass-ss-hikarie',
    name: '스크램블스퀘어–히카리에 연결통로',
    nameJa: 'ヒカリエ連絡通路',
    kind: 'passage',
    operator: 'passage',
    level: 2,
    at: [35.65866, 139.70311],
    line: [
      [35.65869, 139.70281],
      [35.65866, 139.70311],
      [35.65863, 139.70341],
    ],
    width: 7,
    desc: '2층 레벨 연결통로. 히카리에 앞 메이지도리는 지상 횡단이 불가능한 구간이 있어 지하로 내려가거나 이 데크로 올라가야 건널 수 있다.',
  },
];

/* --------------------------------------------------------------- 공사 중 */

const planned: CuratedPlace[] = [
  {
    id: 'plan-skyway',
    name: '동측 4층 스카이웨이 (공사중)',
    nameJa: '東口4階スカイウェイ',
    kind: 'passage',
    operator: 'passage',
    level: 4,
    at: [35.65893, 139.70235],
    line: [
      [35.65885, 139.70160],
      [35.65893, 139.70235],
      [35.65900, 139.70310],
    ],
    width: 8,
    planned: true,
    desc: '긴자선 승강장 지붕 위를 지나는 전장 약 115m·폭 약 8m 의 공중 보행 데크. 완성되면 스크램블스퀘어 중앙동 4층과 서측 어반코어에 접속해 하치코 광장·마크시티까지 한 번에 이어진다. 2030년도 공용 개시 목표.',
    tags: { 목표: '2030년도' },
  },
  {
    id: 'plan-hikarie-deck',
    name: '히카리에 데크 (공사중)',
    nameJa: 'ヒカリエデッキ',
    kind: 'passage',
    operator: 'passage',
    level: 4,
    at: [35.65903, 139.70334],
    planned: true,
    desc: '히카리에 4층 북측, 긴자선 바로 위에 설치되는 데크. 스카이웨이 동서 축의 동쪽 끝이다.',
  },
  {
    id: 'plan-urban-core-west',
    name: '서측 어반코어 (공사중)',
    nameJa: '西口アーバン・コア',
    kind: 'passage',
    operator: 'passage',
    level: 4,
    at: [35.65888, 139.70120],
    planned: true,
    desc: '하치코 광장 지상과 중앙동 4층을 잇는 에스컬레이터·엘리베이터 수직 이동축. 시부야 특유의 고저차를 해소하는 장치로 중앙동과 함께 2031년도 완성 예정이다.',
    tags: { 목표: '2031년도' },
  },
  {
    id: 'plan-ss-central-west',
    name: '스크램블스퀘어 중앙동·서동 (공사중)',
    nameJa: '渋谷スクランブルスクエア 中央棟・西棟',
    kind: 'building',
    operator: 'facility',
    level: 4,
    at: [35.65875, 139.70143],
    planned: true,
    desc: '제2기 공사. 완성되면 JR 시부야역 바로 위 중앙동 4층이 스카이웨이·서측 어반코어와 접속한다. 2030년도에 JR 개찰·콘코스 정비가 끝나면서 3층에 폭 20m 초과의 동서 자유통로가 생기고, 중앙동·서동은 2031년도 완성, 하치코 광장을 포함한 역 주변 전체 완성은 2034년도 예정이다.',
    tags: { 목표: '2031년도', 동서자유통로: '2030년도', 전체완성: '2034년도' },
  },
];

export const CURATED_PLACES: CuratedPlace[] = [
  ...platforms,
  ...gates,
  ...spaces,
  ...passages,
  ...planned,
];

/* -------------------------------------------------------------------- 연결 */

export const CURATED_LINKS: CuratedLink[] = [
  // JR 개찰 안
  { from: 'plat-jr-yamanote', to: 'gate-jr-chuo', kind: 'escalator', note: '2F → 3F 에스컬레이터' },
  { from: 'plat-jr-yamanote', to: 'gate-jr-hachiko', kind: 'stairs', note: '2F → 1F 계단' },
  { from: 'plat-jr-yamanote', to: 'gate-jr-minami', kind: 'stairs', note: '남쪽 끝 계단' },
  { from: 'plat-jr-saikyo', to: 'gate-jr-chuo', kind: 'escalator' },
  { from: 'plat-jr-saikyo', to: 'gate-jr-minami', kind: 'stairs' },
  { from: 'plat-jr-saikyo', to: 'gate-jr-shinminami', kind: 'escalator', note: '남쪽 끝' },
  { from: 'plat-jr-yamanote', to: 'gate-jr-shinminami', kind: 'escalator', note: '남쪽 끝' },
  { from: 'plat-jr-yamanote', to: 'plat-jr-saikyo', kind: 'transfer', distance: 20, note: '개찰 안 나란히' },

  // 긴자선
  { from: 'plat-ginza', to: 'gate-gz-scramble', kind: 'walk' },
  { from: 'plat-ginza', to: 'gate-gz-hikarie', kind: 'escalator', note: '3F → 2F' },
  { from: 'plat-ginza', to: 'gate-gz-meiji', kind: 'escalator', note: '3F → 1F' },

  // 도요코 · 후쿠토신
  { from: 'plat-toyoko-fukutoshin-34', to: 'conc-b4-transfer', kind: 'escalator', note: 'B5 → B4' },
  { from: 'plat-toyoko-fukutoshin-56', to: 'conc-b4-transfer', kind: 'escalator', note: 'B5 → B4' },
  { from: 'plat-toyoko-fukutoshin-34', to: 'plat-toyoko-fukutoshin-56', kind: 'transfer', distance: 16 },
  { from: 'conc-b4-transfer', to: 'plat-dt-hanzomon', kind: 'escalator', note: 'B4 → B3, 개찰 안 환승' },
  { from: 'conc-b4-transfer', to: 'gate-ty-hikarie1', kind: 'escalator', note: 'B4 → B3' },
  { from: 'conc-b4-transfer', to: 'gate-ty-hikarie2', kind: 'escalator', note: 'B4 → B3' },
  { from: 'conc-b4-transfer', to: 'gate-ty-miyachuo', kind: 'escalator', note: 'B4 → B2' },
  { from: 'conc-b4-transfer', to: 'gate-ty-miyahigashi', kind: 'escalator', note: 'B4 → B2' },

  // 덴엔토시 · 한조몬
  { from: 'plat-dt-hanzomon', to: 'gate-dt-hachiko', kind: 'escalator', note: 'B3 → B2' },
  { from: 'plat-dt-hanzomon', to: 'gate-dt-dogenzaka', kind: 'escalator', note: 'B3 → B2' },
  { from: 'plat-dt-hanzomon', to: 'gate-ty-miyachuo', kind: 'escalator', note: 'B3 → B2, 공용 개찰' },

  // 이노카시라선
  { from: 'plat-inokashira', to: 'gate-keio-chuo', kind: 'walk' },
  { from: 'plat-inokashira', to: 'gate-keio-nishi', kind: 'stairs', note: '2F → 1F' },
  { from: 'plat-inokashira', to: 'gate-keio-avenue', kind: 'escalator', note: '2F → 4F' },

  // 개찰 밖 — 지상·데크
  { from: 'gate-jr-hachiko', to: 'plaza-hachiko', kind: 'walk', distance: 60, note: '동서 연락통로 서쪽 끝으로' },
  { from: 'gate-keio-chuo', to: 'pass-markcity-free', kind: 'walk' },
  { from: 'pass-markcity-free', to: 'plaza-hachiko', kind: 'escalator', note: '2F → 1F' },
  { from: 'gate-jr-chuo', to: 'pass-nishi-deck', kind: 'escalator', note: '3F → 2F' },
  { from: 'pass-markcity-free', to: 'pass-nishi-deck', kind: 'walk', note: '「내일의 신화」 벽화 아래 개구부 — 같은 2층 평면' },
  { from: 'pass-nishi-deck', to: 'pass-nishi-hodo', kind: 'walk', note: '후쿠라스 내부 통로 경유' },
  { from: 'gate-jr-shinminami', to: 'pass-minami-kita-jiyu', kind: 'walk', note: '개찰 정면' },
  { from: 'pass-minami-kita-jiyu', to: 'pass-ss-stream', kind: 'walk', note: '스트림 3층' },
  { from: 'pass-minami-kita-jiyu', to: 'pass-minami-kosen', kind: 'walk', distance: 90, note: '사쿠라스테이지 내부 3층 경유' },
  { from: 'pass-nishi-hodo', to: 'pass-minami-kita-jiyu', kind: 'escalator', note: '사쿠라스테이지 2F → 3F' },
  { from: 'gate-gz-scramble', to: 'gate-jr-chuo', kind: 'walk', note: '같은 3층, 바로 옆' },
  { from: 'gate-gz-hikarie', to: 'pass-ss-hikarie', kind: 'walk' },

  // 개찰 밖 — 지하
  { from: 'gate-dt-hachiko', to: 'plaza-shibuchika', kind: 'stairs', note: 'B2 → B1 계단' },
  { from: 'gate-dt-dogenzaka', to: 'plaza-shibuchika', kind: 'stairs', note: 'B2 → B1 계단' },
  { from: 'plaza-shibuchika', to: 'plaza-hachiko', kind: 'stairs', distance: 120, note: '출구 A7·A8(하치코 앞 교차로) 경유. 하치코개찰 앞 시부치카 계단은 2025-01-26 폐쇄, 2028년 봄 에스컬레이터로 부활 예정' },
  { from: 'gate-ty-miyachuo', to: 'plaza-east-underground', kind: 'walk' },
  { from: 'gate-ty-miyahigashi', to: 'plaza-east-underground', kind: 'walk' },
  { from: 'gate-ty-hikarie1', to: 'plaza-east-underground', kind: 'escalator', note: 'B3 → B2' },
  { from: 'gate-ty-hikarie2', to: 'plaza-east-underground', kind: 'escalator', note: 'B3 → B2' },
  { from: 'gate-gz-meiji', to: 'plaza-east-underground', kind: 'escalator', note: '1F → B2' },

  /*
   * 엘리베이터. 각 사업자가 공표한 배리어프리 경로(엘리베이터로 지상까지
   * 이동 가능한 경로)를 기준으로 넣었다. 배리어프리 탐색은 이 링크들만 쓴다.
   */
  { from: 'plat-jr-yamanote', to: 'gate-jr-minami', kind: 'elevator', note: '2F ↔ 1F 엘리베이터. 야마노테선 홈에서 엘리베이터로 직접 갈 수 있는 개찰은 여기뿐이고, 중앙개찰은 사이쿄선 홈을 거쳐야 한다' },
  { from: 'plat-jr-saikyo', to: 'gate-jr-chuo', kind: 'elevator', note: '2F ↔ 3F 엘리베이터' },
  { from: 'plat-jr-saikyo', to: 'gate-jr-shinminami', kind: 'elevator', note: '남쪽 끝 엘리베이터' },
  { from: 'plat-ginza', to: 'gate-gz-meiji', kind: 'elevator', note: '3F ↔ 1F 엘리베이터' },
  { from: 'plat-dt-hanzomon', to: 'gate-ty-miyachuo', kind: 'elevator', note: 'B3 ↔ B2 엘리베이터' },
  { from: 'plat-toyoko-fukutoshin-34', to: 'conc-b4-transfer', kind: 'elevator', note: 'B5 ↔ B4 엘리베이터' },
  { from: 'plat-toyoko-fukutoshin-56', to: 'conc-b4-transfer', kind: 'elevator', note: 'B5 ↔ B4 엘리베이터' },
  { from: 'conc-b4-transfer', to: 'gate-ty-miyachuo', kind: 'elevator', note: 'B4 ↔ B2 엘리베이터' },
  { from: 'conc-b4-transfer', to: 'gate-ty-hikarie1', kind: 'elevator', note: 'B4 ↔ B3 엘리베이터' },
  { from: 'plat-toyoko-fukutoshin-34', to: 'gate-ty-miyachuo', kind: 'elevator', note: 'B5 ↔ B2 직통 엘리베이터' },
  { from: 'plat-toyoko-fukutoshin-56', to: 'gate-ty-miyachuo', kind: 'elevator', note: 'B5 ↔ B2 직통 엘리베이터' },
  { from: 'plat-toyoko-fukutoshin-34', to: 'gate-ty-hikarie1', kind: 'elevator', note: 'B5 ↔ B3 엘리베이터' },
  { from: 'plat-toyoko-fukutoshin-56', to: 'gate-ty-hikarie1', kind: 'elevator', note: 'B5 ↔ B3 엘리베이터' },
  { from: 'gate-ty-miyachuo', to: 'plaza-east-underground', kind: 'elevator', note: 'B2 지하광장 엘리베이터' },
  { from: 'plaza-east-underground', to: 'gate-gz-meiji', kind: 'elevator', note: 'B2 ↔ 동측 지상 엘리베이터' },
  { from: 'gate-jr-hachiko', to: 'plaza-hachiko', kind: 'elevator', distance: 60, note: '같은 지상 레벨' },
  { from: 'gate-keio-chuo', to: 'pass-markcity-free', kind: 'elevator', note: '마크시티 2F 평면' },
  { from: 'pass-markcity-free', to: 'plaza-hachiko', kind: 'elevator', note: '마크시티 2F ↔ 하치코 광장 엘리베이터' },
  { from: 'gate-jr-chuo', to: 'pass-nishi-deck', kind: 'elevator', note: '3F ↔ 2F 엘리베이터' },
  { from: 'gate-jr-shinminami', to: 'pass-minami-kita-jiyu', kind: 'elevator', note: '개찰 정면 평면' },

  /*
   * 주요 건물과 역의 접속. 건물 지점은 OSM 발자국의 중심점이라 거리가
   * 실제 개찰~입구 도보 거리와 정확히 같지는 않지만, 접속 관계 자체는 실제다.
   */
  { from: 'bldg-scramble-square@3', to: 'gate-jr-chuo', kind: 'walk', note: '3층 직결' },
  { from: 'bldg-scramble-square@3', to: 'gate-gz-scramble', kind: 'walk', note: '3층 직결' },
  { from: 'bldg-scramble-square@3', to: 'pass-ss-stream', kind: 'walk', note: '3층 데크' },
  { from: 'bldg-scramble-square@2', to: 'pass-ss-hikarie', kind: 'walk', note: '2층 연결통로' },
  { from: 'bldg-scramble-square@-2', to: 'plaza-east-underground', kind: 'walk', note: '지하 2층 직결' },
  { from: 'bldg-hikarie@-3', to: 'gate-ty-hikarie1', kind: 'walk', note: '지하 3층 직결' },
  { from: 'bldg-hikarie@-3', to: 'gate-ty-hikarie2', kind: 'walk', note: '지하 3층 직결' },
  { from: 'bldg-hikarie@2', to: 'pass-ss-hikarie', kind: 'walk', note: '2층 연결통로' },
  { from: 'bldg-stream@3', to: 'pass-ss-stream', kind: 'walk', note: '3층 데크' },
  { from: 'bldg-stream@3', to: 'pass-minami-kita-jiyu', kind: 'walk', note: '자유통로 동쪽 끝' },
  { from: 'bldg-stream-hall@1', to: 'bldg-stream@1', kind: 'walk' },
  { from: 'bldg-fukuras@2', to: 'pass-nishi-deck', kind: 'walk', note: '2층 접속 데크' },
  { from: 'bldg-fukuras@2', to: 'pass-nishi-hodo', kind: 'walk', note: '건물 내부 통로' },
  { from: 'bldg-markcity-east@2', to: 'pass-markcity-free', kind: 'walk', note: '2층 자유통로' },
  { from: 'bldg-markcity-east@2', to: 'gate-keio-chuo', kind: 'walk', note: '중앙 출입구 직결' },
  { from: 'bldg-markcity-east@4', to: 'gate-keio-avenue', kind: 'walk', note: 'WEST 4층 아베뉴 출입구' },
  { from: 'bldg-sakura-shibuya@3', to: 'pass-minami-kita-jiyu', kind: 'walk', note: '자유통로 서쪽 끝' },
  { from: 'bldg-sakura-shibuya@3', to: 'pass-minami-kosen', kind: 'walk', note: '남쪽 육교 서쪽 끝' },
  { from: 'bldg-sakura-central@3', to: 'bldg-sakura-shibuya@3', kind: 'walk' },
  { from: 'bldg-sakura-central@3', to: 'bldg-sakura-sakura@3', kind: 'walk' },
  { from: 'bldg-station-shinminami@3', to: 'gate-jr-shinminami', kind: 'walk' },
  { from: 'bldg-station-main@1', to: 'gate-jr-hachiko', kind: 'walk' },
  { from: 'bldg-station-main@1', to: 'plaza-hachiko', kind: 'walk' },
  { from: 'bldg-station-main@2', to: 'pass-nishi-deck', kind: 'walk', note: '2층 서측 데크' },
  { from: 'bldg-station-main@3', to: 'gate-jr-chuo', kind: 'walk', note: '3층 중앙개찰' },

  // 공사 중 (기본 경로 탐색에서 제외)
  { from: 'plan-skyway', to: 'plan-hikarie-deck', kind: 'walk', planned: true },
  { from: 'plan-skyway', to: 'plan-ss-central-west', kind: 'walk', planned: true },
  { from: 'plan-ss-central-west', to: 'plan-urban-core-west', kind: 'walk', planned: true },
  { from: 'plan-urban-core-west', to: 'plaza-hachiko', kind: 'elevator', planned: true, note: '1F ↔ 4F 수직 이동축' },
  { from: 'plan-ss-central-west', to: 'gate-jr-chuo', kind: 'escalator', planned: true },
];
