/**
 * M0 冒烟测试：拿真实 API 验证 lib/api 的每一层。
 *
 *   bun run scripts/smoke-api.ts
 *
 * 覆盖：字段集合法性、过滤器编译、嵌套过滤器、限流器、错误映射、端点封装。
 * 这是 M0 的验收依据 —— 编译期类型只能保证「字段名是 VnSummary 上有的」，
 * 真正的合法性必须打真实接口才知道。
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
import { RateLimiter } from "@/lib/api/rateLimiter";
import { GAME_TYPE_TAGS } from "@/features/stats/statsLogic";

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

  await check("getListItem 单条读取（清单编辑页 / 详情入口依赖）", async () => {
    const r = await getListItem("v17", "u2");
    assert(r.results.length === 1 && r.results[0]?.id === "v17", "应返回 v17 单条");
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

  await check("清单标签过滤（服务端下推，label 过滤器生效）", async () => {
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
