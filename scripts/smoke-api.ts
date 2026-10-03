/**
 * M0 冒烟测试：拿真实 API 验证 lib/api 的每一层。
 *
 *   bun run scripts/smoke-api.ts
 *
 * 覆盖：字段集合法性、过滤器编译、嵌套过滤器、限流器、错误映射、端点封装，
 * 以及攻略仓库（静态 JSON，见 features/walkthrough）的解析容错与真实结构。
 * 这是 M0 的验收依据 —— 编译期类型只能保证「字段名是 VnSummary 上有的」，
 * 真正的合法性必须打真实接口 / 真实数据才知道。
 */

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import {
  CHARACTER_LIST_FIELDS,
  ULIST_STATS_FIELDS,
  ULIST_TAG_FIELDS,
  VN_DETAIL_FIELDS,
  VN_LIST_FIELDS,
} from "@/lib/api/fields";
import { byTag, byVn, characterInVn, compileVnFilters, pred } from "@/lib/api/filters";
import { getVn, queryRandomQuote, queryRandomVn, queryVns } from "@/lib/api/endpoints/vn";
import { getTag, queryCharacters, queryTags } from "@/lib/api/endpoints/catalog";
import {
  getListLabels,
  getListItem,
  queryList,
  sanitizeLabels,
  toggleLabel,
} from "@/lib/api/endpoints/ulist";
import { toFieldsString, type Predicate } from "@/lib/api/types";
import { RateLimiter } from "@/lib/api/rate-limiter";
import { GAME_TYPE_TAGS } from "@/features/stats/stats-logic";
import { overflowVids } from "@/features/walkthrough/cache";
import { fetchWalkthrough, fetchWalkthroughIndex } from "@/features/walkthrough/client";
import {
  EMPTY_MARKS,
  hasAnyMark,
  isDone,
  isStarred,
  markStepsDone,
  parseMarks,
  toggleEnding,
  toggleStepMark,
} from "@/features/walkthrough/marks";
import { parseWalkthrough, parseWalkthroughIndex } from "@/features/walkthrough/parse";
import {
  countStats,
  endingMeta,
  findEntry,
  groupSteps,
  markProgress,
  maskText,
} from "@/features/walkthrough/select";

let passed = 0;
let failed = 0;

async function check(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`  \u2713 ${name}`);
  } catch (error) {
    failed += 1;
    const message =
      error instanceof ApiError ? `${error.userMessage} [${error.detail ?? ""}]` : String(error);
    console.log(`  \u2717 ${name}\n      ${message}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/**
 * 把 VNDB 的 `released` 变成**可与 Kana 排序结果比较**的字符串。
 *
 * ⚠️ 断言排序时不能直接比原始字符串：`released` 是**部分日期**
 * （`2026` / `2026-09` / `2026-09-30` / `TBA`），而 Kana 是按真实日期排的，
 * 实测**月份级日期按「该月最后一天」参与排序**（`2026-09` 排在 `2026-09-30` 那一批里），
 * 直接比字符串会得到相反的结论 —— 之前就让「最新发售」那条断言偶发失败。
 * 这里按同一套规则补齐：只到年 → 12-31，只到月 → 该月最后一天，TBA → 9999-12-31。
 */
function releasedSortKey(raw: string | undefined): string {
  if (!raw) return "";
  if (raw === "TBA") return "9999-12-31";

  const parts = raw.split("-");
  const year = Number(parts[0]);
  if (parts.length === 1) return `${year}-12-31`;

  const month = Number(parts[1]);
  if (parts.length === 2) {
    // Date.UTC(y, m, 0) = 该月最后一天（m 是 1-based 时 0 号即上月最后一天）
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${year}-${pad2(month)}-${pad2(lastDay)}`;
  }
  return `${year}-${pad2(month)}-${pad2(Number(parts[2]))}`;
}

async function section(title: string): Promise<void> {
  console.log(`\n${title}`);
}

