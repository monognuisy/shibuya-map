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
  desc?: string;
  tags?: Record<string, string>;
}

export const LANDMARKS: Landmark[] = [
  {
    match: '渋谷スクランブルスクエア',
    id: 'bldg-scramble-square',
    name: '시부야 스크램블스퀘어 동동',
    desc: '2019년 11월 1일 개업, 지상 47층 229.7m. 옥상이 전망시설 SHIBUYA SKY. 지하 2층부터 지상 3층까지 여러 레벨에서 역과 직결되는 현재 시부야의 환승 허브다.',
    tags: { 개업: '2019-11-01', 높이: '229.7 m', 층수: '지상 47층' },
  },
  {
    match: '渋谷ヒカリエ',
    id: 'bldg-hikarie',
    name: '시부야 히카리에',
    desc: '2012년 4월 26일 개업, 182.5m. 지하 3층에서 도요코선·후쿠토신선 개찰과 직결되고 2층 연결통로로 스크램블스퀘어와 이어진다. 4층 북측이 스카이웨이의 동쪽 기점이 된다.',
    tags: { 개업: '2012-04-26', 높이: '182.5 m', 층수: '지상 34층' },
  },
  {
    match: '渋谷ストリーム',
    id: 'bldg-stream',
    name: '시부야 스트림',
    desc: '2018년 9월 13일 개업, 180m. 옛 도요코선 지상 승강장 자리에 세워졌다. 3층에서 남구 북측 자유통로를 통해 선로 건너 사쿠라스테이지까지 갈 수 있다.',
    tags: { 개업: '2018-09-13', 높이: '180 m', 층수: '지상 35층' },
  },
  {
    match: '渋谷ストリームホール',
    id: 'bldg-stream-hall',
    name: '시부야 스트림 홀',
    desc: '시부야 스트림에 붙은 홀 동. 이나리바시 광장과 접한다.',
  },
  {
    match: '渋谷フクラス',
    id: 'bldg-fukuras',
    name: '시부야 후쿠라스',
    desc: '2019년 12월 5일 개업, 도겐자카 1초메 재개발. 2020년 9월 26일 접속 데크가 열리면서 시부야역과 지상 2층 레벨로 이어졌다. 1층에 공항버스 터미널이 있다.',
    tags: { 개업: '2019-12-05', 높이: '104 m', 데크접속: '2020-09-26' },
  },
  {
    match: '渋谷マークシティEAST',
    id: 'bldg-markcity-east',
    name: '시부야 마크시티 EAST',
    desc: '이노카시라선 승강장과 중앙구를 품은 동. 2층 자유통로가 하치공 광장으로 이어지고, WEST 5층에는 고속버스 터미널이 있다.',
    tags: { 개업: '2000-04-07' },
  },
  {
    match: 'Shibuya Sakura Stage SHIBUYA Tower',
    id: 'bldg-sakura-shibuya',
    name: '사쿠라스테이지 SHIBUYA 사이드 타워',
    desc: '사쿠라스테이지 중 선로에 가까운 동. 지상 39층 180m. 남구 북측 자유통로의 서쪽 끝이 이 건물 3층에 접속한다. 2023년 11월 30일 준공, 2024년 7월 단계 개업.',
    tags: { 준공: '2023-11-30', 높이: '180 m', 층수: '지상 39층' },
  },
  {
    match: 'Shibuya Sakura Stage SAKURA Tower',
    id: 'bldg-sakura-sakura',
    name: '사쿠라스테이지 SAKURA 사이드 타워',
    desc: '사쿠라가오카 쪽 동. 지상 30층 133m. 주거·업무 복합. SHIBUYA 사이드와 센트럴 빌딩을 거쳐 역으로 이어진다.',
    tags: { 준공: '2023-11-30', 높이: '133 m', 층수: '지상 30층' },
  },
  {
    match: '渋谷サクラステージ セントラルビル',
    id: 'bldg-sakura-central',
    name: '사쿠라스테이지 센트럴 빌딩',
    desc: '두 타워 사이를 잇는 중간 동. 사쿠라가오카 언덕의 고저차를 흡수하는 보행 축이 지난다.',
    tags: { 높이: '90 m' },
  },
  {
    match: '渋谷',
    id: 'bldg-station-main',
    name: '시부야역 역사 (본체)',
    desc: 'JR·도쿄메트로·도큐가 겹쳐 있는 역사 본체. OSM 에서 building=train_station 으로 한 덩어리로 그려져 있다.',
  },
  {
    match: '渋谷駅新南口',
    id: 'bldg-station-shinminami',
    name: '시부야역 신남구 역사',
    desc: '2024년 7월 21일 신남개찰이 이전해 온 교상역사. 남구 교상역사 전면 개업은 2026년도 예정이다.',
    tags: { 이전: '2024-07-21' },
  },
  {
    match: 'JR 渋谷駅',
    id: 'bldg-jr-south',
    name: 'JR 시부야역 (남측 역사)',
    desc: '남쪽 구역의 JR 역사 부분.',
  },
  {
    match: '渋谷アクシュ（SHIBUYA AXSH）',
    id: 'bldg-axsh',
    name: '시부야 아쿠슈 (SHIBUYA AXSH)',
    desc: '2024년 7월 개업. 미야마스자카 방면 재개발 동으로, 아오야마 방면 보행 축을 잇는다.',
    tags: { 개업: '2024-07', 높이: '120 m' },
  },
  {
    match: 'セルリアンタワー',
    id: 'bldg-cerulean',
    name: '세룰리안 타워',
    desc: '2001년 개업, 184m. 사쿠라가오카 언덕 위 도큐 계열 호텔·오피스 복합.',
    tags: { 개업: '2001', 높이: '184 m' },
  },
  {
    match: '渋谷インフォスタワー',
    id: 'bldg-infoss',
    name: '시부야 인포스 타워',
    desc: '사쿠라가오카 남쪽의 오피스 타워.',
    tags: { 높이: '89 m' },
  },
  {
    match: '渋谷クロスタワー',
    id: 'bldg-cross-tower',
    name: '시부야 크로스타워',
    desc: '미야마스자카를 올라간 곳의 오피스 타워.',
    tags: { 높이: '115 m' },
  },
  {
    match: '西武渋谷店A館',
    id: 'bldg-seibu-a',
    name: '세이부 시부야점 A관',
  },
  {
    match: '西武渋谷店B館',
    id: 'bldg-seibu-b',
    name: '세이부 시부야점 B관',
  },
  {
    match: 'Shibuya 109',
    id: 'bldg-109',
    name: '시부야 109',
    desc: '도겐자카 초입의 원통형 상업시설. 시부야 서쪽 보행 동선의 기준점.',
  },
  {
    match: '渋谷区 文化交流センター 大和田',
    id: 'bldg-owada',
    name: '시부야구 문화교류센터 오와다',
  },
];

export const LANDMARK_BY_NAME = new Map(LANDMARKS.map((l) => [l.match, l]));
