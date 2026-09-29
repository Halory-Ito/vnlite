# vnlite — VNDB 客户端开发规划

> 状态：**M0 + M1 已完成 ✅** ｜ 需求全部定案 ｜ 当前：M2（用户数据层）
> 质量门禁：`bun run check` 全绿（typecheck + lint + format + 34 项 API 冒烟）；`bun run bundle:check` 可打包 Android
> Q1–Q4 已确认，Q5–Q13 采用默认建议
> 勘察数据来源：`api.vndb.org/kana/stats` 实测、`dl.vndb.org/dump/` 实测、`expo/bundledNativeModules.json` 实测、npm registry 实测、Expo 官方文档 实测

---

## 0. 一句话目标

**我的回答：**

> 一个 Android 优先的第三方 VNDB 移动客户端：**全站数据实时走 VNDB 官方 API**，本地只存用户自己的数据（清单、标签、偏好、Token）；提供浏览/搜索/筛选/详情、清单管理（打分·标签·备注·起止日期·发行版持有状态）、每日语录、随机摇一摇与统计图表。

_（以上为 pi 根据 Q1–Q4 归纳，Master 如需修改请直接改写本段）_

---

## 1. 现状盘点（无需回答）

仓库当前只有一个 `create-heroui-native-app` 空脚手架，业务代码为零。

| 项                   | 状态                                                                          |
| -------------------- | ----------------------------------------------------------------------------- |
| 技术栈               | Expo SDK 57 / RN 0.86 / React 19.2 / expo-router 57（文件路由，typedRoutes）  |
| UI                   | HeroUI Native 1.0.10 + Uniwind 1.10（Tailwind v4），已接好 Metro              |
| 现成页面             | `(tabs)/index.tsx`（HeroUI logo）、`(tabs)/explore.tsx`（空 View）            |
| 缺失                 | API 客户端、状态管理、本地存储、鉴权、图片方案、i18n、测试                    |
| 可用资源             | `.pi/skills/vndb-api`（Kana API 权威参考 + 可用脚本）                         |
| Git                  | 单次初始提交，工作区干净                                                      |
| 包管理器             | bun                                                                           |
| **Android 最低版本** | **minSdk 24（Android 7.0）** — 由 `expo-modules-autolinking` 版本目录实测确认 |

---

## 2. VNDB Kana API 的硬约束（已确定）

### 2.1 限制

| 约束                                                                 | 影响                    |
| -------------------------------------------------------------------- | ----------------------- |
| 限流 **200 次 / 5 分钟**（= 40 次/分），单请求超 3s 中止             | 必须有请求队列 + 缓存层 |
| 鉴权**只有 Token**；Kana API **没有**用户名/密码换 token 的端点      | → Q1 选 A：粘贴 Token   |
| 可写范围仅限**自己的清单**（`/ulist`、`/rlist`），不能改 VN 条目本身 | 写功能天花板在此        |
| 没有发行版清单读端点，持有状态要从 `/ulist` 的 `releases` 里挖       | 数据模型需特殊处理      |
| `results` 上限 100                                                   | 同步成本按下表计算      |
| 图片带 `sexual` / `violence` 标记                                    | 需要模糊开关 + 本地偏好 |

### 2.2 全库规模与同步代价（`GET /stats` 实测）

| 实体      | 条数        | 100/页 → 请求数 |
| --------- | ----------- | --------------- |
| character | 171,554     | 1,716           |
| release   | 157,843     | 1,579           |
| **vn**    | **66,746**  | **668**         |
| staff     | 54,625      | 547             |
| producer  | 30,270      | 303             |
| trait     | 3,328       | 34              |
| tag       | 3,014       | 31              |
| **合计**  | **487,380** | **4,878**       |

按 40 次/分计，**全量同步 = 约 122 分钟纯请求时间**（未计 3s 超时、重试、失败）。

### 2.3 单条载荷实测

