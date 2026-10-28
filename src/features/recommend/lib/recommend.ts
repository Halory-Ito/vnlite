/**
 * 「相似作品」的纯逻辑（冒烟可直接测）。
 *
 * 作品页的「相似」页签：拿这部作品自己的标签去找别的作品，不需要登录、
 * 也不用读用户收藏 —— 谁点进来都能马上看到相关内容。
 *
 * ## 为什么不能直接拿「评分最高的标签」
 *
 * VNDB 的标签分成 `cont`（内容）/ `ero`（成人）/ `tech`（技术）三类。
 * `ADV`、`NVL`、`Multiple Endings` 这类**技术标签**几乎每部作品都有、认可度还很高，
 * 拿它们去查只会把「所有 ADV」都捞回来。所以只保留**内容标签**。
 *
 * 剧透标签（`spoiler >= 1`）也不参与：那是在描述本作的某个结局，
 * 用它找「相似」既不准、也容易在别处剧透。
 */

/** 标签信号：只需要这几个字段（`VnTag` 直接就能传进来） */
export interface TagSignal {
  id: string;
  name?: string;
  /** 标签在全站的认可度（1.0–3.0） */
  rating?: number;
  /** 剧透等级 0–2 */
  spoiler?: number;
  /** `cont` / `ero` / `tech` */
  category?: string;
}

/** 一个「相似依据」标签 */
export interface SimilarTag {
  id: string;
  name: string;
  /** 认可度（越大越能代表这部作品） */
  weight: number;
}

/** 技术类标签不参与相似度（ADV / NVL / 引擎…） */
const EXCLUDED_CATEGORY = "tech";
/** 太冷门的标签（认可度 < 2）参考价值有限 */
const MIN_TAG_RATING = 2;

/**
 * 挑出用来找相似作品的标签：内容标签、非剧透、认可度够，按认可度降序。
 *
 * @param vn 当前作品（`vn.tags` 来自 `/vn` 详情的 `tags.*` 字段）
 * @param limit 最多用几个（太多会把结果筛死，太少又不够准）
 */
export function pickSimilarTags(vn: { tags?: readonly TagSignal[] }, limit = 4): SimilarTag[] {
  const picked: SimilarTag[] = [];

  for (const tag of vn.tags ?? []) {
    if ((tag.spoiler ?? 0) > 0) continue;
    if (tag.category === EXCLUDED_CATEGORY) continue;
    const rating = tag.rating ?? 0;
    if (rating < MIN_TAG_RATING) continue;
    picked.push({ id: tag.id, name: tag.name ?? tag.id, weight: rating });
  }

  return picked.sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id)).slice(0, limit);
}

/** 去掉作品自己（以及调用方指定的 id），相似列表里不该出现本作 */
export function excludeIds<T extends { id: string }>(
  items: readonly T[],
  exclude: ReadonlySet<string>
): T[] {
  return items.filter((item) => !exclude.has(item.id));
}