/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  console.log("vnlite M0 冒烟测试 —— 目标 https://api.vndb.org/kana\n");

  /* ---- 1. 字段集合法性 ---- */
  await section("1. 字段集（打真实接口，未知字段会 400）");

  await check("VN_LIST_FIELDS 合法", async () => {
    const r = await api.query("/vn", {
      fields: toFieldsString(VN_LIST_FIELDS),
      results: 1,
      sort: "id",
    });
    assert(r.results.length === 1, "应返回 1 条");
  });

  await check("VN_DETAIL_FIELDS 合法（含 tags/staff/va/screenshots 全量子字段）", async () => {
    const r = await api.query("/vn", {
      filters: ["and", ["id", "=", "v17"]],
      fields: toFieldsString(VN_DETAIL_FIELDS),
      results: 1,
    });
    const vn = r.results[0] as Record<string, unknown>;
    assert(vn.description && String(vn.description).length > 100, "description 应有内容");
    assert(Array.isArray(vn.staff) && (vn.staff as unknown[]).length > 0, "staff 应非空");
    assert(Array.isArray(vn.screenshots), "screenshots 应是数组");
    assert(Array.isArray(vn.extlinks), "extlinks 应是数组");
  });

  await check("CHARACTER_LIST_FIELDS 合法", async () => {
    await api.query("/character", {
      fields: toFieldsString(CHARACTER_LIST_FIELDS),
      results: 1,
      sort: "id",
    });
  });

  await check(
    "字段探测：VA_DETAIL / RELEASE_DETAIL / STAFF_DETAIL / CHARACTER_DETAIL / TRAIT 全部合法",
    async () => {
      const {
        RELEASE_DETAIL_FIELDS,
        STAFF_DETAIL_FIELDS,
        CHARACTER_DETAIL_FIELDS,
        TRAIT_DETAIL_FIELDS,
        PRODUCER_DETAIL_FIELDS,
      } = await import("@/lib/api/fields");
      const probes: [string, string, Predicate][] = [
        ["/release", toFieldsString(RELEASE_DETAIL_FIELDS), ["and", ["id", "=", "r12"]]],
        ["/staff", toFieldsString(STAFF_DETAIL_FIELDS), ["and", ["id", "=", "s545"]]],
        ["/character", toFieldsString(CHARACTER_DETAIL_FIELDS), ["and", ["id", "=", "c1"]]],
        // ⚠️ trait 的 id 前缀是 `i` 不是 `t`（i1=Hair, i2=Hair Color…）
        ["/trait", toFieldsString(TRAIT_DETAIL_FIELDS), ["and", ["id", "=", "i1"]]],
        ["/producer", toFieldsString(PRODUCER_DETAIL_FIELDS), ["and", ["id", "=", "p24"]]],
      ];
      for (const [endpoint, fields, filters] of probes) {
        await api.query(endpoint, { fields, filters, results: 1 });
      }
    }
  );

  await check("/ulist 不传 user 且未登录 → 400（不是 401，Kana 的行为）", async () => {
    try {
      await queryList({ results: 1 });
      throw new Error("本应报错");
    } catch (error) {
      assert(error instanceof ApiError, "应为 ApiError");
      assert(error.kind === "bad_request", `应为 bad_request，实际 ${error.kind}`);
      assert(String(error.detail).includes("user"), `错误信息应提到 user，实际：${error.detail}`);
    }
  });

  await check("无效 Token → 401（验证鉴权错误映射）", async () => {
    // 不用 SecureStore：它在 Node/bun 下没有原生模块。直接注入 Token 来源。
    const { setTokenProvider } = await import("@/lib/api/client");
    setTokenProvider(() => "invalid-token-value");
    try {
      const { authInfo } = await import("@/lib/api/endpoints/ulist");
      await authInfo();
      throw new Error("本应抛 401");
    } catch (error) {
      assert(error instanceof ApiError, "应为 ApiError，实际 " + typeof error);
      assert(error.kind === "unauthorized", `应为 unauthorized，实际 ${error.kind}`);
      assert(error.needsAuth === true, "needsAuth 应为 true");
    } finally {
      setTokenProvider(null);
    }
  });

  await check("带合法格式但无效的 Token 仍应 401（格式合法 ≠ 有效）", async () => {
    const { setTokenProvider } = await import("@/lib/api/client");
    setTokenProvider(() => "aaaaa-bbbbb-ccccc-ddddd-eeeee-fffff-ggggg");
    try {
      await queryList({ results: 1 });
      throw new Error("本应抛 401");
    } catch (error) {
      assert(
        error instanceof ApiError && error.kind === "unauthorized",
        `应为 unauthorized，实际 ${error instanceof ApiError ? error.kind : typeof error}`
      );
    } finally {
      setTokenProvider(null);
    }
  });

  /* ---- 2. 过滤器编译 ---- */
  await section("2. 过滤器编译（验证 Kana 的三个坑）");

  await check("单谓词自动包一层 and（坑 2）", async () => {
    const filters = compileVnFilters({});
    const r = await api.query("/vn", { filters, fields: "id,title", results: 1 });
    assert(r.results.length === 1, "应返回 1 条");
  });

  await check("undefined 过滤器不报错", async () => {
    const r = await queryVns({ results: 1 });
    assert(r.results.length === 1, "应返回 1 条");
  });

  await check("search 过滤（必须包在 and 里，坑 2）", async () => {
    const filters = compileVnFilters({ search: "Fate" });
    const r = await queryVns({ filters, results: 3 });
    assert(r.results.length > 0, "fate 搜索应有结果");
  });

  await check("searchrank 只在 search 过滤器下可用（坑：热门页不能直接用）", async () => {
    // 有 search 时可以用
    await api.query("/vn", {
      filters: compileVnFilters({ search: "Fate" }),
      fields: "id,title",
      results: 2,
      sort: "searchrank",
    });
    // 无 search 时应报错 —— 这就是首页「热门」必须用 rating/votecount 的原因
    try {
      await api.query("/vn", { fields: "id,title", results: 2, sort: "searchrank" });
      throw new Error("本应报错：searchrank 无 search 过滤器时不可用");
    } catch (error) {
      assert(error instanceof ApiError && error.kind === "bad_request", "应为 400 bad_request");
    }
  });

  await check("评分区间过滤（rating 走 /vn 过滤器）", async () => {
    const filters = compileVnFilters({ ratingRange: [90, 100] });
    const r = await queryVns({ filters, sort: "rating", reverse: true, results: 3 });
    assert(r.results.length > 0, "应有高评分结果");
    for (const vn of r.results) {
      assert((vn.rating ?? 0) >= 90, `rating ${vn.rating} 应 >= 90`);
    }
  });

  await check("语言 + 平台过滤", async () => {
    const filters = compileVnFilters({ olang: ["ja"], platform: ["win"] });
    const r = await queryVns({ filters, results: 3 });
    assert(r.results.length > 0, "应有日语 win 作品");
    for (const vn of r.results) {
      assert(vn.olang === "ja", `olang 应为 ja，实际 ${vn.olang}`);
      assert(vn.platforms?.includes("win"), "platforms 应含 win");
    }
  });

  /* ---- 3. 嵌套过滤器（坑 1）---- */
  await section("3. 嵌套过滤器（值必须是谓词，不是标量）");

  await check("release 的 vn 嵌套 byVn()", async () => {
    const r = await api.query("/release", {
      filters: byVn("v17"),
      fields: "id,title,released",
      results: 3,
      sort: "released",
    });
    assert(r.results.length > 0, "v17 应有发行版");
  });

  await check("character 的 vn 嵌套 characterInVn()", async () => {
    const r = await queryCharacters({ filters: characterInVn("v17"), results: 3 });
    assert(r.results.length > 0, "v17 应有角色");
  });

  await check("对照：裸标量写法必须被拒（证明 byVn 的必要性）", async () => {
    try {
      await api.query("/release", {
        filters: ["vn", "=", "v17"] as never,
        fields: "id",
        results: 1,
      });
      throw new Error("本应报 400");
    } catch (error) {
      assert(error instanceof ApiError && error.kind === "bad_request", "应为 400 bad_request");
    }
  });

  await check("标签过滤器 byTag()（含元组形式）", async () => {
    const { queryVnsByTag } = await import("@/lib/api/endpoints/vn");
    const r = await queryVnsByTag("105", { results: 3, sort: "rating", reverse: true });
    assert(Array.isArray(r.results), "应返回数组");
    // 元组形式 [tag_id, max_spoiler, min_tag_level]
    const tuple = await api.query("/vn", {
      filters: byTag("105", { spoiler: 1, level: 0 }),
      fields: "id",
      results: 2,
    });
    assert(tuple.results.length >= 0, "元组形式不应报错");
  });

  /* ---- 4. 端点封装 ---- */
  await section("4. 端点封装");

  await check("getVn(v17) 返回完整详情", async () => {
    const r = await getVn("v17");
    assert(r.results.length === 1, "应返回 1 条");
    const vn = r.results[0];
    assert(vn.id === "v17", "id 应为 v17");
    assert(vn.title.length > 0, "应有标题");
  });

  await check("queryRandomVn 随机取到一条真实作品", async () => {
    const vn = await queryRandomVn();
    assert(Boolean(vn.id?.startsWith("v")), `应返回 v-id，实际 ${vn.id}`);
    assert(vn.title.length > 0, "应有标题");
  });

  /*
   * 这条是拿真事故换来的：给 `/character` 的字段集里加了 `image.thumbnail`
   * （`/vn` 的 image 有、`/character` 的没有），结果整个角色页签 400 挂掉。
   * 字段集的坑必须靠真请求兜住 —— 光看类型看不出来。
   */
  await check("queryCharactersByVn 字段集合法（含 vns.role）", async () => {
    const { queryCharactersByVn } = await import("@/lib/api/endpoints/vn");
    const r = await queryCharactersByVn("v17");
    assert(r.results.length > 0, "v17 应有角色");
    const first = r.results[0] as {
      id?: string;
      image?: { url?: string; thumbnail?: string };
      vns?: { id: string; role?: string }[];
    };
    assert(Boolean(first.id), "应返回角色 id");
    assert(Boolean(first.vns?.length), "应带回 vns（分档要靠 role）");
    assert(Boolean(first.vns?.some((v) => v.role)), "vns 里应有 role");
    assert(!("thumbnail" in (first.image ?? {})), "/character 的 image 不该带 thumbnail");
  });

  await check("批量按 ID 取（合并成一次请求）", async () => {
    const { getVns } = await import("@/lib/api/endpoints/vn");
    const r = await getVns(["v17", "v11", "v1"]);
    assert(r.results.length === 3, `应返回 3 条，实际 ${r.results.length}`);
  });

  /*
   * 这条也是拿真事故换来的：`queryVnsByCharacter` 曾把 `/character` 的
   * `vn` 过滤器用在 `/vn` 上 → `400 Invalid 'vn' filter`，
   * 角色详情页「登场作品」整块显示不出来。真请求跑一遍最省心。
   */
  await check("queryVnsByCharacter 用对了过滤器", async () => {
    const { queryVnsByCharacter } = await import("@/lib/api/endpoints/catalog");
    const r = await queryVnsByCharacter("c23");
    assert(r.results.length > 0, "c23（Ever17 主角）应该有登场作品");
  });

  /*
   * `/vn` 的 `staff` 嵌套同样容易写错端点 —— staff 详情页的「作品」页签
   * 全靠它。s545 是 STAFF_DETAIL 字段探测用的同一位，真请求过一遍。
   */
  await check("queryVnsByStaff 用对了过滤器", async () => {
    const { queryVnsByStaff } = await import("@/lib/api/endpoints/catalog");
    const r = await queryVnsByStaff("s545");
    assert(r.results.length > 0, "s545 应该参与过作品");
    assert(Boolean((r.results[0] as { id?: string }).id), "应返回作品 id");
  });

  await check("getVns 超过 100 个应抛错", async () => {
    const { getVns } = await import("@/lib/api/endpoints/vn");
    const ids = Array.from({ length: 101 }, (_, i) => `v${i + 1}`);
    let threw = false;
    try {
      await getVns(ids);
    } catch {
      threw = true;
    }
    assert(threw, "应抛 RangeError");
  });

  await check("getStats 返回 VNDB 数据库统计（首页底部图表依赖）", async () => {
    const { getStats } = await import("@/lib/api/endpoints/ulist");
    const s = await getStats();
    assert(s.vn > 0 && s.releases > 0, "应返回正数条目");
    assert(s.chars > 0 && s.tags > 0, "角色 / 标签数也应存在");
  });

  await check("getTag + queryTags", async () => {
    const t = await getTag("105");
    assert(t.results.length === 1, "标签应存在");
    const list = await queryTags({ search: "yuri", results: 3 });
    assert(list.results.length > 0, "yuri 标签应有结果");
  });

  await check("读公开用户清单（u2，不需要 token）", async () => {
    const r = await queryList({ user: "u2", results: 2 });
    assert(Array.isArray(r.results), "应返回数组");
  });

  // ⚠️ 查询参数是 `q`；写错成 `id` 会 400。这个函数此前没人调用，bug 埋了很久
  await check("getUser 用 q 参数（传 id 会 400）", async () => {
    const { getUser } = await import("@/lib/api/endpoints/ulist");
    const byId = await getUser("u2");
    assert(byId.u2?.username === "Yorhel", "按 id 应查到 Yorhel");
    const byName = await getUser("Yorhel");
    assert(byName.Yorhel?.id === "u2", "按用户名也应查到 u2");
  });

  await check("getListItem 单条读取（清单编辑页 / 详情入口依赖）", async () => {
    const r = await getListItem("v17", "u2");
    assert(r.results.length === 1 && r.results[0]?.id === "v17", "应返回 v17 单条");
  });

  /* ---- 搜索页的四档（作品 / 制作人员 / 用户 / 制作者） ---- */

  await check("queryStaff 搜主名与搜别名都能命中同一个人（不加 ismain 过滤）", async () => {
    const { queryStaff } = await import("@/lib/api/endpoints/catalog");
    // s208 有两个名字行：主名「SCA-Ji / SCA-自」与别名「Sukaji / すかぢ」
    const byMain = await queryStaff({ search: "SCA-自", results: 5 });
    const byAlias = await queryStaff({ search: "sukaji", results: 5 });
    assert(
      byMain.results.some((s) => s.id === "s208"),
      "搜主名应命中 s208"
    );
    // ⚠️ 真事故：曾经为去重加 `ismain = 1`，结果搜别名一条都不剩
    //（官网能搜到「sukaji」，本项目搜不到）。去重改在客户端按 id 做。
    assert(
      byAlias.results.some((s) => s.id === "s208"),
      "搜别名也应命中 s208（不能被 ismain 过滤掉）"
    );
    const alias = byAlias.results.find((s) => s.id === "s208");
    assert(alias?.ismain === false, "别名命中的是 ismain=false 的那一行");
  });

  await check("queryProducers 搜索（搜索页「制作者」依赖）", async () => {
    const { queryProducers } = await import("@/lib/api/endpoints/catalog");
    const r = await queryProducers({ search: "Key", sort: "searchrank", results: 5 });
    assert(r.results.length > 0, "Key 应有结果");
    assert(
      r.results.some((p) => p.id === "p24"),
      "Key（p24）应在结果里"
    );
  });

  await check("findUser 精确匹配（搜索页「用户」依赖）", async () => {
    const { findUser } = await import("@/lib/api/endpoints/ulist");
    const byName = await findUser("Yorhel");
    assert(byName?.id === "u2", `按用户名应查到 u2，实际 ${JSON.stringify(byName)}`);
    const byId = await findUser("u2");
    assert(byId?.username === "Yorhel", "按用户 id 也应查到");
  });

  await check("findUser 不支持模糊匹配（Kana 的硬限制，UI 必须说明）", async () => {
    const { findUser } = await import("@/lib/api/endpoints/ulist");
    // 实测 ?q=yor → {"yor": null}：用户名必须写全（只是不区分大小写）
    const partial = await findUser("yor");
    assert(partial === null, `部分用户名应查不到，实际 ${JSON.stringify(partial)}`);
  });

  await check("搜索页行数据与文案（features/search/search-logic 纯逻辑）", async () => {
    const {
      looksLikeUserId,
      resultHeadline,
      SCOPE_LABEL,
      SCOPE_NOUN,
      SCOPE_OPTIONS,
      SEARCH_PLACEHOLDER,
      toProducerEntries,
      toStaffEntries,
      userMissDescription,
    } = await import("@/features/search/search-logic");

    // 分段控件顺序：作品（默认）在最左
    assert(SCOPE_OPTIONS[0]?.value === "vn", "默认应是作品");
    assert(SCOPE_OPTIONS.length === 4, "应有 4 档：作品 / 人员 / 用户 / 厂商");
    for (const option of SCOPE_OPTIONS) {
      assert(option.label.length > 0, `${option.value} 缺档位名`);
    }
    // ⚠️ 只有一句通用 placeholder：Master 要求移除每个搜索条目的 hint，
    // 所以这里不能出现「按档位给提示」的表（曾经有过 SCOPE_PLACEHOLDER / SCOPE_IDLE）
    assert(SEARCH_PLACEHOLDER.length > 0, "输入框应有 placeholder");
    // 控件上用短名（人员 / 厂商），完整说法在 SCOPE_NOUN 里 —— 两处不能写成一样：
    // 「制作人员」与「制作者」只差一个字，用户分不清哪个是 staff 哪个是 producer
    assert(
      SCOPE_LABEL.staff === "人员" && SCOPE_NOUN.staff === "制作人员",
      "staff 档位名 / 集合名"
    );
    assert(
      SCOPE_LABEL.producer === "厂商" && SCOPE_NOUN.producer === "制作者",
      "producer 档位名 / 集合名"
    );
    // hint 移走后，「用户只能精确匹配」这条限制只能在**搜不到时**的文案里说清楚
    assert(
      userMissDescription("yor").includes("不支持模糊搜索"),
      "用户未命中的文案必须说明只能精确匹配"
    );

    assert(looksLikeUserId("u2") && looksLikeUserId(" U123 "), "u123 形式应识别为用户 id");
    assert(!looksLikeUserId("yorhel") && !looksLikeUserId("user"), "普通用户名不是 id");
    assert(
      userMissDescription("yor").includes("不支持模糊搜索"),
      "部分用户名的未命中提示要说明只能精确匹配"
    );
    assert(userMissDescription("u999999").includes("u999999"), "id 形式的提示要带上 id");
    assert(resultHeadline("key") === "搜索「key」的结果", "结果标题格式");

    const staff = toStaffEntries([{ results: [{ id: "s1", name: "A", original: "Ｂ" }] }]);
    assert(staff[0]?.meta === "s1" && staff[0]?.original === "Ｂ", "staff 行应带 id 与原名");
    const producer = toProducerEntries([{ results: [{ id: "p24", name: "Key", type: "co" }] }]);
    assert(producer[0]?.meta === "公司 · p24", "制作者行应显示「类型 · id」");
    assert(toStaffEntries(undefined).length === 0, "没有数据时应返回空数组");
  });

  await check("toStaffEntries 按 id 去重、优先主名行（s208 的两行只出一行）", async () => {
    const { toStaffEntries } = await import("@/features/search/search-logic");
    // 只有别名行命中（搜「sukaji」）：显示命中的那个名字，与官网一致
    const aliasOnly = toStaffEntries([
      { results: [{ id: "s208", name: "Sukaji", original: "すかぢ", ismain: false }] },
    ]);
    assert(aliasOnly.length === 1, "别名行也要出结果");
    assert(aliasOnly[0]?.title === "Sukaji", `应显示命中的别名，实际 ${aliasOnly[0]?.title}`);

    // 主名行与别名行都命中（分页可能把它们分到两页）：只出一行，且用主名行
    const both = toStaffEntries([
      { results: [{ id: "s208", name: "Sukaji", original: "すかぢ", ismain: false }] },
      { results: [{ id: "s208", name: "SCA-Ji", original: "SCA-自", ismain: true }] },
    ]);
    assert(both.length === 1, "同一个 id 只能出一行");
    assert(both[0]?.title === "SCA-Ji", `应优先主名行，实际 ${both[0]?.title}`);

    // 顺序反过来也一样（主名先到时不被别名行覆盖）
    const reversed = toStaffEntries([
      { results: [{ id: "s208", name: "SCA-Ji", ismain: true }] },
      { results: [{ id: "s208", name: "Sukaji", ismain: false }] },
    ]);
    assert(reversed.length === 1 && reversed[0]?.title === "SCA-Ji", "别名行不能覆盖主名行");

    // 不同 id 各自一行，顺序按 searchrank 保持
    const mixed = toStaffEntries([
      {
        results: [
          { id: "s1", name: "A", ismain: true },
          { id: "s2", name: "B", ismain: true },
          { id: "s1", name: "A2", ismain: false },
        ],
      },
    ]);
    assert(mixed.length === 2, "两个 id 应出两行");
    assert(mixed[0]?.title === "A" && mixed[1]?.title === "B", "行序应与搜索排序一致");
  });

  /* ---- 首页信息流：最新评价（抓取）/ 即将发售 / 最新上架（API） ---- */

  await check("queryUpcomingVns：只给未来发售、日期升序、TBA 已排掉", async () => {
    const { queryUpcomingVns } = await import("@/lib/api/endpoints/vn");
    const { todayIso } = await import("@/utils/format");
    const today = todayIso();

    /*
     * 端点的字段集刻意不含 `released`（卡片只画封面和名称），所以这里用一条
     * 同样过滤/排序的裸查询把日期取回来验不变式，再核对端点取的 id 与它一致
     * —— 顺带证明端点用的就是这套过滤与排序。
     */
    const raw = await api.query<{ id: string; released?: string }>("/vn", {
      filters: ["and", ["released", ">", today]],
      fields: "id,released",
      sort: "released",
      results: 10,
    });
    assert(raw.results.length > 0, "应有即将发售的作品");
    for (const vn of raw.results) {
      // ⚠️ TBA 在 Kana 里按「最大」参与排序，不过滤的话整页都是「未定档」
      assert(vn.released !== "TBA", `${vn.id} 不该是 TBA`);
      assert(releasedSortKey(vn.released) > today, `${vn.id} 的 ${vn.released} 应晚于今天`);
    }
    const dates = raw.results.map((vn) => releasedSortKey(vn.released));
    assert(
      dates.every((d, i) => i === 0 || d >= (dates[i - 1] as string)),
      "应按发售日升序（越近越靠前）"
    );

    const viaEndpoint = await queryUpcomingVns(today, 10);
    assert(
      viaEndpoint.results.map((vn) => vn.id).join(",") === raw.results.map((vn) => vn.id).join(","),
      "端点应与「released > 今天 + 升序」这条查询取到同一批"
    );
  });

  await check("queryJustReleasedVns：只给已发售、日期降序、TBA 已排掉", async () => {
    const { queryJustReleasedVns } = await import("@/lib/api/endpoints/vn");
    const { todayIso } = await import("@/utils/format");
    const today = todayIso();

    const raw = await api.query<{ id: string; released?: string }>("/vn", {
      filters: ["and", ["released", "<=", today]],
      fields: "id,released",
      sort: "released",
      reverse: true,
      results: 10,
    });
    assert(raw.results.length > 0, "应有新发售的作品");
    for (const vn of raw.results) {
      // ⚠️ 不加 `<=` 的话 TBA 排在最前，出来的是「一堆未定档」而不是「刚发售」
      assert(vn.released !== "TBA", `${vn.id} 不该是 TBA`);
      assert(releasedSortKey(vn.released) <= today, `${vn.id} 的 ${vn.released} 应不晚于今天`);
    }
    const dates = raw.results.map((vn) => releasedSortKey(vn.released));
    assert(
      dates.every((d, i) => i === 0 || d <= (dates[i - 1] as string)),
      `应按发售日降序（刚发售的排最前），实际 ${dates.join(" ")}`
    );

    const viaEndpoint = await queryJustReleasedVns(today, 10);
    assert(
      viaEndpoint.results.map((vn) => vn.id).join(",") === raw.results.map((vn) => vn.id).join(","),
      "端点应与「released <= 今天 + 降序」这条查询取到同一批"
    );
  });

  await check("首页信息流条数与官网首页一致（各 10 条）", async () => {
    const { FEED_COUNT, FEED_TABS, FEED_TAB_LABEL } = await import("@/features/home/feed-config");
    assert(FEED_COUNT === 10, "官网首页三栏都是 10 条");
    assert(FEED_TABS.length === 3, "应有 3 档");
    for (const tab of FEED_TABS) {
      assert(FEED_TAB_LABEL[tab].length > 0, `${tab} 缺中文名`);
    }
  });

  await check("抓取并解析最新评价列表（首页「最新评价」依赖）", async () => {
    const { fetchLatestReviews } = await import("@/features/review/client");
    const { FEED_COUNT } = await import("@/features/home/feed-config");
    const page = await fetchLatestReviews();
    assert(page.reviews.length >= FEED_COUNT, `至少应有 ${FEED_COUNT} 条`);
    assert(page.hasMore, "官网有 rel=next（说明这页是列表页而不是截断的首页）");
    const first = page.reviews[0]!;
    assert(/^w\d+$/.test(first.id), `评价 id 形状错：${first.id}`);
    assert(first.title.length > 0, "应有作品名");
    assert(first.author !== null, "应有作者名");
    assert(/^u\d+$/.test(first.authorId ?? ""), `作者 id 形状错：${first.authorId}`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(first.date ?? ""), `日期形状错：${first.date}`);
    assert(first.score === null || (first.score >= 0 && first.score <= 10), "分数应在 0–10");
    assert(first.length !== null, "应有通关状态 / 时长");
  });

  await check("抓取并解析单条评价（站内评价页依赖）", async () => {
    const { fetchLatestReviews, fetchReview } = await import("@/features/review/client");
    const list = await fetchLatestReviews();
    const id = list.reviews[0]!.id;
    const review = await fetchReview(id);
    assert(review !== null, "应解析出一条评价");
    const detail = review!;
    assert(detail.id === id, "id 应与请求的一致");
    // 作品名能对上列表那一行（两处解析的是同一条数据的两个页面）
    assert(
      detail.title === list.reviews[0]!.title,
      `详情与列表的作品名应一致：${detail.title} vs ${list.reviews[0]!.title}`
    );
    assert(/^v\d+$/.test(detail.vnId ?? ""), `应能拿到作品 id（能跳站内详情）：${detail.vnId}`);
    assert(/^u\d+$/.test(detail.authorId ?? ""), `应能拿到作者 id：${detail.authorId}`);
    assert(detail.date !== null, "应有日期");
    assert(detail.score === null || (detail.score >= 0 && detail.score <= 10), "分数应在 0–10");
    assert(detail.content.length > 0, "正文节点树不应为空");
  });

  /*
   * 平台 / 语言 / 通关状态是从 `abbr[title]` 里认出来的，而**作者可以不填**。
   *
   * ⚠️ 不能拿「最新那条」来断言它们存在 —— 实测最新 10 条评价里有 6 条一个
   * `abbr` 都没有（w18538 / w18533 / w18530 / w18529 / w18528 / w18527），
   * 那是作者留空，不是官网改版。原来那条断言就是这么把偶然内容当成了契约，
   * 于是「最新那条恰好留空」时冒红，而解析其实完全正常。
   *
   * 正确的做法是扫几条、找**确实填了**的那条 —— 这样白名单失效（官网换了
   * `Windows` / `Japanese` / `complete` 的写法）才会红，那才是真正的回归信号。
   */
  await check("评价的 abbr 白名单仍能认出平台 / 语言 / 通关状态", async () => {
    const { fetchLatestReviews } = await import("@/features/review/client");
    const { fetchVndbHtml } = await import("@/lib/scrape/client");
    const { parseReviewPage } = await import("@/features/review/scrape");

    const list = await fetchLatestReviews();
    // 6 条足够：留空率约 6 成，扫 6 条还一条都没填上的概率很低
    const SCAN = 6;
    let sawPlatform = false;
    let sawLanguage = false;
    let sawStatus = false;

    for (const entry of list.reviews.slice(0, SCAN)) {
      const detail = parseReviewPage(await fetchVndbHtml(`/${entry.id}`), entry.id);
      if (!detail) continue;
      if (detail.platforms.length > 0) sawPlatform = true;
      if (detail.languages.length > 0) sawLanguage = true;
      if (detail.status !== null) sawStatus = true;
      assert(
        detail.platforms.every((p) => !detail.languages.includes(p)),
        "平台与语言不能混在一起"
      );
      // 三个维度都见过了就不必继续抓 —— 抓网页有频率限制，别白花钱
      if (sawPlatform && sawLanguage && sawStatus) break;
    }

    assert(sawPlatform, `扫了最新 ${SCAN} 条评价都没认出平台 —— abbr 白名单可能已随官网改版失效`);
    assert(sawLanguage, `扫了最新 ${SCAN} 条评价都没认出语言 —— abbr 白名单可能已失效`);
    assert(sawStatus, `扫了最新 ${SCAN} 条评价都没认出通关状态 —— abbr 白名单可能已失效`);
  });

  await check("清单行导航 id 取顶层：/ulist 的 vn 子对象不带 id", async () => {
    const r = await queryList({ user: "u2", results: 5 });
    assert(r.results.length > 0, "u2 清单应有条目");
    // VNDB 会省略与顶层相同的嵌套 id：item.vn.id 是 undefined，
    // 导航必须用 item.id —— 用 vn.id 会拼出 /ulist/undefined → 400（真事故）。
    for (const item of r.results) {
      assert(item.vn === undefined || item.vn.id === undefined, `v${item.id} 的 vn.id 应缺省`);
    }
    const first = r.results[0]!;
    const single = await getListItem(first.id, "u2");
    assert(single.results[0]?.id === first.id, `顶层 id ${first.id} 应能查回单条`);
  });

  // ⚠️ 清单 Tab 的标签筛选已经改成**本地**筛（Master 要求，切标签零请求），
  // 这条只验证 Kana 的 `label` 过滤器本身可用 —— 本地筛选的语义要与它一致
  // （`features/ulist/list-filter` 的 `itemHasLabel`，那边有纯逻辑冒烟）
  await check("Kana 的 label 过滤器可用（本地筛选的语义基准）", async () => {
    const r = await queryList({ user: "u2", filters: pred("label", "=", 1), results: 5 });
    assert(r.results.length > 0, "应有 Playing 标签的条目");
    for (const item of r.results) {
      assert(
        (item.labels ?? []).some((label) => label.id === 1),
        `条目 ${item.id} 应含 label 1`
      );
    }
  });

  await check("清单按我的打分排序（vote 降序，服务端排序）", async () => {
    const r = await queryList({ user: "u2", sort: "vote", reverse: true, results: 5 });
    const votes = r.results.map((item) => item.vote ?? -1);
    assert(votes.length > 1, "应有多条可比");
    for (let i = 1; i < votes.length; i += 1) {
      const prev = votes[i - 1] as number;
      const curr = votes[i] as number;
      assert(prev >= curr, `vote 应降序：${votes.join(",")}`);
    }
  });

  await check("读公开用户标签", async () => {
    const labels = await getListLabels("u2");
    assert(Array.isArray(labels), "应返回数组");
  });

  await check("ULIST_STATS_FIELDS 合法（收藏统计页依赖）", async () => {
    const r = await queryList({ user: "u2", fields: ULIST_STATS_FIELDS, results: 3 });
    assert(r.results.length > 0, "应有结果");
    const withDev = r.results.find((item) => (item.vn?.developers?.length ?? 0) > 0);
    assert(withDev !== undefined, "统计字段应能取到 vn.developers");
  });

  await check("queryRandomQuote 字段集合法（每日语录依赖）", async () => {
    const r = await queryRandomQuote();
    assert(typeof r.results[0]?.quote === "string", "应返回一条带 quote 的语录");
  });

  await check("queryQuotes 按 vn 取语录（VN 详情 · 语录页签依赖）", async () => {
    const { queryQuotes } = await import("@/lib/api/endpoints/vn");
    const r = await queryQuotes({ vnId: "v17", results: 5 });
    assert(r.results.length > 0, "v17 应该有语录");
    assert(typeof r.results[0]?.quote === "string", "应返回带 quote 的语录");
  });

  /*
   * 讨论模块走的是**网站 HTML 抓取**（Kana API 没有讨论端点）。
   * 这条真请求覆盖两件事：反爬 Cookie 挑战能过、列表 HTML 结构还能解析。
   * 官网改版导致解析失效时，这里会先红。
   */
  await check("抓取并解析 VNDB 讨论板（discussion module 依赖）", async () => {
    const { fetchVnDiscussions } = await import("@/features/discussion/client");
    const page = await fetchVnDiscussions("v17", 1);
    assert(page.threads.length > 0, "v17 应有讨论帖");
    const first = page.threads[0];
    assert(Boolean(first && /^t\d+$/.test(first.id)), `thread id 形状不对：${first?.id}`);
    assert(Boolean(first?.title), "应解析出标题");
    assert(typeof first?.replies === "number", "回复数应为数字");
  });

  /*
   * 站内帖子页要抓单帖正文（每页 25 楼）并把 HTML 解析成节点树：
   * t950 是官方建议贴，正文里有引用块、链接、粗体，正好覆盖解析分支。
   */
  await check("抓取并解析讨论帖正文（站内帖子页依赖）", async () => {
    const { fetchThread } = await import("@/features/discussion/client");
    const page = await fetchThread("t950", 1);
    assert(page.posts.length > 0, "t950 应有楼层");
    assert(Boolean(page.title), "应解析出帖子标题");
    const first = page.posts[0];
    assert(Boolean(first && first.number > 0), "楼层号应大于 0");
    assert(Boolean(first && first.content.length > 0), "正文节点不应为空");
    const hasQuote = page.posts.some((post) => post.content.some((node) => node.type === "quote"));
    assert(hasQuote, "t950 应解析出引用块");
    assert(
      page.posts.some((post) => post.authorId?.startsWith("u")),
      "楼层作者应带出用户 id（用户页跳转靠它）"
    );
  });

  /*
   * 用户资料页：`GET /user` 只有 id / username / lengthvotes，
   * 注册时间 / 投票分布 / 清单规模 / 论坛统计全靠抓 HTML。
   */
  await check("抓取并解析用户资料页（用户详情页依赖）", async () => {
    const { fetchUserProfile } = await import("@/features/user/client");
    const profile = await fetchUserProfile("u2");
    assert(profile !== null, "u2 应能解析出资料");
    assert(profile?.username === "Yorhel", `用户名应为 Yorhel，实际 ${profile?.username}`);
    assert(profile?.registered === "2007-09-28", `注册日期应对，实际 ${profile?.registered}`);
    assert((profile?.votes ?? 0) > 0, "应有投票数");
    assert((profile?.voteDistribution.length ?? 0) === 10, "打分分布应有 10 档");
    assert((profile?.recentVotes.length ?? 0) > 0, "应有近期打分");
    assert((profile?.traits.length ?? 0) > 0, "应有自我标记的特性");
  });

  await check("讨论列表能取到发起人 / 最后回复者的用户 id", async () => {
    const { fetchVnDiscussions } = await import("@/features/discussion/client");
    const page = await fetchVnDiscussions("v17", 1);
    const withStarter = page.threads.find((thread) => thread.starterId);
    assert(Boolean(withStarter), "至少一条帖子应带出发起人 id");
    assert(withStarter?.starterId?.startsWith("u"), `用户 id 形状不对：${withStarter?.starterId}`);
  });

  // 用户详情页「全部投票」：走 API，验证瘦字段集合法 + 确实能取到打分记录
  await check("USER_VOTE_FIELDS 合法 + 能取到他人打分记录", async () => {
    const { queryUserVotes } = await import("@/lib/api/endpoints/ulist");
    const r = await queryUserVotes({ user: "u2", results: 10 });
    assert(r.results.length > 0, "u2 应有打分记录");
    const voted = r.results.filter((item) => item.vote != null);
    assert(voted.length > 0, "应能筛出带 vote 的条目");
    assert(Boolean(voted[0]?.vn?.title), "应带回 vn.title");
    assert(voted[0]?.voted != null, "应带回投票时间戳");
  });

  // 游玩时长：`/ulist` 没有这个字段，只能抓 `/u…/lengthvotes`
  await check("抓取并解析用户游玩时长（/ulist 没有该字段）", async () => {
    const { fetchUserLengthVotes } = await import("@/features/user/client");
    const page = await fetchUserLengthVotes("u2", 1);
    assert(page.entries.length > 0, "u2 应有游玩时长记录");
    const first = page.entries[0];
    assert(Boolean(first?.vnId.startsWith("v")), `作品 id 形状不对：${first?.vnId}`);
    assert(/\d/.test(first?.time ?? ""), `时长应有数字，实际 ${first?.time}`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(first?.date ?? ""), `日期形状不对：${first?.date}`);
  });

  await check("ULIST_TAG_FIELDS 合法（收藏统计 · 游戏类型依赖）", async () => {
    const r = await queryList({ user: "u2", fields: ULIST_TAG_FIELDS, results: 5 });
    assert(
      r.results.some((item) => (item.vn?.tags?.length ?? 0) > 0),
      "应能取到 vn.tags.id"
    );
  });

  /*
   * 类型标签清单是**硬编码**的（VNDB 没有 genre 字段，类型就是 Technical 顶层标签），
   * 这条真接口检查保证 id → 名字没漂移；名字对不上说明清单该更新了。
   */
  await check("GAME_TYPE_TAGS 与 /tag 一致（类型标签没漂移）", async () => {
    const response = await api.query<{ id: string; name: string }>("/tag", {
      filters: ["or", ...GAME_TYPE_TAGS.map((type) => pred("id", "=", type.id))],
      fields: "id,name,category",
      results: 50,
    });
    const byId = new Map(response.results.map((tag) => [tag.id, tag.name]));
    for (const type of GAME_TYPE_TAGS) {
      assert(byId.get(type.id) === type.name, `${type.id} 名字对不上：期望 ${type.name}`);
    }
  });

  /* ---- 5. 限流器 ---- */
  await section("5. 限流器（不发真实请求，纯逻辑）");

  await check("滑动窗口：已用满 max 后必须等待到最早的请求过期", () => {
    let now = 1_000_000;
    const limiter = new RateLimiter({ max: 3, windowMs: 1000, now: () => now });
    const internals = limiter as unknown as { timestamps: number[] };

    assert(limiter.msUntilReady() === 0, "0 次时应放行");
    internals.timestamps.push(now, now, now);
    // 已用满 3/3，最早的一条在 now+1000 过期 → 需等 1000ms
    assert(limiter.msUntilReady() === 1000, `满额时应等 1000ms，实际 ${limiter.msUntilReady()}`);
    assert(limiter.usage().used === 3, "used 应为 3");

    now += 1001;
    assert(limiter.msUntilReady() === 0, "窗口滑过后应放行");
    assert(limiter.usage().used === 0, "过期记录应被清理，used 归 0");
  });

  await check("滑动窗口：部分记录过期后正确计算剩余等待", () => {
    const t0 = 1_000_000;
    let now = t0;
    const limiter = new RateLimiter({ max: 2, windowMs: 1000, now: () => now });
    const internals = limiter as unknown as { timestamps: number[] };

    // 两次请求发生在不同时刻，才能验证「部分过期」
    internals.timestamps.push(t0);
    now = t0 + 400;
    internals.timestamps.push(now);
    assert(limiter.usage().used === 2, "应已用满 2/2");

    // 前进 1001ms：第一条（t0）过期，第二条（t0+400）还差 399ms
    now = t0 + 1001;
    assert(limiter.usage().used === 1, `应只剩 1 条，实际 ${limiter.usage().used}`);
    assert(limiter.msUntilReady() === 0, "还有 1 个空位，应放行");
  });

  await check("滑动窗口：一次只释放一个名额，不会双倍放行（固定桶缺陷）", () => {
    const t0 = 1_000_000;
    let now = t0;
    const limiter = new RateLimiter({ max: 2, windowMs: 1000, now: () => now });
    const internals = limiter as unknown as { timestamps: number[] };
    internals.timestamps.push(t0);
    now = t0 + 400;
    internals.timestamps.push(now);

    // 前进 1001ms：第一条（t0，t0+1000 过期）已过期；第二条（t0+400，t0+1400 过期）还在
    now = t0 + 1001;
    assert(limiter.usage().used === 1, `应只释放 1 个名额，实际 used=${limiter.usage().used}`);
    assert(limiter.msUntilReady() === 0, "还有 1 个空位，应放行");

    // 补回后再次满额，需等第二条在 t0+1400 过期
    internals.timestamps.push(now);
    assert(limiter.usage().used === 2, "补回后应满额");
    assert(limiter.msUntilReady() === 399, `应等第二条过期 399ms，实际 ${limiter.msUntilReady()}`);
  });

  await check("usage 反映当前用量", () => {
    const limiter = new RateLimiter({ max: 200, windowMs: 300_000 });
    const usage = limiter.usage();
    assert(usage.max === 200, "max 应为 200");
    assert(usage.used === 0, "初始 used 应为 0");
  });

  await check("acquire 会串行放行（模拟取 3 个名额）", async () => {
    const limiter = new RateLimiter({ max: 3, windowMs: 200, now: () => Date.now() });
    const t0 = Date.now();
    const commits = await Promise.all([limiter.acquire(), limiter.acquire(), limiter.acquire()]);
    commits.forEach((c) => c());
    assert(Date.now() - t0 < 100, "3 次应立即返回");
  });

  /* ---- 6. 写入层纯逻辑 ---- */
  await section("6. 清单写入的标签清理（纯逻辑，不需要 token）");

  await check("过滤虚拟标签 0 / 7", () => {
    assert(sanitizeLabels([0, 7, 2]).length === 1, "应只剩 label 2");
  });

  await check("互斥状态标签只保留最后一个", () => {
    const result = sanitizeLabels([1, 2, 3]);
    assert(result.length === 1, `应只剩 1 个，实际 ${JSON.stringify(result)}`);
    assert(result[0] === 3, "应保留最后出现的 3");
  });

  await check("互斥组（1/2/3/4/5）只留一个，自定义标签（10+）可共存", () => {
    // 1=Playing 2=Finished 3=Stalled 4=Dropped 5=Plan to play —— 互斥
    const exclusive = sanitizeLabels([1, 2, 3]);
    assert(exclusive.length === 1, `互斥组应只剩 1 个，实际 ${JSON.stringify(exclusive)}`);
    assert(exclusive[0] === 3, "应保留最后出现的 3");

    const mixed = sanitizeLabels([1, 10, 20]);
    assert(mixed.length === 3, `10/20 应与 1 共存，实际 ${JSON.stringify(mixed)}`);
  });

  await check("toggleLabel 切换行为正确", () => {
    let labels = toggleLabel([], 2);
    assert(labels.includes(2), "应加上 2");
    labels = toggleLabel(labels, 2);
    assert(!labels.includes(2), "应移除 2");
  });

  await check("加互斥标签时自动清掉旧的", () => {
    const result = toggleLabel([1], 2);
    assert(!result.includes(1) && result.includes(2), "应 1 被 2 替换");
  });

  /* ---- 7. 攻略（静态 JSON 仓库 + 纯逻辑） ---- */
  await section("7. 攻略模块（features/walkthrough）");

  /*
   * 解析容错是这里最要紧的：攻略是**别人维护的仓库**，字段随时可能变。
   * 所以先用构造出来的脏数据验证「坏条目被丢掉、好数据仍能解析」，
   * 再打一次真实仓库确认线上结构仍然对得上。
   */
  await check("索引解析：缺 vid / path 的坏条目被丢掉，其余完整保留", () => {
    const index = parseWalkthroughIndex({
      schemaVersion: 1,
      count: 2,
      latestUpdatedAt: "2026-10-03",
      walkthroughs: [
        {
          vid: "v4",
          path: "walkthroughs/1-10000/v4.json",
          updatedAt: "2026-03-24",
          name: { "zh-cn": "CLANNAD" },
        },
        // 缺 path → 定位不到文件，整条丢
        { vid: "v9", updatedAt: "2026-01-01" },
        { path: "walkthroughs/v9.json" },
        // 不是对象 → 丢
        "garbage",
        null,
      ],
    });

    assert(index.walkthroughs.length === 1, `应只剩 1 条，实际 ${index.walkthroughs.length}`);
    assert(index.walkthroughs[0].vid === "v4", "vid 应为 v4");
    // 缺省计数补 0，而不是 undefined / NaN
    assert(index.walkthroughs[0].level === 0, "缺省 level 应补 0");
    assert(index.walkthroughs[0].name["zh-cn"] === "CLANNAD", "多语言名应保留");
  });

  await check("索引解析：walkthroughs 不是数组时抛错（拿到的不是索引文件）", () => {
    let threw = false;
    try {
      parseWalkthroughIndex({ schemaVersion: 1, walkthroughs: "nope" });
    } catch {
      threw = true;
    }
    assert(threw, "结构不对时必须抛错，不能静默返回空索引");
  });

  await check("攻略解析：未知枚举保留原值，空 content 的步骤与无 name 的结局被丢掉", () => {
    const walkthrough = parseWalkthrough(
      {
        vid: "v4",
        level: 1,
        updatedAt: "2026-03-24",
        routes: [
          {
            id: "r1",
            name: "游戏攻略",
            endings: [
              {
                id: "e1",
                name: "TRUE END",
                type: "some_future_type",
                steps: [
                  { id: "s1", type: "save", content: "SAVE 1", subfix: "初期" },
                  // 空 content 的步骤没有意义
                  { id: "s2", type: "choice", content: "   " },
                  { id: "s3", type: "choice" },
                  // 缺 type 默认按 choice 处理（仓库里绝大多数是 choice）
                  { id: "s4", content: "睡了" },
                ],
              },
              // 没有 name 的结局丢
              { id: "e2", type: "bad", steps: [] },
            ],
          },
        ],
      },
      "v4"
    );

    assert(walkthrough.routes.length === 1, "应只剩 1 条线路");
    assert(walkthrough.routes[0].endings.length === 1, "应只剩 1 个结局");
    const steps = walkthrough.routes[0].endings[0].steps ?? [];
    assert(steps.length === 2, `应只剩 2 个步骤，实际 ${steps.length}`);
    assert(steps[1].type === "choice", "缺 type 的步骤应默认成 choice");
    // ⚠️ 未知结局类型必须保留 —— 丢掉等于让攻略凭空少一段
    assert(walkthrough.routes[0].endings[0].type === "some_future_type", "未知结局类型应原样保留");
    assert(endingMeta("some_future_type").label === "", "未知类型不该给用户显示英文枚举");
  });

  await check("攻略解析：vid 缺失时用调用方传入的兜底值", () => {
    const walkthrough = parseWalkthrough({ routes: [] }, "v17");
    assert(walkthrough.vid === "v17", "应回退到 fallbackVid");
    assert(walkthrough.routes.length === 0, "空线路是合法结果，由组件渲染空态");
  });

  await check("分页查找：大小写不敏感，找不到时返回 undefined", () => {
    const index = parseWalkthroughIndex({
      walkthroughs: [{ vid: "v4", path: "p/v4.json" }],
    });
    assert(findEntry(index, "v4") !== undefined, "v4 应命中");
    assert(findEntry(index, "V4") !== undefined, "V4 应命中（比较前统一小写）");
    assert(findEntry(index, "v99999") === undefined, "不在索引里应返回 undefined");
    assert(findEntry(undefined, "v4") === undefined, "索引未就绪时应返回 undefined");
  });

  await check("步骤分段：同名 group 归成一段，连续无 group 的合成一段，key 取首个步骤 id", () => {
    const groups = groupSteps([
      { id: "s1", type: "choice", content: "a", group: "第一章" },
      { id: "s2", type: "choice", content: "b", group: "第一章" },
      { id: "s3", type: "choice", content: "c", group: "第二章" },
      { id: "s4", type: "choice", content: "d" },
      { id: "s5", type: "choice", content: "e" },
    ]);

    // 第一章(2) + 第二章(1) + 无 group(2) = 3 段
    assert(groups.length === 3, `应分成 3 段，实际 ${groups.length}`);
    assert(groups[0].steps.length === 2, "前两步同章节，应合成一段");
    assert(groups[0].key === "s1", "key 应取该段第一个步骤的 id");
    // 无 group 的连续步骤合成一段、标题为空（渲染时不画标题行）
    assert(groups[2].title === "", "无 group 的段标题应为空");
    assert(groups[2].steps.length === 2, "连续无 group 的步骤应合成一段");
    // ⚠️ 章节名不能当 key：全篇都没写 group 时标题都是 ""，会撞成一个 key
    assert(groups[0].key !== groups[1].key, "不同段的 key 必须不同");
  });

  await check("统计：实际数一遍，不信任索引里的 *Count", () => {
    const walkthrough = parseWalkthrough(
      {
        routes: [
          { name: "a", endings: [{ name: "x", steps: [{ content: "1" }, { content: "2" }] }] },
          { name: "b", endings: [{ name: "y", steps: [{ content: "3" }] }, { name: "z" }] },
        ],
      },
      "v1"
    );
    const stats = countStats(walkthrough);
    assert(stats.routes === 2, `线路数应为 2，实际 ${stats.routes}`);
    assert(stats.endings === 3, `结局数应为 3，实际 ${stats.endings}`);
    assert(stats.steps === 3, `步骤数应为 3，实际 ${stats.steps}`);
  });

  await check("剧透打码：按等长替换，空白原样保留", () => {
    const text = "SAVE 1";
    const masked = maskText(text);
    assert(masked.length === text.length, `打码后长度应不变：${masked.length} vs ${text.length}`);
    assert(masked.includes(" "), "空格必须保留，否则读不成句");
    assert(!masked.includes("S"), "原文字符不应残留");
  });

  await check("LRU 淘汰：只动没钉住的，且不改传入数组", () => {
    const ledger = [
      { vid: "v1", accessedAt: 100, pinned: false },
      { vid: "v2", accessedAt: 300, pinned: false },
      { vid: "v3", accessedAt: 200, pinned: false },
      { vid: "v4", accessedAt: 400, pinned: false },
    ];
    // 留最近 2 个（v4 / v2），淘汰最旧的 v1 / v3
    const stale = overflowVids(ledger, 2);
    assert(stale.length === 2, `应淘汰 2 个，实际 ${stale.length}`);
    assert(stale.includes("v1") && stale.includes("v3"), "应淘汰最旧的两个");
    assert(!stale.includes("v4") && !stale.includes("v2"), "最近的必须留着");
    // 不得改动传入的数组（Hermes 没有 toSorted，只能在副本上排）
    assert(ledger[0].vid === "v1", "入参不应被就地排序");
    assert(overflowVids(ledger, 10).length === 0, "未超上限时不该淘汰任何项");
  });

  await check("标记过的攻略不被 LRU 淘汰（pinned 优先于上限）", () => {
    // 4 条全是最新的未标记项 + 1 条很旧但**标记过**的
    const ledger = [
      { vid: "vOld", accessedAt: 1, pinned: true },
      { vid: "v1", accessedAt: 300, pinned: false },
      { vid: "v2", accessedAt: 200, pinned: false },
      { vid: "v3", accessedAt: 100, pinned: false },
    ];
    // 上限 1：可淘汰项有 3 条，多出 2 条 → 淘汰最旧的 v3 / v2
    const stale = overflowVids(ledger, 1);
    assert(!stale.includes("vOld"), "⚠️ 标记过的篇目绝不能被淘汰（会丢用户进度）");
    assert(stale.includes("v3") && stale.includes("v2"), "应淘汰最旧的两个未标记项");

    // 全都标记过 → 一条都不淘汰（宁可多占磁盘，也不自动删用户数据）
    const allPinned = ledger.map((e) => ({ vid: e.vid, accessedAt: e.accessedAt, pinned: true }));
    assert(overflowVids(allPinned, 1).length === 0, "全部 pinned 时不该淘汰任何项");
  });

  /* ---- 8. 攻略标记 ---- */
  await section("8. 攻略标记（进度 / 重点 / 已达成）");

  await check("标记解析：脏数据收敛，空标记键不留", () => {
    const marks = parseMarks(
      {
        endings: ["e1", "e1", 42, null],
        steps: {
          s1: { done: true },
          // 只认严格 true："true" / 1 一律当作没标记
          s2: { done: "true" },
          s3: {},
          s4: { done: true, starred: true },
          s5: "garbage",
        },
        updatedAt: 1000,
      },
      "v4"
    );

    // endings 去重且只保留字符串
    assert(marks.endings.length === 1 && marks.endings[0] === "e1", "endings 应去重并丢掉非字符串");
    assert(isDone(marks, "s1") === true, "s1 应标记为已走过");
    assert(isDone(marks, "s2") === false, "字符串 'true' 不算已走过");
    assert(isStarred(marks, "s3") === false, "空对象不该变成有效标记");
    // 两个空壳键不该留在存储里
    assert(!("s3" in marks.steps), "空标记键应被丢掉");
    assert(!("s5" in marks.steps), "非对象值应被丢掉");
    assert(isStarred(marks, "s4") === true, "s4 的重点标记应保留");
    assert(hasAnyMark(marks) === true, "应判定为有标记");
  });

  await check("标记解析：非对象输入退化成空标记而不是崩", () => {
    for (const bad of [null, 42, "x", []]) {
      const marks = parseMarks(bad, "v17");
      assert(marks.endings.length === 0, "应为空");
      assert(hasAnyMark(marks) === false, "应判定为无标记");
    }
  });

  await check("步骤标记取反：两个标记互不影响，取消后不留空壳", () => {
    let marks = { ...EMPTY_MARKS, vid: "v4" };

    marks = toggleStepMark(marks, "s1", "done");
    assert(isDone(marks, "s1"), "应标记为已走过");
    assert(isStarred(marks, "s1") === false, "不该顺带变成重点");

    marks = toggleStepMark(marks, "s1", "starred");
    assert(isDone(marks, "s1") && isStarred(marks, "s1"), "两个标记应共存");

    marks = toggleStepMark(marks, "s1", "done");
    assert(isDone(marks, "s1") === false, "应取消已走过");
    // 重点还在 → 键必须留着
    assert("s1" in marks.steps, "重点还在时不应删键");

    marks = toggleStepMark(marks, "s1", "starred");
    assert("s1" in marks.steps === false, "⚠️ 两个标记都取消后必须删键，不留空壳");
  });

  await check("段落完成：批量标记且不取消已有的重点", () => {
    let marks = { ...EMPTY_MARKS, vid: "v4" };
    marks = toggleStepMark(marks, "s2", "starred");

    marks = markStepsDone(marks, ["s1", "s2", "s3"]);
    assert(isDone(marks, "s1") && isDone(marks, "s2") && isDone(marks, "s3"), "整段应标为已走过");
    assert(isStarred(marks, "s2"), "已有的重点标记不该被覆盖掉");

    // 空数组是合法输入（不该产生新对象，也算一次无谓写盘）
    const before = marks;
    assert(markStepsDone(marks, []) === before, "空数组应原样返回");
  });

  await check("结局达成取反 + 进度统计只数存在的条目", () => {
    const walkthrough = parseWalkthrough(
      {
        routes: [
          {
            name: "a",
            endings: [
              {
                id: "e1",
                name: "x",
                steps: [
                  { id: "s1", content: "1" },
                  { id: "s2", content: "2" },
                ],
              },
              { id: "e2", name: "y", steps: [{ id: "s3", content: "3" }] },
            ],
          },
        ],
      },
      "v1"
    );

    let marks = { ...EMPTY_MARKS, vid: "v1" };
    marks = toggleEnding(marks, "e1");
    marks = toggleStepMark(marks, "s1", "done");
    marks = toggleStepMark(marks, "s3", "starred");

    const p = markProgress(walkthrough, marks);
    assert(p.totalEndings === 2 && p.totalSteps === 3, "总数应现算");
    assert(p.achievedEndings === 1, "已达成应为 1");
    assert(p.doneSteps === 1, "已走过应为 1");
    assert(p.starredSteps === 1, "重点应为 1");

    // 孤立标记（作者重排步骤导致 id 消失）不计入分子，否则进度会虚高
    marks = toggleStepMark(marks, "gone", "done");
    assert(markProgress(walkthrough, marks).doneSteps === 1, "孤立标记不该计入进度");

    marks = toggleEnding(marks, "e1");
    assert(markProgress(walkthrough, marks).achievedEndings === 0, "再次点击应取消达成");
  });

  /* ---- 真实仓库 ---- */
  await check("拉取真实攻略索引（两个源需至少一个可用）", async () => {
    const index = await fetchWalkthroughIndex();
    assert(index.walkthroughs.length > 0, "索引不应为空");
    assert(index.count > 0, "count 应为正");
    for (const entry of index.walkthroughs) {
      // 路径形状错了就取不到文件 —— 索引里必须每条都带可用路径
      assert(/^walkthroughs\/.+\.json$/.test(entry.path), `path 形状不对：${entry.path}`);
      assert(/^v\d+$/.test(entry.vid), `vid 形状不对：${entry.vid}`);
    }
  });

  await check("拉取真实单篇攻略并统计（CLANNAD：1 线路 16 结局）", async () => {
    const index = await fetchWalkthroughIndex();
    const entry = findEntry(index, "v4");
    assert(entry !== undefined, "v4 应在索引里");

    const walkthrough = await fetchWalkthrough(entry!.vid, entry!.path);
    assert(walkthrough.routes.length > 0, "应至少有 1 条线路");
    assert(walkthrough.vid === "v4", `vid 应为 v4，实际 ${walkthrough.vid}`);

    const stats = countStats(walkthrough);
    assert(stats.endings > 1, "CLANNAD 是多结局作品");
    assert(stats.steps > 100, `步骤数应上百，实际 ${stats.steps}`);

    // 步骤形状：id / type / content 必须齐全，且 type 是已知的那几种
    const KNOWN = new Set(["choice", "save", "load", "note"]);
    for (const route of walkthrough.routes) {
      for (const ending of route.endings) {
        for (const step of ending.steps ?? []) {
          assert(typeof step.id === "string" && step.id !== "", "步骤缺 id");
          assert(typeof step.content === "string" && step.content !== "", "步骤缺 content");
          // `choice` 是绝大多数，先判它省掉一次 Set 查找
          if (step.type !== "choice") {
            assert(KNOWN.has(step.type), `出现未预期的步骤类型：${step.type}`);
          }
        }
      }
    }
  });

  /* ---- 汇总 ---- */
  console.log(`\n${"=".repeat(60)}`);
  console.log(`通过 ${passed} / 失败 ${failed}`);
  console.log(`${"=".repeat(60)}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("冒烟测试崩溃：", error);
  process.exit(1);
});