| 查询                                                                                 | 100 条实测 | 折合单条   | 全 66,746 条 |
| ------------------------------------------------------------------------------------ | ---------- | ---------- | ------------ |
| VN 精简列表（`id,title,released,rating,votecount,length,olang,platforms,image.url`） | 22,140 B   | **221 B**  | **≈ 14 MB**  |
| VN 列表 + 完整 tags                                                                  | 653,397 B  | **6.5 KB** | **≈ 434 MB** |

### 2.4 官方数据库 dump（实测 `dl.vndb.org/dump/`）

| 文件                         | 大小       | 客户端可用性                     |
| ---------------------------- | ---------- | -------------------------------- |
| `vndb-db-latest.tar.zst`     | **190 MB** | ❌ PostgreSQL dump，移动端不可行 |
| `vndb-dev-latest.tar.gz`     | 120 MB     | ❌ 同上                          |
| `vndb-votes-latest.gz`       | 13.9 MB    | ⚠️ 仅投票                        |
| `vndb-tags-latest.json.gz`   | < 1 MB     | ✅ 标签可直取                    |
| `vndb-traits-latest.json.gz` | < 1 MB     | ✅ 特性可直取                    |

**结论**：官方 dump 不能替代 API 做移动端全量同步（190 MB + PostgreSQL 格式）。

---

## 3. 必答问题 — **已确认**

### Q1. 登录怎么做？ → **A（粘贴 Token）**

用户自行前往 `https://vndb.org/u/tokens` 创建 token（勾选 `listread` + `listwrite`），在设置页粘贴。存 `expo-secure-store`。

### Q2. 数据定位？ → **B（本地优先）**

用户个人的数据可以存储在本地，但是游戏数据等一律使用官方的API获取，不存放在本地

### Q3. 平台与发布形式？ → **Android 优先 / Expo Go**

| 项       | 决定                                                                 |
| -------- | -------------------------------------------------------------------- |
| 目标平台 | Android 优先；iOS 后续再说（代码保持跨平台，不写 Android-only 逻辑） |
| 最低版本 | Android 7.0（minSdk 24，实测确认）                                   |
| 运行方式 | **Expo Go**（硬约束，见 §3.5-C2）                                    |

### Q4. 第一版功能边界 → **全选 10 项**

首页 / VN 列表 / VN 详情 / 搜索+筛选 / 角色·制作者·标签详情 / 我的清单 / 发行版持有状态 / 每日语录 / 统计图表 / 随机摇一摇。

---

## 3.5 勘察结果：三个冲突（✅ C1 / C2 / C2b / C3 全部已定案）

### C1. 数据本地化范围 — ✅ **已定案（Master 本轮答复）**

> **只有用户数据需要存储在本地，其他数据一律通过官方 API 获取。**

**定案结论**：不做任何 VNDB 全库本地镜像（L0/L1 分层方案作废）。

| 范围                                                              | 存储策略               | 载体                    |
| ----------------------------------------------------------------- | ---------------------- | ----------------------- |
| 自己的清单（vote / 标签 / 备注 / 起止日期 / 发行版持有状态）      | **本地持久化**         | SQLite（`expo-sqlite`） |
| 自己的清单标签（`/ulist_labels`，含私有）                         | **本地持久化**         | SQLite                  |
| 用户资料（`/authinfo` 的 id / username / permissions）            | **本地持久化**         | SQLite                  |
| 应用偏好（主题、NSFW 档位、排序方式等）                           | 本地持久化             | AsyncStorage            |
| Token                                                             | 本地持久化             | `expo-secure-store`     |
| VN / release / character / producer / staff / tag / trait / quote | **不落库**，实时走 API | React Query 内存缓存    |

**因此**：

- §2.2 的 4,878 请求 / 122 分钟全量同步成本**不再成立**，归零
- §6 目录中 `lib/sync/` **删除**
- 不需要中转后端（C3 自动消解）
- 弱网体验依赖 React Query 内存缓存（`gcTime`）+ 用户可手动清空；**不做磁盘级响应缓存**
- 唯一副作用：彻底离线时，清单之外的内容不可见。若后续想要「离线也能翻 VN 详情」，可加一个**默认关闭、可开关**的磁盘响应缓存（react-query persist → SQLite）。这是对本定案的唯一潜在扩展点

