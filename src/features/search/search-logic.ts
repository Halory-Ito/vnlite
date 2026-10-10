/**
 * 搜索页的范围定义与纯逻辑。
 *
 * 一个输入框、四种「搜什么」：作品（默认）/ 制作人员(staff) / 用户 / 制作者(producer)。
 * 文案与判定函数都放这里（不依赖 React），冒烟脚本可以直接测。
 * 分段控件上用短名「作品 / 人员 / 用户 / 厂商」（见下面 `SCOPE_LABEL_KEY` 的说明）。
 *
 * ⚠️ **「用户」这一档的语义和其它三档不同**：Kana 的 `GET /user` 没有模糊搜索，
 * 只认完整用户名（不区分大小写）或 `u123` 形式的 id（实测 `?q=yor` 查不到
 * `Yorhel`）。所以这一档最多一条结果，且必须把限制写在 UI 上，
 * 否则用户会以为「搜不到人」。
 *
 * ⚠️ 模块级常量只存 `TranslationKey`（语言可切换，不能存死文案）；
 * 纯函数里的展示文案用全局 `t`。
 */

import { t, type TranslationKey } from "@/lib/i18n/translate";
import type { Producer, Staff } from "@/lib/api/types";
import { producerTypeLabel } from "@/utils/format";

/** 搜索页支持的范围，顺序即分段控件里从左到右的顺序 */
export const SEARCH_SCOPES = ["vn", "staff", "user", "producer"] as const;
export type SearchScope = (typeof SEARCH_SCOPES)[number];

/**
 * 分段控件上的档位名。
 *
 * ⚠️ 「制作人员」(staff) 与「制作者」(producer) 只差一个字，四档并排时用户
 * 分不清，所以控件上用短名「人员 / 厂商」，完整说法放在 placeholder 与空态提示里。
 */
export const SCOPE_LABEL_KEY: Record<SearchScope, TranslationKey> = {
  vn: "search.scope.vn",
  staff: "search.scope.staff",
  user: "search.scope.user",
  producer: "search.scope.producer",
};

/** 完整的集合名：空态文案（「没有与 x 匹配的制作者」）与行长数据用 */
export const SCOPE_NOUN_KEY: Record<SearchScope, TranslationKey> = {
  vn: "search.noun.vn",
  staff: "search.noun.staff",
  user: "search.noun.user",
  producer: "search.noun.producer",
};

/** 分段控件的选项（渲染时 `t(labelKey)` 翻成档位名） */
export const SCOPE_OPTIONS: { value: SearchScope; labelKey: TranslationKey }[] = SEARCH_SCOPES.map(
  (value) => ({
    value,
    labelKey: SCOPE_LABEL_KEY[value],
  })
);

/**
 * 输入框的 placeholder（复用通用的「搜索」文案）。
 *
 * ⚠️ 刻意**只有一句通用文案**，不给每一档配「怎么搜」的提示（Master 要求移除
 * 每个搜索条目的 hint）：档位名已经写在分段控件上了；而「用户只能精确匹配」
 * 这种限制属于**搜不到时**才需要知道的事，写在未命中的空态里更合适
 * （见 `userMissDescription`）。
 */
export const SEARCH_PLACEHOLDER_KEY: TranslationKey = "common.search";

/**
 * 结果列表顶部的标题。
 *
 * 刻意只写「搜索「x」的结果」而**不**带档位名（会变成「搜索「Jun Maeda」的
 * 制作人员」这种别扭的句子）：当前在搜什么由上面的分段控件与行内容表达。
 */
export function resultHeadline(keyword: string): string {
  return t("search.resultsHeadline", { keyword });
}

/** 空态描述：「没有与「x」匹配的{完整集合名}」 */
export function emptyDescription(keyword: string, scope: SearchScope): string {
  return t("search.emptyDescription", { keyword, noun: t(SCOPE_NOUN_KEY[scope]) });
}

/** `/user` 把 `u123` 形式的串按 id 处理，不会当用户名比 */
export function looksLikeUserId(query: string): boolean {
  return /^u\d+$/i.test(query.trim());
}

/** 用户档查不到时的说明：id 形式与用户名形式给不同的文案 */
export function userMissDescription(query: string): string {
  return looksLikeUserId(query)
    ? t("search.userMissId", { id: query.trim() })
    : t("search.userMissHint");
}

/* -------------------------------------------------------------------------- */
/* 作品以外的搜索结果行                                                        */
/* -------------------------------------------------------------------------- */

/** 一行搜索结果的展示数据（`SearchResultRow` 的入参） */
export interface SearchEntry {
  id: string;
  title: string;
  /** 罗马字原名 */
  original?: string | null;
  /** 右侧次要信息 */
  meta: string;
}

function flatMapEntries<T>(
  pages: { results: T[] }[] | undefined,
  toEntry: (item: T) => SearchEntry
): SearchEntry[] {
  if (!pages) return [];
  const entries: SearchEntry[] = [];
  for (const page of pages) for (const item of page.results) entries.push(toEntry(item));
  return entries;
}

/**
 * staff 分页结果 → 行数据，**按 `id` 去重**。
 *
 * ⚠️ `/staff` 的搜索是按「名字行」匹配的：一个人有多行（主名 + 各别名），
 * 共享同一个 `id`。所以搜「sukaji」会命中 `s208` 的别名行、搜「SCA-自」会命中
 * 它的主名行 —— 两者是同一个人的两行，不能都显示，也不该用 `ismain` 过滤掉
 * 别名行（那样搜别名就一条都不剩）。
 *
 * 规则与 vndb.org 官网一致（官网 `/s?q=sukaji` 也只给一行、显示命中的那个名字）：
 * **每个 id 只出一行，优先主名行**（主名行也在结果里时用它，否则用命中的别名行）。
 * 右侧显示 staff id（`s1234`）。
 */
export function toStaffEntries(pages: { results: Staff[] }[] | undefined): SearchEntry[] {
  if (!pages) return [];
  const byId = new Map<string, { entry: SearchEntry; isMain: boolean }>();

  for (const page of pages) {
    for (const staff of page.results) {
      const isMain = staff.ismain === true;
      const seen = byId.get(staff.id);
      if (seen && (seen.isMain || !isMain)) continue;
      byId.set(staff.id, {
        isMain,
        entry: {
          id: staff.id,
          title: staff.name,
          original: staff.original ?? null,
          meta: staff.id,
        },
      });
    }
  }

  return [...byId.values()].map((item) => item.entry);
}

/** 制作者分页结果 → 行数据。右侧显示「类型 · id」（类型是这一档最有用的区分） */
export function toProducerEntries(pages: { results: Producer[] }[] | undefined): SearchEntry[] {
  return flatMapEntries(pages, (producer) => ({
    id: producer.id,
    title: producer.name,
    original: producer.original ?? null,
    meta: `${producerTypeLabel(producer.type ?? "in")} · ${producer.id}`,
  }));
}
