/**
 * 원본 오픈데이터를 data/raw 로 내려받고 출처·해시를 meta 로 남긴다.
 *
 *   pnpm data:fetch
 *
 * 네트워크 없이 빌드할 수 있도록 raw 는 저장소에 커밋한다.
 */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { setDefaultResultOrder } from 'node:dns';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// 일부 환경에서 IPv6 경로가 막혀 있어 IPv4 를 우선한다.
setDefaultResultOrder('ipv4first');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'data', 'raw');

const UA =
  'shibuya-map/0.1 (open data pipeline; https://github.com/monognuisy/shibuya-map)';

/** 시부야역을 중심으로 한 대상 범위 (남, 서, 북, 동) */
export const BBOX = [35.6520, 139.6935, 35.6650, 139.7085] as const;

interface RemoteFile {
  path: string;
  url: string;
}

interface SourceSpec {
  key: string;
  title: string;
  url: string;
  license: string;
  files: RemoteFile[];
}

/**
 * 국토교통성 「歩行者移動支援サービスに関するデータサイト」 dataset 65
 * = 歩行空間ネットワークデータ等（渋谷地区）
 * resource 224 = 보행공간 네트워크(csv, 2018년3월 사양), 226 = 시설데이터(csv)
 */
const MLIT_BASE = 'https://www.hokoukukan.go.jp/uploads/65';

const SOURCES: SourceSpec[] = [
  {
    key: 'mlit-pnw',
    title: '歩行空間ネットワークデータ（渋谷地区・2018年3月版適用）',
    url: 'https://www.hokoukukan.go.jp/metadata/detail/65',
    license: '政府標準利用規約（第2.0版） / 国土交通省',
    files: [
      { path: 'mlit-pnw/node.csv', url: `${MLIT_BASE}/224/node.csv` },
      { path: 'mlit-pnw/link.csv', url: `${MLIT_BASE}/224/link.csv` },
    ],
  },
  {
    key: 'mlit-facility',
    title: '施設データ（渋谷地区・2018年3月版適用）',
    url: 'https://www.hokoukukan.go.jp/metadata/detail/65',
    license: '政府標準利用規約（第2.0版） / 国土交通省',
    files: [{ path: 'mlit-facility/facility.csv', url: `${MLIT_BASE}/226/facility.csv` }],
  },
];

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.osm.jp/api/interpreter',
];

/**
 * 건물 외곽선 · 승강장 · 실내 통로. 시부야역 구내는 OSM 에도 level 태그가
 * 부분적으로 들어가 있어 curated 레이어를 검증하는 데 쓴다.
 */
function overpassQuery(): string {
  const b = `${BBOX[0]},${BBOX[1]},${BBOX[2]},${BBOX[3]}`;
  return `[out:json][timeout:180];
(
  way["building"](${b});
  relation["building"](${b});
  way["railway"="platform"](${b});
  relation["railway"="platform"](${b});
  way["public_transport"="platform"](${b});
  way["railway"~"^(rail|subway|light_rail)$"](${b});
  way["highway"~"^(footway|steps|elevator|corridor|pedestrian|path)$"](${b});
  way["indoor"]["indoor"!="no"](${b});
  node["railway"="subway_entrance"](${b});
  node["railway"="train_station_entrance"](${b});
  node["entrance"](${b});
  node["highway"="elevator"](${b});
  node["railway"="station"](${b});
  node["public_transport"="station"](${b});
);
out body geom;`;
}

async function download(url: string, body?: URLSearchParams): Promise<Buffer> {
  try {
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      body,
      headers: { 'user-agent': UA },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    // 일부 네트워크 환경에서 undici 가 Overpass 로 붙지 못한다(ETIMEDOUT).
    // curl 은 같은 호스트로 정상 연결되므로 폴백으로 둔다.
    return curl(url, body).catch(() => {
      throw new Error(`${url} — ${(err as Error).message}`);
    });
  }
}

async function curl(url: string, body?: URLSearchParams): Promise<Buffer> {
  const args = ['-sS', '--fail', '--max-time', '240', '-A', UA];
  if (body) args.push('-X', 'POST', '--data-binary', body.toString());
  args.push(url);
  const { stdout } = await execFileAsync('curl', args, {
    encoding: 'buffer',
    maxBuffer: 256 * 1024 * 1024,
  });
  return Buffer.from(stdout);
}

async function save(path: string, buf: Buffer) {
  const abs = join(RAW, path);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, buf);
  return {
    name: path,
    bytes: buf.byteLength,
    sha256: createHash('sha256').update(buf).digest('hex'),
  };
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const meta: unknown[] = [];

  for (const src of SOURCES) {
    const files = [];
    for (const f of src.files) {
      process.stdout.write(`↓ ${f.path} … `);
      const buf = await download(f.url);
      const info = await save(f.path, buf);
      files.push(info);
      console.log(`${info.bytes.toLocaleString()} B`);
    }
    meta.push({ ...src, files, fetchedAt });
  }

  process.stdout.write('↓ osm/shibuya.json … ');
  let osm: Buffer | null = null;
  let lastErr: unknown;
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      osm = await download(mirror, new URLSearchParams({ data: overpassQuery() }));
      break;
    } catch (err) {
      lastErr = err;
      process.stdout.write(`(${new URL(mirror).host} 실패) `);
    }
  }
  if (!osm) throw lastErr;
  const osmInfo = await save('osm/shibuya.json', osm);
  console.log(`${osmInfo.bytes.toLocaleString()} B`);
  meta.push({
    key: 'osm',
    title: 'OpenStreetMap — 시부야역 주변 건물·승강장·실내 통로',
    url: 'https://www.openstreetmap.org/',
    license: 'ODbL 1.0 — © OpenStreetMap contributors',
    files: [osmInfo],
    fetchedAt,
    query: overpassQuery(),
  });

  await writeFile(join(RAW, 'sources.json'), JSON.stringify(meta, null, 2) + '\n');
  console.log(`\n완료 — data/raw/sources.json 갱신`);
}

if (process.argv[1] && (await readFile(process.argv[1]).catch(() => null))) {
  await main();
}