- [x] ~~分层本地化~~ → 作废，改为「仅用户数据本地化」

### C2. Q3「Expo Go」与两个已装依赖冲突

`expo/bundledNativeModules.json` 实测：

| 包                                          | Expo Go  | 说明                                                                       |
| ------------------------------------------- | -------- | -------------------------------------------------------------------------- |
| `expo-sqlite`                               | ✅       | 本地优先的地基，可用                                                       |
| `expo-secure-store`                         | ✅       | token 存储，可用                                                           |
| `expo-image`                                | ✅       | 含 blurRadius + 磁盘缓存，可用                                             |
| `expo-haptics`                              | ✅       | 摇一摇反馈，可用                                                           |
| `@react-native-community/slider`            | ✅       | 10–100 打分滑杆，可用                                                      |
| `@shopify/flash-list`                       | ✅       | 长列表，优于 FlatList，可用                                                |
| `react-native-svg`                          | ✅       | 手写图表基础，已装                                                         |
| `@react-native-async-storage/async-storage` | ✅       | 可作 KV 兜底                                                               |
| **`react-native-mmkv`**                     | ❌       | **Q7 推荐项，需 dev build**                                                |
| **`@gorhom/bottom-sheet`**                  | ❌       | **脚手架里已装，Expo Go 下不可用**                                         |
| `expo-linear-gradient`                      | ✅       | gifted-charts 的可选依赖                                                   |
| `@shopify/react-native-skia`                | ✅ 2.6.2 | ⚠️ **更正**：Expo 官方文档明确标注 “Included in Expo Go”，dev build 非必需 |

**处理建议**：

- KV 层用 `KeyValueStore` 接口抽象，默认实现走 AsyncStorage；MMKV 作为可选加速，装了检测到就切
- 弹层改用 HeroUI Native 自带 Sheet/Modal，或手写 Animated，**不依赖 @gorhom/bottom-sheet**
- 图表库选型见下方 **C2b**（已改用第三方库，Master 要求）
- 追加依赖：`@shopify/flash-list`、`@react-native-community/slider`、`@tanstack/react-query`、`expo-image`、`expo-sqlite`、`expo-secure-store`、`@react-native-async-storage/async-storage`、`expo-haptics`（全部 Expo Go 兼容）
- 卸载 `@gorhom/bottom-sheet`

- [x] **同意 C2**：按上述处理，改依赖清单（Master：「按照你推荐的」）

### C2b. 图表库选型（Master 要求用第三方库）— 待确认

按 npm registry + Expo 官方文档实测，针对本项目确切版本栈（Expo Go / RN 0.86.3 / React 19.2.3 / react-native-svg 15.15.4）：

| 库                           | 最新版 / 发布日     | 渲染后端   | Expo Go                                           | peer 依赖匹配                                                                                                     | 结论                                                                 |
| ---------------------------- | ------------------- | ---------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **`react-native-chart-kit`** | 7.0.4 / 2026-09-06  | SVG        | ✅ 纯 JS，运行时仅依赖 `paths-js`，**零原生代码** | ✅ `react >=19.1 <20`、`react-native >=0.81 <1`、`react-native-svg >=15.12.1 <16` —— **三项全部精确命中已装版本** | **✅ 推荐**                                                          |
| `victory-native`             | 42.0.1 / 2026-08-31 | Skia       | ✅ Skia 2.6.2 已在 Expo Go（dev build 非必需）    | ✅ `skia >=2.6 <3`、`reanimated >=3.19.1`（实有 4.5.1）、`gesture-handler >=2`（实有 2.32）                       | ⚠️ 功能最强（手势 / tooltip / 大数据），但概念多、体积大、学习曲线陡 |
| `react-native-gifted-charts` | 1.4.78 / 2026-08-10 | SVG        | ✅ 需 `expo-linear-gradient`（在 Expo Go）        | peer 全为 `*`（无约束）                                                                                           | 🔸 DX 好，但 100 个 open issue，大数据集偏重                         |
| `react-native-svg-charts`    | 5.4.0 / **2022**    | SVG        | —                                                 | ❌ 要求 `svg ^6 \|\| ^7`                                                                                          | ❌ 停更 4 年，与 svg 15 不兼容，排除                                 |
| `@wuba/react-native-echarts` | 3.1.1 / 2026-07-06  | SVG / Skia | 🔸 集成复杂                                       | 需 `echarts` + `zrender`                                                                                          | ❌ 对「年份 / 标签 / 厂商分布」这类静态聚合图过重                    |

