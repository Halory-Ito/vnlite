/**
 * VNDB Kana API 的枚举值。
 *
 * 权威来源：`GET /schema?section=enums`，字段会随 VNDB 更新新增。
 * 不确定时用 `.pi/skills/vndb-api/scripts/vndb.py schema --section enums --name <enum>` 核对。
 * 新增枚举值时往数组末尾追加，不要重排（`as const` 派生类型依赖顺序无关）。
 */

/** 游玩时长估计：1 极短 → 5 极长 */
export const LENGTH = ["", "Very short", "Short", "Medium", "Long", "Very long"] as const;
export type Length = 0 | 1 | 2 | 3 | 4 | 5;

/** 开发状态 */
export const DEV_STATUS = ["Finished", "In development", "Cancelled"] as const;
export type DevStatus = 0 | 1 | 2;

/** VN 语言（`olang` 原始语言 / `lang` 可用语言） */
export const LANGUAGE = [
  "ar",
  "bg",
  "cs",
  "da",
  "de",
  "el",
  "en",
  "es",
  "fa",
  "fi",
  "fr",
  "he",
  "hi",
  "hu",
  "id",
  "it",
  "ja",
  "ko",
  "ms",
  "nl",
  "no",
  "pl",
  "pt-br",
  "pt-pt",
  "ro",
  "ru",
  "sv",
  "ta",
  "th",
  "tr",
  "uk",
  "vi",
  "zh",
  "zh-Hans",
  "zh-Hant",
] as const;
export type Language = (typeof LANGUAGE)[number];

export const LANGUAGE_LABEL: Record<Language, string> = {
  ar: "阿拉伯语",
  bg: "保加利亚语",
  cs: "捷克语",
  da: "丹麦语",
  de: "德语",
  el: "希腊语",
  en: "英语",
  es: "西班牙语",
  fa: "波斯语",
  fi: "芬兰语",
  fr: "法语",
  he: "希伯来语",
  hi: "印地语",
  hu: "匈牙利语",
  id: "印尼语",
  it: "意大利语",
  ja: "日语",
  ko: "韩语",
  ms: "马来语",
  nl: "荷兰语",
  no: "挪威语",
  pl: "波兰语",
  "pt-br": "巴西葡语",
  "pt-pt": "葡萄牙语",
  ro: "罗马尼亚语",
  ru: "俄语",
  sv: "瑞典语",
  ta: "泰米尔语",
  th: "泰语",
  tr: "土耳其语",
  uk: "乌克兰语",
  vi: "越南语",
  zh: "中文",
  "zh-Hans": "中文（简体）",
  "zh-Hant": "中文（繁体）",
};

/** 平台 */
export const PLATFORM = [
  "win",
  "lin",
  "mac",
  "web",
  "ios",
  "and",
  "swi",
  "sw2",
  "ps1",
  "ps2",
  "ps3",
  "ps4",
  "ps5",
  "psp",
  "psv",
  "xbo",
  "xxs",
  "xb1",
  "xb3",
  "nds",
  "n3d",
  "wii",
  "wiu",
  "gba",
  "gbc",
  "drc",
  "sat",
  "smd",
  "scd",
  "pce",
  "pcf",
  "nes",
  "sfc",
  "dos",
  "msx",
  "p88",
  "p98",
  "x68",
  "x1s",
  "fmt",
  "fm7",
  "fm8",
  "tdo",
  "bdp",
  "dvd",
  "vnd",
  "mob",
  "oth",
] as const;
export type Platform = (typeof PLATFORM)[number];

export const PLATFORM_LABEL: Record<Platform, string> = {
  win: "Windows",
  lin: "Linux",
  mac: "macOS",
  web: "Web",
  ios: "iOS",
  and: "Android",
  swi: "Switch",
  sw2: "Switch 2",
  ps1: "PlayStation",
  ps2: "PlayStation 2",
  ps3: "PlayStation 3",
  ps4: "PlayStation 4",
  ps5: "PlayStation 5",
  psp: "PlayStation Portable",
  psv: "PlayStation Vita",
  xbo: "Xbox",
  xxs: "Xbox Series",
  xb1: "Xbox 360",
  xb3: "Xbox One",
  nds: "Nintendo DS",
  n3d: "Nintendo 3DS",
  wii: "Wii",
  wiu: "Wii U",
  gba: "Game Boy Advance",
  gbc: "Game Boy Color",
  drc: "Dreamcast",
  sat: "Saturn",
  smd: "Mega Drive",
  scd: "Mega-CD",
  pce: "PC Engine",
  pcf: "PC-FX",
  nes: "NES",
  sfc: "Super Famicom",
  dos: "MS-DOS",
  msx: "MSX",
  p88: "PC-88",
  p98: "PC-98",
  x68: "X68000",
  x1s: "X1",
  fmt: "FM Towns",
  fm7: "FM-7",
  fm8: "FM-8",
  tdo: "T-DOS",
  bdp: "Bandai Pippin",
  dvd: "DVD",
  vnd: "Vnd",
  mob: "移动端",
  oth: "其他",
};

