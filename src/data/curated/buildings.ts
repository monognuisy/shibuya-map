/**
 * 시부야역 주변 주요 건물.
 *
 * 형상·높이·층수는 **OpenStreetMap 의 실제 건물 폴리곤**을 그대로 쓴다.
 * 이 표는 거기에 한국어 이름과 설명·역과의 접속 관계만 덧붙인다.
 * `match` 는 OSM `name` 태그와 정확히 일치해야 한다.
 */
export interface Landmark {
  /** OSM name 태그 */
  match: string;
  id: string;
  name: string;
  /**
   * 이 건물이 바깥(역·데크·지상)과 이어지는 층.
   *
   * 건물을 1층짜리 점으로 두면 3층 데크에서 들어와 지하 개찰로 나가는 동선이
   * 표현되지 않는다. 선언한 층마다 노드를 하나씩 만들고 그 사이를 건물 내부
   * 수직 동선(엘리베이터·에스컬레이터)으로 잇는다. 첫 값이 대표 층이다.
   */
  connectLevels: number[];
  desc?: string;
  tags?: Record<string, string>;
}

export const LANDMARKS: Landmark[] = [
  {
    match: '渋谷スクランブルスクエア',
    id: 'bldg-scramble-square',
    connectLevels: [3, 2, 1, -2],
    name: '시부야 스크램블스퀘어 동동',
    desc: '2019년 11월 1일 개업, 지상 47층 229.7m. 옥상이 전망시설 SHIBUYA SKY. 지하 2층부터 지상 3층까지 여러 레벨에서 역과 직결되는 현재 시부야의 환승 허브다.',
    tags: { 개업: '2019-11-01', 높이: '229.7 m', 층수: '지상 47층' },
  },
  {
    match: '渋谷ヒカリエ',
    id: 'bldg-hikarie',
    connectLevels: [2, 1, -3],
    name: '시부야 히카리에',
    desc: '2012년 4월 26일 개업, 182.5m. 지하 3층에서 도요코선·후쿠토신선 개찰과 직결되고 2층 연결통로로 스크램블스퀘어와 이어진다. 4층 북측이 스카이웨이의 동쪽 기점이 된다.',
    tags: { 개업: '2012-04-26', 높이: '182.5 m', 층수: '지상 34층' },
  },
  {
    match: '渋谷ストリーム',
    id: 'bldg-stream',
    connectLevels: [3, 2, 1],
    name: '시부야 스트림',
    desc: '2018년 9월 13일 개업, 180m. 옛 도요코선 지상 승강장 자리에 세워졌다. 3층에서 남측 북쪽 자유통로를 통해 선로 건너 사쿠라스테이지까지, 2층에서 국도246호 횡단데크로 스크램블스퀘어까지 갈 수 있다.',
    tags: { 개업: '2018-09-13', 높이: '180 m', 층수: '지상 35층' },
  },
  {
    match: '渋谷ストリームホール',
    id: 'bldg-stream-hall',
    connectLevels: [1],
    name: '시부야 스트림 홀',
    desc: '시부야 스트림에 붙은 홀 동. 이나리바시 광장과 접한다.',
  },
  {
    match: '渋谷フクラス',
    id: 'bldg-fukuras',
    connectLevels: [2, 1, -1],
    name: '시부야 후쿠라스',
    desc: '2019년 12월 5일 개업, 도겐자카 1초메 재개발. 2020년 9월 26일 접속 데크가 열리면서 시부야역과 지상 2층 레벨로 이어졌고, 2024년 7월 21일 서구 지하보도가 열리면서 지하 1층에서도 이어졌다. 1층에 공항버스 터미널이 있다.',
    tags: { 개업: '2019-12-05', 높이: '104 m', 데크접속: '2020-09-26' },
  },
  {
    match: '渋谷マークシティEAST',
    id: 'bldg-markcity-east',
    connectLevels: [2, 1, 4],
    name: '시부야 마크시티 EAST',
    desc: '이노카시라선 승강장과 중앙 출입구를 품은 동. 2층 자유통로가 하치코 광장으로 이어지고, WEST 5층에는 고속버스 터미널이 있다.',
    tags: { 개업: '2000-04-07' },
  },
  {
    match: 'Shibuya Sakura Stage SHIBUYA Tower',
    id: 'bldg-sakura-shibuya',
    connectLevels: [3, 1, -1],
    name: '사쿠라스테이지 SHIBUYA 사이드 타워',
    desc: '사쿠라스테이지 중 선로에 가까운 동. 지상 39층 180m. 남측 북쪽 자유통로의 서쪽 끝이 이 건물 3층에, 서구 지하보도가 지하 1층 어반코어에 접속한다. 2023년 11월 30일 준공, 2024년 7월 단계 개업.',
    tags: { 준공: '2023-11-30', 높이: '180 m', 층수: '지상 39층' },
  },
  {
    match: 'Shibuya Sakura Stage SAKURA Tower',
    id: 'bldg-sakura-sakura',
    connectLevels: [3, 1],
    name: '사쿠라스테이지 SAKURA 사이드 타워',
    desc: '사쿠라가오카 쪽 동. 지상 30층 133m. 주거·업무 복합. SHIBUYA 사이드와 센트럴 빌딩을 거쳐 역으로 이어진다.',
    tags: { 준공: '2023-11-30', 높이: '133 m', 층수: '지상 30층' },
  },
  {
    match: '渋谷サクラステージ セントラルビル',
    id: 'bldg-sakura-central',
    connectLevels: [3, 1],
    name: '사쿠라스테이지 센트럴 빌딩',
    desc: '두 타워 사이를 잇는 중간 동. 사쿠라가오카 언덕의 고저차를 흡수하는 보행 축이 지난다.',
    tags: { 높이: '90 m' },
  },
  {
    match: '渋谷',
    id: 'bldg-station-main',
    connectLevels: [1, 2, 3],
    name: '시부야역 역사 (본체)',
    desc: 'JR·도쿄메트로·도큐가 겹쳐 있는 역사 본체. OSM 에서 building=train_station 으로 한 덩어리로 그려져 있다.',
  },
  {
    match: '渋谷駅新南口',
    id: 'bldg-station-shinminami',
    connectLevels: [3, 1],
    name: '시부야역 신남측 역사',
    desc: '2024년 7월 21일 신남개찰이 이전해 온 교상역사. 남측 교상역사 전면 개업은 2026년도 예정이다.',
    tags: { 이전: '2024-07-21' },
  },
  {
    match: 'JR 渋谷駅',
    id: 'bldg-jr-south',
    connectLevels: [1],
    name: 'JR 시부야역 (남측 역사)',
    desc: '남쪽 구역의 JR 역사 부분.',
  },
  {
    match: '渋谷アクシュ（SHIBUYA AXSH）',
    id: 'bldg-axsh',
    connectLevels: [1],
    name: '시부야 아쿠슈 (SHIBUYA AXSH)',
    desc: '2024년 7월 개업. 미야마스자카 방면 재개발 동으로, 아오야마 방면 보행 축을 잇는다.',
    tags: { 개업: '2024-07', 높이: '120 m' },
  },
  {
    match: 'セルリアンタワー',
    id: 'bldg-cerulean',
    connectLevels: [1],
    name: '세룰리안 타워',
    desc: '2001년 개업, 184m. 사쿠라가오카 언덕 위 도큐 계열 호텔·오피스 복합.',
    tags: { 개업: '2001', 높이: '184 m' },
  },
  {
    match: '渋谷インフォスタワー',
    id: 'bldg-infoss',
    connectLevels: [1],
    name: '시부야 인포스 타워',
    desc: '사쿠라가오카 남쪽의 오피스 타워.',
    tags: { 높이: '89 m' },
  },
  {
    match: '渋谷クロスタワー',
    id: 'bldg-cross-tower',
    connectLevels: [1],
    name: '시부야 크로스타워',
    desc: '미야마스자카를 올라간 곳의 오피스 타워.',
    tags: { 높이: '115 m' },
  },
  {
    match: '西武渋谷店A館',
    id: 'bldg-seibu-a',
    connectLevels: [1],
    name: '세이부 시부야점 A관',
  },
  {
    match: '西武渋谷店B館',
    id: 'bldg-seibu-b',
    connectLevels: [1],
    name: '세이부 시부야점 B관',
  },
  {
    match: 'Shibuya 109',
    id: 'bldg-109',
    connectLevels: [1],
    name: '시부야 109',
    desc: '도겐자카 초입의 원통형 상업시설. 시부야 서쪽 보행 동선의 기준점.',
  },
  {
    match: '渋谷区 文化交流センター 大和田',
    id: 'bldg-owada',
    connectLevels: [1],
    name: '시부야구 문화교류센터 오와다',
  },
];

export const LANDMARK_BY_NAME = new Map(LANDMARKS.map((l) => [l.match, l]));