**需求侧实际只要什么**（Q4 统计图表）：

- 按年份分布 → 纵向柱状图
- 按标签分布 → 横向条形图（Top N）
- 按厂商分布 → 柱状图或环形图

即**小数据量、静态、聚合柱 / 条 / 环图**，无需 Skia 级性能与重手势交互。

**推荐 `react-native-chart-kit` 7.0.4**：零原生代码 → Expo Go 零风险；三个 peer 依赖与项目已装版本**逐一精确匹配**；1.1 MB；v7 正是为 React 19 重构的版本。风险点：v7.0.0 发布仅一个月（已有 4 个补丁版），需接受早期 API 变动可能。
**备选**：若 Master 想要更丰富的交互 / 动画，升级到 `victory-native` 42.x（一并装 `@shopify/react-native-skia`，同样在 Expo Go 内）。

- [x] **用 `react-native-chart-kit` 7.0.4**（推荐） — Master：「按照你推荐的」
- [ ] 用 `victory-native` 42.x + Skia
- [ ] 用 `react-native-gifted-charts`

### C3. 是否自建中转后端 — ✅ **自动消解**

C1 定案为「数据全走官方 API」后，客户端直连即可跑通，无全量同步压力，因此**不需要**中转后端。限流由 `lib/api/rateLimiter.ts` 令牌桶在客户端解决。

- [x] **v1 不建中转后端**（因 C1 定案而自动成立）

---

## 4. 待定问题 — 已采用默认建议

| 编号 | 问题          | 决定                                                                                                                   |
| ---- | ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Q5   | UI 语言       | 中文简体，暂不引入 i18n 框架                                                                                           |
| Q6   | NSFW 内容策略 | 默认显示；设置里「隐藏 / 模糊 / 全开」三档 + 可选应用锁                                                                |
| Q7   | 本地存储      | **仅用户数据** → `expo-sqlite`（清单 / 标签 / 用户资料）+ AsyncStorage（应用偏好）+ SecureStore（token）— 已按 C1 调整 |
| Q8   | 状态管理      | `@tanstack/react-query`                                                                                                |
| Q9   | 图片方案      | `expo-image`                                                                                                           |
| Q10  | 中转后端      | **不建**（C3 自动消解）                                                                                                |
| Q11  | 品牌与合规    | 叫 vnlite；关于页注明「非官方客户端，遵循 VNDB Data License」                                                          |
| Q12  | 交付节奏      | M1 出可跑只读版验收，再往下推进                                                                                        |
| Q13  | 最低版本      | Android 7.0（minSdk 24）                                                                                               |

---

## 5. 技术选型清单（已定稿）

| 用途          | 选型                                        | Expo Go  | 状态                      |
| ------------- | ------------------------------------------- | -------- | ------------------------- |
| 框架          | Expo SDK 57 + expo-router 57                | ✅       | 已就位                    |
| UI            | HeroUI Native                               | ✅       | 硬性要求                  |
| 样式          | Uniwind / Tailwind v4                       | ✅       | 硬性要求                  |
| 数据请求      | `@tanstack/react-query`                     | ✅ 纯 JS | **待安装**                |
| 结构化存储    | `expo-sqlite`                               | ✅       | **待安装**                |
| 长列表        | `@shopify/flash-list`                       | ✅       | **待安装**                |
| 打分滑杆      | `@react-native-community/slider`            | ✅       | **待安装**                |
| KV            | `@react-native-async-storage/async-storage` | ✅       | **待安装**                |
| 可选 KV 加速  | `react-native-mmkv`                         | ❌       | 抽象层预留，不装          |
| 安全存储      | `expo-secure-store`                         | ✅       | **待安装**                |
| 图片          | `expo-image`                                | ✅       | **待安装**                |
| 触感          | `expo-haptics`                              | ✅       | **待安装**                |
| 图表          | **`react-native-chart-kit` 7.0.4**          | ✅       | **待安装**（见 C2b）      |
| 弹层          | HeroUI Native Sheet/Modal                   | ✅       | 弃用 @gorhom/bottom-sheet |
| ~~筛选/弹层~~ | ~~@gorhom/bottom-sheet~~                    | ❌       | **待卸载**                |