/** 发行版介质 */
export const MEDIUM = [
  "blr",
  "mrt",
  "cas",
  "cd",
  "dc",
  "dvd",
  "flp",
  "gdr",
  "in",
  "mem",
  "nod",
  "umd",
  "otc",
] as const;
export type Medium = (typeof MEDIUM)[number];

/** staff 在 /vn 中的职位 */
export const STAFF_ROLE = [
  "scenario",
  "director",
  "chardesign",
  "art",
  "music",
  "songs",
  "translator",
  "editor",
  "qa",
  "staff",
] as const;
export type StaffRole = (typeof STAFF_ROLE)[number];

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  scenario: "剧本",
  director: "导演",
  chardesign: "角色设计",
  art: "美术",
  music: "音乐",
  songs: "歌曲",
  translator: "翻译",
  editor: "编辑",
  qa: "测试",
  staff: "其他",
};

/** 制作者类型 */
export const PRODUCER_TYPE = ["co", "in", "ng"] as const;
export type ProducerType = (typeof PRODUCER_TYPE)[number];

export const PRODUCER_TYPE_LABEL: Record<ProducerType, string> = {
  co: "公司",
  in: "个人",
  ng: "业余团体",
};

/** 角色在 VN 中的定位（Kana 的枚举值，没有 `background` 这一档） */
export const CHARACTER_ROLE = ["main", "primary", "side", "appears"] as const;
export type CharacterRole = (typeof CHARACTER_ROLE)[number];

export const CHARACTER_ROLE_LABEL: Record<CharacterRole, string> = {
  main: "主角",
  primary: "主要角色",
  side: "次要角色",
  appears: "登场",
};

/** 角色性别 */
export const SEX = ["m", "f", "b", "n"] as const;
export type Sex = (typeof SEX)[number];

export const SEX_LABEL: Record<Sex, string> = {
  m: "男",
  f: "女",
  b: "双性",
  n: "无性",
};

/** 发行版配音程度 */
export const VOICED = [0, 1, 2, 3, 4] as const;
export type Voiced = (typeof VOICED)[number];

export const VOICED_LABEL: Record<Voiced, string> = {
  0: "未知",
  1: "无配音",
  2: "仅成人场景",
  3: "部分配音",
  4: "全配音",
};

/** 发行版在用户清单里的持有状态（英文与 VNDB 一致，不做翻译） */
export const LIST_STATUS = ["Unknown", "Pending", "Obtained", "On loan", "Deleted"] as const;
export type ListStatus = 0 | 1 | 2 | 3 | 4;

/**
 * VNDB 预置的清单标签 id（id < 10 所有用户一致）。
 * 完整列表用 `GET /ulist_labels` 拉取，此处只硬编码需要特殊处理的。
 */
export const BUILTIN_LABEL = {
  /** 虚拟标签，不可设置 */
  NO_LABEL: 0,
  PLAYING: 1,
  FINISHED: 2,
  STALLED: 3,
  DROPPED: 4,
  PLANNED: 5,
  BLACKLIST: 6,
  /** 随 vote 自动增删，不可手动设置 */
  VOTED: 7,
} as const;

/**
 * 内置清单标签的**英文名兜底**（与 vndb.org 一致，不做翻译）。
 * 正常路径下名称来自 `GET /ulist_labels`，这里只在标签表还没加载出来时兜底。
 */
export const BUILTIN_LABEL_NAME: Record<number, string> = {
  [BUILTIN_LABEL.NO_LABEL]: "No label",
  [BUILTIN_LABEL.PLAYING]: "Playing",
  [BUILTIN_LABEL.FINISHED]: "Finished",
  [BUILTIN_LABEL.STALLED]: "Stalled",
  [BUILTIN_LABEL.DROPPED]: "Dropped",
  [BUILTIN_LABEL.PLANNED]: "Wishlist",
  [BUILTIN_LABEL.BLACKLIST]: "Blacklist",
  [BUILTIN_LABEL.VOTED]: "Voted",
};

/** 互斥的状态标签：写入时必须只保留其中一个（API 不会自动清理） */
export const EXCLUSIVE_STATUS_LABELS: readonly number[] = [
  BUILTIN_LABEL.PLAYING,
  BUILTIN_LABEL.FINISHED,
  BUILTIN_LABEL.STALLED,
  BUILTIN_LABEL.DROPPED,
  BUILTIN_LABEL.PLANNED,
];

/** 写入时必须过滤掉的虚拟标签 */
export const UNSETTABLE_LABELS: readonly number[] = [BUILTIN_LABEL.NO_LABEL, BUILTIN_LABEL.VOTED];

/**
 * 图片上的 `sexual` / `violence` 是 **0 / 1 / 2**，不是字符串枚举。
 * 0 安全 / 1 暗示 / 2 露骨。NSFW 模糊逻辑直接比数字。
 */
export type ContentLevel = 0 | 1 | 2;

export const CONTENT_LEVEL_LABEL: Record<ContentLevel, string> = {
  0: "安全",
  1: "暗示",
  2: "露骨",
};

/** 容错版：处理 undefined（缺字段时按最保守的「露骨」处理，交给用户偏好决定是否显示） */
export function contentLevelLabel(level: number | undefined): string {
  if (level === 0) return "安全";
  if (level === 1) return "暗示";
  return "露骨";
}
