/**
 * 자체 작성 레이어의 근거 문헌.
 *
 * `CuratedLink.source` 가 이 표의 키를 가리킨다. 근거가 없는 링크는 `source` 를
 * 비워 둔다 — 빌드가 그 수를 세어 보고하므로, 무엇이 아직 확인되지 않았는지가
 * 데이터 안에 남는다.
 *
 * `kind` 는 근거의 강도다. 같은 "확인됨" 이라도 사업자가 낸 구내도와 제3자가
 * 정리한 페이지는 신뢰도가 다르므로 구분해 둔다.
 *   · official  — 철도 사업자가 공개한 구내도·설비 안내
 *   · press     — 사업자 보도자료 및 이를 다룬 보도
 *   · osm       — OpenStreetMap 의 형상·level 태그
 *   · secondary — 제3자가 정리한 안내 페이지
 */
export interface LinkSource {
  title: string;
  url: string;
  /** 자료의 판본·시점 */
  revision?: string;
  kind: 'official' | 'press' | 'osm' | 'secondary';
}

export const LINK_SOURCES = {
  'tokyu-map': {
    title: '東急「東横線・田園都市線渋谷駅 立体図・平面図」',
    url: 'https://www.tokyu.co.jp/railway/station_map/pdf/ty01-shibuya_2.pdf',
    revision: '2026-08-21판',
    kind: 'official',
  },
  'tokyu-future': {
    title: '東急「駅街区計画最終章」 시부야 재개발 일정',
    url: 'https://www.tokyu.co.jp/shibuya-redevelopment/redevelopment/future/',
    kind: 'official',
  },
  'keio-map': {
    title: '京王「渋谷駅 階層図」',
    url: 'https://www.keio.co.jp/train/station/station_map/pdf/in01_shibuya_floor_map.pdf',
    revision: '2026-03판',
    kind: 'official',
  },
  'keio-bf': {
    title: '京王「各駅のバリアフリー設備等一覧」',
    url: 'https://www.keio.co.jp/train/safety/barrier_free/station/',
    kind: 'official',
  },
  'metro-deck': {
    title: '東京メトロ·東急「2020年9月、渋谷駅西口の新たな歩行者デッキを供用開始します」',
    url: 'https://prtimes.jp/main/html/rd/p/000000487.000010686.html',
    revision: '2020-08-21',
    kind: 'press',
  },
  'shibukei-deck': {
    title: '시부야경제신문「渋谷駅西口の新歩行者デッキが供用開始」',
    url: 'https://www.shibukei.com/headline/15345/',
    revision: '2020-09',
    kind: 'press',
  },
  'shibukei-hachiko': {
    title: '시부야경제신문「JR渋谷駅『ハチ公改札』移設 改札外は一方通行」',
    url: 'https://www.shibukei.com/headline/18928/',
    revision: '2025-01',
    kind: 'press',
  },
  'shibukei-chuo': {
    title: '시부야경제신문「JR渋谷駅の現・中央改札が廃止、中央東改札と統合へ」',
    url: 'https://www.shibukei.com/headline/16173/',
    revision: '2021-10',
    kind: 'press',
  },
  'impress-minami': {
    title: 'Impress Watch「渋谷のJR線上空に横断通路」 남측 동서 통로 2본',
    url: 'https://www.watch.impress.co.jp/docs/news/1536593.html',
    revision: '2023-11',
    kind: 'press',
  },
  'tabiris-hachiko': {
    title: '타비리스「渋谷駅『ハチ公改札移設』混雑にどう対応する？」',
    url: 'https://tabiris.com/archives/shibuya2025/',
    revision: '2025-01',
    kind: 'secondary',
  },
  'jr-home-ev': {
    title: '「渋谷駅｜山手線ホームの階段・エレベーター・エスカレーターの乗車位置」',
    url: 'https://1rankup.jp/shibuya/yamanote-line-home.html',
    kind: 'secondary',
  },
  'ekikara-ev': {
    title: '「渋谷駅のエレベーターの位置マップ（路線ごと）」',
    url: 'https://eki-kara-access.tokyo/shibuyaeki-stroller-wheelchair-route/',
    kind: 'secondary',
  },
  'ekizukan-ginza': {
    title: '駅ずかん「銀座線 渋谷駅 構内図」',
    url: 'https://trainstation.jp/tokyo-metro/shibuya-station-ginza-line',
    kind: 'secondary',
  },
  'tokyu-land-sakura': {
    title: '東急不動産「渋谷サクラステージ」 시설 소개',
    url: 'https://www.tokyu-land.co.jp/company/magazine/shibuyasakurastage.html',
    kind: 'official',
  },
  'shibuya-city-deck': {
    title: '시부야구 クリエイティブ・ジャンクション「国道246号横断デッキ」',
    url: 'https://creative-junction.city.shibuya.tokyo.jp/spaces/501',
    kind: 'official',
  },
  'hikarie-access': {
    title: '渋谷ヒカリエ 공식 액세스 안내',
    url: 'https://www.hikarie.jp/access/',
    kind: 'official',
  },
  'shibukei-shinminami': {
    title: '시부야경제신문「JR渋谷駅『新南改札』が新駅舎に移転」',
    url: 'https://www.shibukei.com/headline/18529/',
    revision: '2024-07',
    kind: 'press',
  },
  'impress-skyway': {
    title: 'Impress Watch「渋谷の新たな歩行者デッキを歩いた」 동측 4층 스카이웨이',
    url: 'https://www.watch.impress.co.jp/docs/news/2029501.html',
    kind: 'press',
  },
  osm: {
    title: 'OpenStreetMap — 승강장·통로 형상과 level 태그',
    url: 'https://www.openstreetmap.org/',
    kind: 'osm',
  },
} as const satisfies Record<string, LinkSource>;

export type LinkSourceKey = keyof typeof LINK_SOURCES;