---

## 6. 目标目录结构（草案）

```
src/
├─ app/                        # expo-router 路由（唯一入口）
│  ├─ _layout.tsx              # Provider 装配：Query / SafeArea / Gesture / HeroUI
│  ├─ (tabs)/
│  │  ├─ _layout.tsx           # 底部 Tab：首页 / 搜索 / 清单 / 我的
│  │  ├─ index.tsx             # 首页（最新 / 热门 / 随机）
│  │  ├─ search.tsx            # 搜索 + 筛选
│  │  └─ list.tsx              # 我的清单
│  ├─ vn/[id].tsx              # VN 详情
│  ├─ character/[id].tsx       # 角色详情
│  ├─ producer/[id].tsx        # 制作者详情
│  ├─ tag/[id].tsx             # 标签详情
│  ├─ stats.tsx                # 统计图表
│  ├─ settings/index.tsx       # 登录 / 偏好 / 缓存管理 / 关于
│  └─ +not-found.tsx
├─ features/
│  ├─ vn/  release/  character/  producer/  tag/  quote/  ulist/  stats/
├─ lib/
│  ├─ api/
│  │  ├─ client.ts             # fetch 封装 + 错误映射 + 429 退避
│  │  ├─ rateLimiter.ts        # 令牌桶 200/5min 滑动窗口
│  │  ├─ filters.ts            # UI 筛选状态 → Kana 谓词数组
│  │  ├─ fields.ts             # 字段选择常量（列表/详情两套，显式子字段）
│  │  ├─ types.ts              # 以 GET /schema 为准的类型
│  │  ├─ enum.ts               # language / platform / staff_role / length …
│  │  └─ endpoints/            # vn.ts release.ts character.ts producer.ts tag.ts trait.ts quote.ts ulist.ts user.ts
│  ├─ query/                   # QueryClient、queryKeys、缓存策略
│  ├─ db/                      # ★ 仅用户数据
│  │  ├─ schema.ts             # 表结构 + 版本迁移
│  │  ├─ migrations/
│  │  └─ dao/                  # ulist.ts label.ts account.ts
│  └─ storage/                 # KeyValueStore 接口 + AsyncStorage 实现 + SecureStore
├─ components/                 # 跨域复用 UI（HeroUI Native + Uniwind）
└─ constants/  hooks/  utils/  types/
```

### `lib/api` 关键设计要点

1. **client.ts** — 统一 fetch 封装，400 / 401 / 404 / 429 / 500 / 502 映射成类型化错误；429 指数退避重试
2. **rateLimiter.ts** — 令牌桶（200 / 5min 滑动窗口），所有请求排队出队；与写队列共用同一调度，避免互相抢配额
3. **filters.ts** — UI 筛选状态编译成 Kana 谓词数组；处理「嵌套过滤器必须传谓词而非标量」（`["vn","=",["id","=","v17"]]`）
4. **fields.ts** — 列表/详情两套常量；**一律显式写子字段**（`image.url`），否则 400；详情字段集已实测校验
5. **types.ts** — 以 `GET /schema` 为准手写核心类型，封装类型安全 endpoint（`api.vn.query({ filters, fields })`）

### `lib/db` 建议表结构

> **只建用户数据表**。VNDB 业务数据一律不进库。

| 表            | 主键     | 字段要点                                                                                 | 预估行数                 |
| ------------- | -------- | ---------------------------------------------------------------------------------------- | ------------------------ |
| `ulist`       | vn_id    | vote / notes / added / voted / lastmod / started / finished / labels / releases 持有状态 | 视用户（典型 100–2,000） |
| `ulist_label` | label_id | label / private / count                                                                  | ~20                      |
| `account`     | 单行     | user_id / username / permissions[] / last_synced_at                                      | 1                        |

**写入语义**：

- 所有写操作（打分 / 标签 / 备注 / 日期 / 发行版状态）**先写本地库（乐观更新）→ 再 PATCH API → 失败则回滚并标记脏**
- `ulist.last_synced_at` 记录最近一次与服务端对齐时间，用于下拉刷新判定
- 写队列需持久化，保证杀进程后不丢（放 AsyncStorage 或 `ulist_pending` 表）

---

## 7. 里程碑（已按 Q1–Q4 + C1/C2 调整）

### 进度

| 阶段            | 状态      |
| --------------- | --------- |
| **M0 地基**     | ✅ 已完成 |
| **M1 只读浏览** | ✅ 已完成 |
| M2 用户数据层   | ⬜ 未开始 |
| M3 账号清单     | ⬜ 未开始 |
| M4 增强         | ⬜ 未开始 |
| M5 打磨发布     | ⬜ 未开始 |

| 阶段              | 内容                                                                                                             | 预估       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- | ---------- |
| **M0 地基**       | 依赖安装/卸载 + API client + 限流器 + 类型层 + filters 编译器 + `lib/db` schema + 目录骨架 + lint/typecheck 通过 | **2 天**   |
| **M1 只读浏览**   | 首页 → 列表(FlashList) → VN 详情 → 角色/制作者/标签详情 → 搜索与高级筛选                                         | **4.5 天** |
| **M2 用户数据层** | `lib/db` schema + DAO（ulist / label / account）+ 乐观更新 + 持久化写队列 + 清单离线可读                         | **2.5 天** |
| **M3 账号清单**   | Token 登录 + `authinfo` 权限校验 + 清单全量拉取入库 + 清单浏览/筛选/排序 + 打分/标签/备注/日期 + 发行版持有状态  | **4 天**   |
| **M4 增强**       | 每日语录 + 随机摇一摇（haptics）+ 统计图表（chart-kit）                                                          | **3 天**   |
| **M5 打磨发布**   | 深色模式、骨架屏、空状态、错误重试、NSFW 开关、性能优化、无障碍、EAS 构建、图标/关于页                           | **3.5 天** |

**合计约 19.5 个工作日**（单人，Android + Expo Go，不含后端）

### 工期调整系数（相对本表）

| 变数                                       | 影响                |
| ------------------------------------------ | ------------------- |
| 改为 dev build（可用 MMKV / bottom-sheet） | −1 天               |
| 砍掉 M4 三项（语录/摇一摇/统计）           | −3 天               |
| 首版只做 M0–M1（纯只读浏览）               | 提前 7 天出可验收版 |
| 后续加可选的磁盘响应缓存（离线可翻详情）   | +1.5 天             |

---

## 8. 已知会踩的坑（提前规避方案）

> 「M0 实测」= 本轮写 `scripts/smoke-api.ts` 打真实接口时实际踩到的，都已有代码层规避。
> 「skill」= 来自 `.pi/skills/vndb-api` 的官方参考文档。

| 坑                                                                             | 来源        | 规避方案                                                                           |
| ------------------------------------------------------------------------------ | ----------- | ---------------------------------------------------------------------------------- |
| **`relations` 是平铺结构**，写 `relations.vn.id` → 400 `Field 'vn' not found`  | **M0 实测** | 正确写法 `relations.id` / `relations.title` / `relations.relation`；类型已改为平铺 |
| **`va.staff` 继承 `/staff`，没有 `role` 字段**                                 | **M0 实测** | 用 `va.staff.ismain` 判断主配角；`role` 只存在于 `/vn` → `staff`                   |
| **`/staff` 没有 `image`，也没有 `sex`**                                        | **M0 实测** | `image` 是 `/character` 独有的；`/staff` 用新增的 `gender` / `ismain`              |
| **`/character` 没有 `extlinks`**                                               | **M0 实测** | 角色页不展示外链；`/producer` 与 `/staff` 才有                                     |
| **`screenshots` 没有 `width` / `height`**，只有 `dims: [w, h]`                 | **M0 实测** | 布局用 `dims` 算宽高比                                                             |
| **`/trait` 的 id 前缀是 `i` 不是 `t`**（`i1` = Hair），计数字段叫 `char_count` | **M0 实测** | 路由参数与查询用 `i*`；类型已改为 `char_count`                                     |
| **`/ulist` 不传 `user` 且未登录 → 400**（不是 401）                            | **M0 实测** | 游客态读清单必须显式传 `user`；400 才提示未登录，401 才是 token 失效               |
| **`/staff` → `aliases` 是对象数组**（`{name,aid,latin,ismain}`）不是字符串数组 | **M0 实测** | 类型已改为对象数组                                                                 |
| **`/character` → `traits[].sexual` 是布尔值**（图片分级 0/1/2 是另一套东西）   | **M0 实测** | 两套语义已分开定义，别混用                                                         |
| **嵌套过滤器的值必须是谓词不是标量**（`["vn","=","v17"]` → 400）               | skill       | 全部经 `filters.ts` 的 `byVn` / `characterInVn` 等生成，UI 不接触裸谓词            |
| **单个谓词不能直接当 filters**（`["id","=","v17"]` → 400 `Invalid query`）     | skill       | `and()` 总是包一层                                                                 |
| `PATCH /ulist` **总会把 VN 加进清单**，想删条目必须用 `DELETE`                 | skill       | `addOrUpdateListItem` 与 `updateExistingListItem` 分开，mutations 不自动重试       |
| API **不会**自动清理互斥标签（Playing/Finished/Stalled/Dropped/Plan to play）  | 实测        | `sanitizeLabels()` 写入前收敛，1/2/3/4/5 只留一个                                  |
| 虚拟标签 `0`(No label) 与 `7`(Voted) 不可设置                                  | skill       | `UNSETTABLE_LABELS` 在写入层过滤                                                   |
| `vote` **只能排序不能过滤**                                                    | skill       | `filterByVote()` 取回后本地截断                                                    |
| `DELETE /ulist/<id>` 连带删除发行版条目，不可逆                                | skill       | 二次确认弹窗 + 文案警示                                                            |
| API 不校验 label id，可写入不存在的标签                                        | skill       | 写入前先拉 `GET /ulist_labels` 校验                                                |
| 对象型字段必须显式子字段（`image` 单独选 → 400）                               | skill       | `fields.ts` 一律写 `image.url`                                                     |
| 字段过多触发 `Too much data selected`                                          | skill       | 列表/详情两套 fields 常量                                                          |
| **`searchrank` 排序仅在顶层过滤器是 `search` 时可用**                          | 实测        | 首页「热门」改用 `rating` / `votecount`；`searchrank` 只用于搜索结果排序           |
| `["search","=","fate"]` 单独作为 filters → 400                                 | 实测        | `compileVnFilters` 统一包一层 `["and", ...]`                                       |
| `@gorhom/bottom-sheet` 在 Expo Go 下不可用                                     | 实测        | 已卸载，改用 HeroUI Native Sheet/Modal                                             |
| 全库 487,380 条 / 4,878 请求                                                   | 实测        | **已作废**（C1 定案后不需全量同步）                                                |
| 官方 dump 190 MB PostgreSQL 格式                                               | 实测        | 移动端不可用，只能走 API                                                           |
| `@shopify/react-native-skia` 其实**已在** Expo Go（2.6.2）                     | 实测        | 更正之前「victory-native 不可用」的错误判断；它是备选而非不可能                    |

## 9. 决策记录（由 pi 维护）

| 日期     | 决策                                          | 原因                                                                           |
| -------- | --------------------------------------------- | ------------------------------------------------------------------------------ |
| 本轮     | Q1 = A 粘贴 Token                             | 稳定、无 ToS 风险、零额外依赖                                                  |
| 本轮     | Q3 = Android 优先 + Expo Go                   | Master 选择；Expo Go 成为依赖选型硬约束                                        |
| 本轮     | Q4 = 全选 10 项                               | Master 选择；工期上调                                                          |
| 本轮     | Q5–Q9, Q11–Q13 采用默认建议                   | Master 未修改                                                                  |
| **本轮** | **C1：仅用户数据落本地，其余全走官方 API**    | **Master 本轮定案**；作废 Q2=B 的全量本地优先与分层方案                        |
| **本轮** | **不建中转后端（C3 自动消解）**               | 无全量同步压力，客户端直连即可                                                 |
| 本轮     | 弃用 `@gorhom/bottom-sheet`                   | 实测不在 Expo Go                                                               |
| 本轮     | 不引入 `react-native-mmkv`                    | 不在 Expo Go；改用 AsyncStorage + 接口抽象                                     |
| **本轮** | **更正：Skia 2.6.2 已在 Expo Go**             | Expo 官方文档标注 “Included in Expo Go”，`victory-native` 并非不可用           |
| **本轮** | **图表库定案 `react-native-chart-kit` 7.0.4** | Master：「按照你推荐的」；三个 peer 依赖与已装版本精确匹配、零原生代码、1.1 MB |
| **本轮** | **C2 同意改依赖清单**                         | Master：「按照你推荐的」；弃用 bottom-sheet、KV 走 AsyncStorage                |

---

## 10. 需求确认结果（✅ 全部定案）

1. **C2** — ✅ 同意改依赖清单（弃用 `@gorhom/bottom-sheet`、KV 走 AsyncStorage 抽象）
2. **C2b** — ✅ 图表库用 `react-native-chart-kit` 7.0.4
3. **§0 一句话目标** — ✅ 按「仅用户数据本地化」改写后定稿

Master 原话：**「按照你推荐的」**（第 4 轮）

---

## 11. 变更记录

| 日期    | 变更                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 初始    | 创建规划文档                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 第 2 轮 | 记录 Q1–Q4 答案；实测 API 规模、载荷、dump、Expo Go 模块可用性；新增 §3.5 三个冲突；工期 15 → 21 天                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 第 3 轮 | **C1 定案：仅用户数据落本地，其余全走 API**；作废分层本地化与 `lib/sync/`；**C3 自动消解（不建后端）**；调研图表库（npm + Expo 官方文档实测）并新增 §C2b；**更正 Skia 已在 Expo Go 的错误判断**；工期 21 → 19.5 天                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 第 4 轮 | **需求全部定案**（C2 / C2b 采用推荐），进入 M0 开发                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 第 5 轮 | **M0 完成**：安装/卸载依赖（+`react-native-chart-kit@7.0.4`，-`@gorhom/bottom-sheet`）；落地 `lib/api`（client / rateLimiter / filters / fields / types / enums / errors + vn·catalog·ulist 三组端点）、`lib/db`（schema + ulist/account DAO）、`lib/storage`（keyValue / secure / session / preferences）、`lib/query`（client / keys）；根布局接入 QueryClientProvider；新增 `scripts/smoke-api.ts`（34 项打真实接口的冒烟测试，全绿）；按 `GET /schema` 实时内省修正 7 处字段错误；新增 `bun run check` 一键校验                                                                                                                                                            |
| 第 6 轮 | **M1 完成**：5 个 Tab（首页/浏览/搜索/清单/我的）+ 5 类详情页（VN·角色·制作者·staff·标签）； 新增 `components/`（Typo / Muted / CoverImage / ScreenState / Separator / ChipGroup / SegmentedControl / HorizontalGallery）、 `utils/format.ts`、`hooks/`（useSession / usePreferences）、`features/`（vn / catalog / browse）； 底部 Sheet 筛选（评分·票数·语言·平台·时长·开发状态·年代·内容完整度）；搜索走 `searchrank` 排序（需顶层 search 过滤器）； **更正错误判断：`@gorhom/bottom-sheet` 实测 0 个原生文件，纯 JS，且是 heroui-native 的必需 peer dep，已重新装回**； 弃用 `ScrollShadow`（需额外依赖 expo-linear-gradient）；自建 `SegmentedControl`（HeroUI 无此组件） |
