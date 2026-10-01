# vnlite — 开发计划

> 格式：`Module`（1 级目录）→ `Type`（2 级目录）→ `List`（复选框）
> `- [x]` = 已实现并通过质量门禁；`- [ ]` = 待实现 / 计划中
> 质量门禁：`bun run check`（typecheck + lint + format + API / 主题 / 本地库冒烟）、`bun run bundle:check`

---

## Module 0 · 地基

### Type 0.1 · 工程配置

- [x] Expo SDK 57 + RN 0.86 + React 19.2 + expo-router 57（文件路由）
- [x] HeroUI Native 1.0.10 + Uniwind 1.10（Tailwind v4）接入 Metro
- [x] bun 作为包管理器，TypeScript 严格模式；lint / format 采用 oxc 系工具链
      （`oxlint` + `oxfmt`，2026-09-30 从 ESLint + Prettier 迁移）
  - [x] `oxlint`（`bun run lint` / `lint:fix`）+ `.oxlintrc.json`：
        typescript / react / import / unicorn / oxc 插件，correctness=error、suspicious / perf=warn
  - [x] `oxfmt`（`bun run format` / `format:check`）+ `.oxfmtrc.json`：
        自 prettier 配置一键迁移（含 ignorePatterns），格式差异仅 4 处 union 换行
  - [x] 卸载 `eslint` / `eslint-config-expo` / `prettier`，删除
        `eslint.config.js` / `.prettierrc.json` / `.prettierignore`
  - [x] 首跑全量诊断已清零（`oxlint --deny-warnings` 0 输出）：
        修掉写队列的冗余 spread 回退、`useSetPreference` 伪 hook 改名（rules-of-hooks 误报链）、
        函数提升到模块级；对 6 条与运行时 / 框架模式冲突的规则做了显式例外并注明理由
        （含 `unicorn/no-array-sort` —— Hermes 没有 `toSorted`，采信它会真机崩溃，见 docs/PLAN.md §8）
- [x] `bun run check` 一键质量门禁
- [x] `components/Icon` + `components/iconGlyphs` —— Gravity UI 图标的 RN 封装
      （`@gravity-ui/icons` 只出渲染原生 `<svg>` 的 Web 组件，源码内置走 `react-native-svg`）
- [x] 全项目图标统一迁移到 `components/Icon`（19 个图标：Tab 栏 / 返回箭头 / 首页入口 /
      筛选 / 外链 / 查看器关闭），`@expo/vector-icons` 已从依赖里移除
      （Android bundle 6.7 MB → 6.3 MB，导出资源里的 Ionicons 字体全部消失）

### Type 0.2 · 数据与网络层

- [x] `lib/api` —— fetch 封装、错误映射、429 退避
- [x] `lib/api/rateLimiter` —— 令牌桶（200 / 5 min）
- [x] `lib/api/filters` —— UI 筛选状态 → Kana 谓词编译器
- [x] `lib/api/fields` —— 列表 / 详情两套字段常量（一律显式写子字段）
- [x] `lib/query` —— QueryClient + queryKeys
- [x] `scripts/smoke-api.ts` 真实接口冒烟（34 项全绿）

### Type 0.3 · 本地存储

- [x] `lib/storage/keyValue` —— KV 抽象 + AsyncStorage 实现
- [x] `lib/storage/preferences` —— 应用偏好（KV 层，模块级缓存 + 订阅）
- [x] `lib/storage/session` —— SecureStore 存 Token + 冷启动 `restoreSession`
- [x] `lib/db` —— SQLite schema + account DAO（**v3 起清单数据不落库**）
  - [x] 迁移按 `PRAGMA user_version` 推进；**v3 删除旧的 `ulist` / `ulist_label` /
        `ulist_pending` 表**（清单改 VNDB 直读直写，见 Type 3.2）
  - [x] `setDatabaseProvider` 可注入 DB 实现（bun 冒烟用 `bun:sqlite` 适配器，
        生产懒加载 expo-sqlite，原生模块不会进 bun 进程）
- [x] `scripts/smoke-db.ts` 本地库冒烟（迁移 / account / 编辑页纯逻辑）

> ⚠️ **2026-09-30 架构调整**：此前实现的本地清单镜像（持久化写队列 / 乐观回滚 /
> 全量同步 / 离线可读）**全部移除** —— 清单数据一律不落本地库，改为 VNDB 直读直写。

---

## Module 1 · 主题与背景

### Type 1.1 · 配色体系

- [x] `theme/seeds.ts` —— 11 套主题的 5 个种子值（来自 vndb-lite，Apache-2.0）
- [x] `theme/seeds.ts#deriveTokens` —— 由种子派生 ~26 个 HeroUI token
- [x] `theme/color.ts` —— sRGB hex 混合 / 亮度 / 对比度工具
- [x] `theme/themes.ts` —— 主题包 + 静态 `require` 背景图资源
- [x] 背景图资源压缩：627x1121 PNG → 720x1288 JPEG q72（3.86 MB → 0.64 MB）
- [x] `scripts/smoke-theme.ts` 冒烟：对比度 AA、暗/亮底方向、token 唯一性

### Type 1.2 · 背景图层架构

- [x] `components/AppBackground` 三层结构：底色层 / 图片层 / 遮罩层
- [x] 整组 `pointerEvents="none"`，不吞触摸；图片层对无障碍隐藏
- [x] **修复：背景图被上层不透明容器盖住**（切主题看不见图）
  - [x] `ThemeProvider#ThemeShell` 移除 `backgroundColor`
  - [x] `app/_layout.tsx` 的 `SafeAreaScreen` 改为透明
  - [x] `app/_layout.tsx` 的 `Stack.contentStyle` 改为 `transparent`
  - [x] `(tabs)/_layout.tsx` 的 `tabBarStyle` 改为半透明
- [x] **修复：Tab 场景被 expo-router 自带底色刷住**
  - [x] 根因：`expo-router/.../elements/Background.js` 把
        `backgroundColor: colors.background` 放在 style 数组**第一项**，
        且那个 `colors` 来自 expo-router 自己的主题，与 Uniwind/HeroUI 是两套体系
  - [x] 对策：`(tabs)/_layout.tsx` 加 `sceneStyle: { backgroundColor: "transparent" }`
        （style 数组靠后项赢，所以能覆盖掉默认底色）
- [x] **修复：遮罩色用错 token** —— 原用 `foreground`，会把图片往文字色拉，
      明暗两种主题下都导致前景文字与背景图对比度崩掉；改为 `background`
- [x] 底色下沉为背景图层第一层 → 上层容器可以放心透明，不再闪白

### Type 1.3 · 遮罩控制

- [x] `backgroundOpacity`（0–1 连续）取代原 0/1/2/3 四档 `backgroundDim`
- [x] `backgroundBlur`（0–40 pt）走 `expo-image` 的 `blurRadius`
- [x] 旧 `backgroundDim` 存储数据自动迁移（`migrate()`），并夹取越界值
- [x] `features/settings/components/BackgroundSettings` —— 开关 + 两条滑杆
- [x] `features/settings/components/LabeledSlider` —— HeroUI Slider 外壳
- [x] 拖动中 `patchPreferences`（只改内存）、松手 `setPreference`（落盘一次）
- [x] 滑杆值按 `step` 精度四舍五入，避免 `0.7000000000000001` 进存储
- [x] 实时预览：背景是全局的，拖滑杆时整屏同步变化
- [x] Tab 栏不透明度随遮罩强度联动（0.72 → 1.0）
- [x] 范围常量与默认值收敛到 `theme/background.ts`（纯逻辑，冒烟可直接测）

### Type 1.4 · 文字对比度（背景图可读性）

> 背景图是**明暗不均的照片**，遮罩只能整体压暗、压不住某一块高光区。
> 症状：主题色本身正确，但浅色文字落在照片亮部就糊掉。

- [x] `theme/background.ts#computeTextShadow` —— 纯函数，可被冒烟测试覆盖
- [x] `theme/textContrast.ts#useTextContrast` —— React 绑定
- [x] 阴影色取**主题底色**（永远是文字的反色描边），不写死黑色
      （写死黑色会在浅色主题失效：黑字 + 黑影 = 更糊）
- [x] 阴影强度 = `1 - 遮罩不透明度`，遮罩拉满时自动归零，不留多余糊边
- [x] 接入点：`Typo`(Body/Heading/Paragraph/LinkText)、`Muted`、
      `SegmentedControl`、`ThemeTile`
- [x] 默认遮罩 0.6 → **0.72**（0.6 挡不住高光区）
- [x] 旧数据里 `backgroundDim: 2`（当年的默认值）迁移到 0.72
- [x] **修复 `withAlpha` 双井号 bug** —— 曾返回 `##f5f6f7d9`，
      RN 解析非法色值会静默回退成黑色（半透明面板变黑块）；已加冒烟断言卡住
- [x] 清掉 8 处硬编码颜色（`#8E8E93` iOS 灰 / `#F31260` 粉）→ 改用主题 token

### Type 1.5 · 待办

- [ ] 背景图亮度/饱和度调节（部分主题图偏亮，浅色主题下即使全遮罩也偏灰）
- [ ] M4 开放自定义背景图（`backgroundUrl` 字段已就位，缺选图 + 裁剪 UI）
- [ ] 无障碍：为滑杆补 `accessibilityValue` 的中文朗读文案

---

## Module 2 · 浏览与搜索

### Type 2.1 · 首页

- [x] `(tabs)/index` —— 每日语录 / 随机一部 / 信息流（最新评价·即将发售·最新上架）
- [x] **首页精简**（Master 要求）：移除「我的游戏 / 评分排行 / 我的评分排名 / 近期热门」
      四个常用入口（与底部 Tab、「浏览」页重复，`QuickEntries` 组件一并删除）；
      「收藏统计」挪进「我的」页
- [x] `components/CoverImage` —— NSFW 分级处理（隐藏 / 模糊 / 显示）
- [x] **去掉「最新上架」分区**（与「浏览 · 按发售时间」重复），删掉 `LatestCard`
- [x] **「随机一部」改成真随机**：`queryRandomVn` 取最大 id（会话级缓存）→
      随机号段 → `id >= vN` 拿最近的一条，不再维护固定 id 池
- [x] **每日语录**（M4 增强）：当天第一次打开抽一条，之后整天不变 ——
      React Query key 带本地日期 + `lib/storage/dailyQuote` 落盘（杀进程重开还是同一条），
      卡片上标「每日语录 + 月日」；原来每次打开都换一条的「随机语录」已被它取代
- [x] **摇一摇换一部**（M4 增强）：`hooks/useShake`（expo-sensors 加速度计，
      只在首页聚焦时订阅、1.8g 阈值 + 1.5s 冷却），触发与「换一部」按钮同一条路径（带 haptics），
      卡片底部有「摇一摇手机也能换」提示
- [x] **底部数据库统计图表**：~~`features/stats/database-stats`~~ →
      **已搬到「搜索」页**（Master 要求，见 Type 2.2；卡片外框与标题行一并去掉）。
      组件本身不变：读 `GET /stats`（整个 VNDB 站点的条目数，与收藏统计的数据源不同），
      用 chart-kit v2 的 `PieChart`（`react-native-chart-kit/v2`）画视觉小说 /
      发行版 / 角色 / 制作人员 / 制作者 / 标签 / 特性的占比扇形图，
      交互走 **Tap Selection**（点扇区选中：其余淡出、选中块弹出；
      下方读数行显示该类别的精确条目数 + 占比，图例本身只有百分比）；
      颜色 / 文字走主题 token；骨架屏 + 失败降级
- [x] **首页信息流 `features/home`（Master 要求）**：一行
      `SegmentedControl` 切三档 —— **最新评价 / 即将发售 / 最新上架**，
      栏目与条数都对齐 vndb.org 首页（三栏各 10 条，`FEED_COUNT`）
  - [x] 「最新评价」= **竖向列表**（`features/review`）：抓 vndb.org 的 `/w`
        （Browse reviews），一行给分数 / 作品名 / 作者 / 相对时间；
        ⚠️ Kana **没有评价端点**（`/review` 404，只有 `/vn` 的 `has_review` 布尔），
        与讨论 / 用户模块同款取舍：抓网站 + 冒烟把解析结构卡死
  - [x] **点评价条目弹对话框看正文**（Master 要求）：`features/review/components/review-dialog`
        —— **只显示四样**：作品名、评论用户、评论日期、评论内容；
        评分 / 有用数 / 平台 / 语言 / 通关状态 / 评价版本**一律不显示**
        （评分与作者列表行已经给过，作品信息在作品详情页里更全；
        `scrape.ts` 仍解析这些字段，只是没展示）。作品名与用户名都是站内链接，
        点之前先关对话框再跳详情页（否则会带着遮罩跳）；
        整份列表**共用一个**对话框（同 `ImageViewer` 的做法）；
        原来的站内评价页 `/review/{id}` 与 `review-screen.tsx` 一并删除（被取代了）
  - [x] `components/dialog` —— 对话框外壳（居中卡片 + 遮罩 + 内部滚动），
        走 **RN 原生 `Modal`** 而不是 HeroUI `Dialog.Portal`
        （PortalHost 那个坑见 `features/browse/components/panel.tsx` 顶部）；
        遮罩色取主题 `backdrop` token，不写死 `rgba(0,0,0,.5)`
  - [x] 「即将发售」「最新上架」= **横向可滚动封面墙**（`VnCoverCarousel`），
        只画封面 + 名称，右侧多露一格暗示能滑；点封面进站内作品详情
  - [x] ⚠️ **两档都按「作品」而不是官网的「发行版」**（Master 选定）：发行版没有封面，
        本项目也没有发行版详情页（无处可跳）
  - [x] ⚠️ **`TBA` 在 Kana 里按「最大」参与排序** —— 只写 `sort: "released"`
        的话整页都是「未定档」；两档分别用 `released > 今天`（升序）与
        `released <= 今天`（降序）把它排掉，冒烟已卡住这个不变式
  - [x] 封面墙字段集 `VN_COVER_CARD_FIELDS` 只要 id / title / `image.thumbnail`
        （不要原图、不要日期 —— 卡片不显示，项目的规矩是「不为用不到的字段付流量」）
  - [x] 冒烟新增 5 条（条数常量 / 两档的 TBA 与排序 / 评价列表解析 / 评价详情解析，
        后两条打真实官网）
- [x] 图片加载：列表封面从 `priority="low"` 升到 `normal`（原生的「优先级队列」
      才是 eager 的对应物，`loading="eager"` 只对 web 有效）
- [x] 随机语录 / 随机一的 loading 用**骨架屏**（HeroUI `Skeleton`）
      —— 原来语录是「空白 → 突然出现一张卡」，随机一部是一个灰方块
- [ ] 下拉刷新与触底加载

### Type 2.2 · 浏览与搜索

- [x] `(tabs)/explore` —— 分类 / 年代 / 平台浏览
- [x] **浏览页排序改面板**（Master 要求）：移除顶部「发行日期 / 评分 / 人气」三个 Tabs，
      改成头部「排序」按钮 + `SortPanel`（**字段**：人气 / 评分 / 发行日期 / ID 顺序；
      **方向**：升 / 降序，换字段自动带常用方向），默认**人气降序**；
      选择存 `preferences.browseSort`（`listSort` 已随清单本地化废弃，被它取代）；
      深链 `?sort=` 参数不再支持（原来只有首页常用入口在用，那些入口已移除）
- [x] `(tabs)/search` —— 关键词搜索（走 `searchrank` 排序）
- [x] **搜索页支持四档**（Master 要求）：搜索框下加一行 `SegmentedControl`
      —— **作品（默认）** / 人员 / 用户 / 厂商（即 VN / staff / user / producer；
      控件上用短名，因为「制作人员」与「制作者」只差一个字，并排时用户分不清，
      完整说法见 `SCOPE_LABEL` / `SCOPE_NOUN`）；四档共用同一个关键词，
      换档不清空输入（对比着看更直观）
  - [x] 抽出 `features/search`（feature-first）：
        `search-logic`（范围 / 文案 / 行数据映射，纯逻辑）+ `hooks`
        （`useStaffSearch` / `useProducerSearch` / `useUserLookup`）+ `components`
        （`search-screen` / `vn-`·`catalog-`·`user-search-results`）；
        路由 `app/(tabs)/search.tsx` 只剩一行 re-export
  - [x] 抽出 `hooks/use-debounced-value`（350ms 防抖，原来内联在搜索页里）
  - [x] `SearchResultRow` —— 作品以外的行（名称 + 罗马字原名 + 右侧次要信息 + 箭头）；
        右侧信息：staff 显示 `s1234`，制作者显示「公司 · p24」，用户显示 `u2`
  - [x] ⚠️ **staff 搜索按「名字行」匹配，同一个人会命中多行**（Master 报的真事故：
        官网能搜到的「sukaji」本项目搜不到）。根因：`/staff` 的每个**名字**各占一行、
        共享同一个 `id`（主名行 `ismain: true` + 别名行 `ismain: false`），
        搜哪个名字就命中哪一行 ——「sukaji」命中的是别名行。
        曾经为去重加 `ismain = 1` 过滤，**恰好把别名行全滤掉了**（搜别名一条不剩）。
        现在不过滤，改为 `toStaffEntries` 按 `id` 客户端去重、优先主名行
        （与官网一致：官网 `/s?q=sukaji` 也只给一行、显示命中的那个名字）
  - [x] ⚠️ **用户只能精确匹配**（Kana 的 `GET /user` 没有模糊搜索，实测 `?q=yor`
        查不到 `Yorhel`）：新增 `findUser` 端点（最多一条结果、不翻页），
        「没找到」时必须说明「要写完整用户名或用户 ID（如 u2）」，
        否则用户会以为是自己输错了
  - [x] **移除了每档的搜索 hint**（Master 要求）：`SCOPE_PLACEHOLDER`（按档位给的
        placeholder）与 `SCOPE_IDLE`（按档位给的空态提示）两张表全部删掉，
        输入框只剩一句通用「搜索」；作品档原来的「热门标签」也已移除。
        「用户只能精确匹配」这类限制改由**未命中时的文案**承担（`userMissDescription`）
  - [x] **数据库统计扇形图从首页搬到搜索页**（Master 要求）：空输入时占下半屏，
        并**去掉卡片外框与标题行**，直接展示图表（`DatabaseStats` 改成裸图表组件，
        只留 12pt 左右留白；`Card` / `H5` 标题一并删除）。
        搜索页的「没事干」状态正好有东西看，输入关键词后让位给结果列表
  - [x] 冒烟新增 8 条（staff 主名 / 别名都能命中 / producer 搜索 / findUser 命中 /
        findUser 不支持模糊匹配 / search-logic 纯逻辑 / staff 按 id 去重 /
        即将发售与最新上架的 TBA 与排序 / 评价列表与详情抓取解析）
- [x] `features/browse/components/FilterSheet` —— 高级筛选（评分 / 票数 / 语言 /
      平台 / 时长 / 开发状态 / 年代 / 内容完整度）
- [x] `components/SegmentedControl`
- [x] **卡片显示项可配置**：独立的「卡片显示」面板（入口在浏览页头部，**筛选按钮左边**）
      （评分 / 发售日期 / 原语言 / 时长 / 平台 / 开发状态），存 `preferences.cardFields`
      —— 与筛选条件无关，只改外观；顺带把 `devstatus` 补进列表字段（原来徽标永远不显示）
- [x] `features/browse/components/Panel` —— 抽出的全屏面板外壳，筛选 / 卡片显示两个面板共用
      （仍是「无 Portal 的 absoluteFill 覆盖层」，见 FilterPanel 顶部那段踩坑说明）
- [x] 列表封面 / 角色头像改用 `image.thumbnail`（256×362，几 KB）；
      详情页大图仍用原图
- [ ] 筛选条件持久化（跨启动记住上次筛选）

### Type 2.3 · 筛选交互重做

> 原状态：草稿式「清空 / 应用」+ 10 个平铺分组 + 复制了两份的 chip 样式，
> 改完得点「应用」才知道结果，样式也乱。

- [x] **边改边生效** —— 去掉 draft state 与「清空 / 应用」按钮，改一个选项立刻作用到列表
- [x] **顶部实时汇总** `FilterSummary` —— 已生效条件列成可单条删除的标签 + 清空入口
- [x] **列表顶部条件速览** `ActiveFilterStrip` —— 关掉面板后仍能看到筛了什么
- [x] `describeFilters()` 统一翻译「状态 → 标签」，面板与列表两处内容不可能对不上
- [x] 计数由 `describeFilters().length` 推导，删掉手写的 `countActiveFilters`
- [x] `FilterGroup` + `FilterChip` 收敛分组与 chip 样式，删掉旧的 `components/ChipGroup.tsx`
- [x] 选中态改用 `accent-soft` 淡色底（原来实心 `bg-accent` 在背景图上过于抢眼）
- [x] 分组标题右侧显示已选数量徽标，扫读时能直接看出哪几组生效了
- [x] 长选项列表折叠（`collapseAfter`）替代原来点不动的「还有 N 项…」
- [x] 筛选入口图标改用主题 `accent` / `muted`（原来写死 `#F31260` / `#8E8E93`）

### Type 2.4 · 详情页

- [x] `features/vn/vn-detail-screen` —— VN 详情外壳（头部固定 + 页签路由）
- [x] `features/catalog/detail-screens` —— 角色 / 制作者 / staff / 标签详情
- [x] **制作者详情的外链也放进页签**（Master 要求，与 VN 详情对齐）：
      页签 概览 / 作品 / **外链**，概览只剩简介；
      外观复用 VN 详情那一版卡片式列表，所以把它从
      `features/vn/components/vn-ext-links-tab` 抽成共用组件
      **`components/ext-link-cards`**（`SITE_LABEL` 站点名中文化 + 卡片行 + 外链箭头），
      VN 详情页签变成三行包装（两处各写一份样式迟早对不上）；
      页签沿用「始终全部显示、空内容由页签自己渲染空态」的约定
      （制作者 / staff 两页的「外链」档后来也换成了 `SegmentedControl`，见下条）
- [x] **制作者 / staff 详情改用 `SegmentedControl` + 抽出共用页签外壳**（Master 要求）
  - [x] 新增 `features/catalog/components/catalog-detail-tabs`：三档（概览 / 作品 / 外链）
        的分段控件 + 作品档（网格 / 列表切换 + 三态）与外链档都在里面；
        这两个页面除了文案一模一样，各写一份必然对不上。
        `detail-screens.tsx` 里两个详情函数因此各瘦身到 ~50 行
  - [x] 页签从 HeroUI `Tabs` 换成 `SegmentedControl`：只有三档、档位名都两字，
        选中态与应用其它地方（外观 / 内容设置 / 搜索范围 / 首页信息流）统一，
        也不再需要手动挂 `Tabs.Indicator`（HeroUI 不注入，漏了就没选中底色）
  - [x] **staff 的外链也抽成第三档**，item 样式与制作者一致（`ExtLinkCards` 卡片式），
        概览只剩简介；staff 原来那种「label: name」纯文本行
        （`components/typo#ExternalLinks`）随之删除 —— 全项目只剩卡片式一种外链样式
- [x] **staff 详情展示参与作品**：概览 / 作品页签；
      `/vn` 的 `staff` 嵌套过滤器（新增 `vnWithStaff` + `queryVnsByStaff`）拉取
      该制作人员参与的全部作品（覆盖脚本 / 原画 / 音乐等全部职责），
      作品页签共用 `VnCollection` 支持网格 / 列表双视图（与制作者页签一致）
- [x] **VN 详情页签细化**：概览 / 角色 / 制作 / 版本 / **截图 / 关联 / 语录 / 讨论 / 外链**
  - [x] 截图 / 关联作品 / 语录 / 讨论 / 外部链接从概览里拆成独立页签
        （它们都是列表型内容，混在概览里既把页面拉得极长、又只能挤在窄带里）
  - [x] 9 个页签超出一屏宽 → 页签列表走 `Tabs.ScrollView`（自动把选中项滚进视野）
  - [x] 页签**始终全部显示**，空内容由各页签渲染空态
        （避免页签集合在不同作品间跳变，用户以为「功能没了」）
  - [x] **语录页签（Master 要求）**：`VnQuotesTab` 读 `/quote` 的 `vn` 嵌套过滤器
        （`queryQuotes({ vnId })`，按 `score` 降序，取前 50 条），
        卡片式展示语录正文 + 角色链接 + 评分
  - [x] ⚠️ **没有评价页签**：Kana API 不提供 reviews（`/review` 实测 404，
        只有 `/vn` 的 `has_review` 布尔过滤器），拿不到正文 / 作者 / 分数 ——
        经 Master 确认只做 API 支持得起的「语录」
  - [x] `VnOverviewTab` 只留基本属性 + 简介 + 标签
  - [x] `VnScreenshotsTab` 改成纵向列表，按 `dims` 还原宽高比（夹到 1:1 ~ 2.2:1）
  - [x] `VnRelationsTab` 按关联类型分组，标出官方 / 非官方
  - [x] `VnExtLinksTab` 做成卡片列表，站点名中文化
  - [x] 按模块拆文件（概览 / 角色 / 制作 / 版本 / 截图 / 关联 / 语录 / 外链各一个），
        详情页外壳从 483 行降到 ~180 行
  - [x] 删掉因拆分而失去引用的 `components/HorizontalGallery`
  - [x] `VnOverviewTab` 简介默认折叠 6 行（`CollapsibleText` 用 `onTextLayout`
        判断是否真截断，短简介不挂「展开」按钮）；标签默认只显示 12 个 + 「展开全部 N 个」
  - [x] 多语言作品的语言用 chip 展示（原来挤成「日语 · 英语 · 中文」一行），
        原始语言用 accent 标出
  - [x] 截图列表用 `screenshots.thumbnail` 占位（几 KB，先出图），高清图随后盖上来
- [x] **详情页信息结构（Master 要求）**：
  - [x] 信息 Tabs 上方加**三列概览**：**评价人数 / 均分 / 游玩时长**
        （`StatBlock`；人数用 `formatCount` 缩写；时长优先 `length_minutes`，
        缺了退回 `length` 档位）
  - [x] 封面右侧是**值 chip 行**（HeroUI `Chip`，只放值不放 label）：
        游玩状态（清单状态标签，VNDB 英文原名）/ 我的评分 / 发行日期 /
        开发商（只第一个，可点进制作者页）；开发中 / 已取消另加一枚语义色 chip
        （它没有别处可显示）
  - [x] 头部的均分 + 评价人数（原 `RatingBadge`）**移除** —— 三列概览已经显示
  - [x] 概览页签移除**平台 / 时长 / 语言**三行（时长进三列概览，
        平台 / 语言在「版本」页签有更细粒度）
  - [x] 「编辑清单条目（状态 / 打分 / 标签）」按钮在**右上角**、紧挨加入 / 移出按钮的左边；
        按钮只留铅笔 + 「编辑」
- [ ] 详情页返回后保留滚动位置

### Type 2.5 · 角色分档

> 原状态：角色页签只分「主要 / 次要」两档，而且**根本没请求 `vns.role`**
> （字段列表里没有它），实际是「全部当主要」—— 弹丸论破那种
> 「1 主角 + 16 主要 + 2 次要 + 4 登场」的分布完全看不出来。

- [x] `/character` 请求补上 `vns{id,role}`，按**本作**的角色定位分档
- [x] ⚠️ `/character` 的 `image` **没有 `thumbnail`** 字段（只有 `/vn` 有）——
      带上它整个请求 400。冒烟新增「`queryCharactersByVn` 字段集合法」兜住这一类坑
- [x] ⚠️ **`queryVnsByCharacter` 用错了过滤器**：把 `/character` 的 `vn` 用在 `/vn` 上
      （400），角色详情页「登场作品」整块进错误态。改用 `vnWithCharacter`，
      冒烟新增真请求检查 `queryVnsByCharacter 用对了过滤器`
- [x] 四档页签：主角 / 主要角色 / 次要角色 / 登场（计数跟在标签后面）
- [x] 默认落在最重的一档（通常是「主要角色」），而不是固定第一档
- [x] 修正 `CHARACTER_ROLE` 枚举：`background` → `appears`
      （Kana 实际只有 `main` / `primary` / `side` / `appears`，前者永远筛不到）
- [x] 4 档 + 计数的页签走 `Tabs.ScrollView`，窄屏不挤

### Type 2.6 · 折叠展示（长文本 / 长列表）

> 动机：VNDB 的简介几千字、标签几十个、角色特性 40–70 条，
> 一进来就铺满整屏；而且页面被撑得过长时，下面的内容要滚很久才看得到。

- [x] `components/Collapsible` —— `CollapsibleText`（`onTextLayout` 判断是否真截断）+ `useCollapsedList` / `ExpandToggle`（长列表共用）
- [x] VN 概览：简介 6 行、标签 12 个
- [x] 角色详情：特性 12 个；简介 6 行
- [x] 制作者 / staff / 标签详情：简介（说明）6 行

### Type 2.7 · Tabs 选中态配色

> 症状（Master 报）：角色页签的选中态「active 与 Tab 背景 / 字体颜色重复」。
> 查下来是两个问题叠一起：
>
> 1. `--segment`（选中块）从 `--default` 只混 20% accent，暗色主题下色差只有 22
> 2. `--segment-foreground`（选中文字）与 `--muted`（未选中文字）在几套灰调主题里
>    算出来**是同一个颜色**（Gekkou No Carnevale 暗色下都是 `#848484`）
> 3. VN 详情页的 7 个页签**根本没挂 `Tabs.Indicator`**（HeroUI 不自动注入），
>    等于一直是「没有选中底色」的状态

- [x] `--segment` 混色比例 20% → 30%（按需退让：推亮后会「配谁都不达标」的主题自动降到 25%）
- [x] `--segment-foreground` 增加与 `--muted` 的**区分度**约束（≥1.5:1），
      并保证同时满足「压在选中块上 AA」「落在列表底上 AA」
- [x] 冒烟新增断言：选中 / 未选中文字不能撞色；选中块与列表底色差阈值 10 → 25
- [x] `VnDetailScreen` 补 `Tabs.Indicator`

### Type 2.8 · 讨论模块（抓取 VNDB 网站）

> ⚠️ Kana API **没有讨论 / 帖子端点**（`/thread`、`/threads`、`/post`、`/t` 实测全部 404），
> 官方端点表也没有；讨论数据只存在于网站 HTML。经 Master 确认采用**抓网页**方案 ——
> 这是「官网改版就会挂」的脆弱方案，已用冒烟把解析结构卡住。

- [x] **抓取层抽成共享 lib**：`lib/scrape/html`（实体解码 / 去标签 / 挑战页识别 /
      限流页识别）+ `lib/scrape/client`（Cookie 挑战、**限流退避**）——
      讨论与用户两个模块共用同一套
  - [x] **抓取限流处理**：请求太密会拿到 503「Crawlers are not permitted」，
        识别后退避重试（1.2s / 3s），仍不行抛明确错误（而不是伪装成「解析失败」）
- [x] `features/discussion/scrape.ts` —— 纯函数 HTML 解析，可被冒烟直接测
  - [x] `parseThreadList` —— 帖子列表（标题 / 回复数 / 发起人 / 最后回复，`rel="next"` 判翻页）
  - [x] `parseThreadPage` —— 单帖楼层（楼层号 / 作者 / 时间 / 编辑时间 / 正文节点树）
  - [x] `parsePostNodes` —— 正文 HTML → 节点树（`br` / 粗体 / 斜体 / 下划线 /
        链接 / 引用块 / 剧透块；report·edit 行丢弃；节点带稳定 `id` 供 React key）
- [x] `features/discussion/client.ts` —— 网络层：过 VNDB 的「Checking browser」
      Cookie 挑战（503 + 种 Cookie 图片 → 重试；手动 Cookie 罐 + RN 原生 jar 双保险）；
      `fetchVnDiscussions`（讨论板列表）/ `fetchThread`（单帖正文，每页 25 楼）
- [x] `features/discussion/hooks.ts` —— `useVnDiscussions` / `useThread` 无限翻页
- [x] `features/discussion/components/vn-discussions-tab.tsx` —— 帖子列表；
      元信息用独立元素 + 间距排版（**不用 `内容 · 内容` 拼接**，Master 要求）
- [x] `features/discussion/components/post-content.tsx` —— 正文渲染：嵌套 `<Text>`
      表达粗体 / 斜体 / 下划线 / 链接，引用块左竖线，剧透默认盖住点按显示
- [x] `features/discussion/components/thread-screen.tsx` + 路由 `app/thread/[id]` ——
      **站内帖子页**（不再跳浏览器）：楼层卡片 + 无限翻页 + 页脚「共 N 楼」
- [x] VN 详情页新增「讨论」页签（现共 9 个页签）
- [x] 冒烟新增真请求：反爬挑战能过 + 列表 / 单帖 HTML 结构还能解析（含引用块）
- [x] `VNDB_WEB_BASE` 收敛到 `constants/config`

### Type 2.9 · 用户详情页（抓取 VNDB 网站）

> 入口来自讨论列表与帖子页的**昵称**（站内跳转，不开浏览器）。

- [x] `features/user/scrape.ts` —— 纯函数解析 `/u2` 资料页：用户名 / 注册日期 /
      编辑数 / 投票数与均分 / 游戏时长 / 清单规模 / 评价数 / 论坛统计 /
      自我标记的特性 / 打分分布（10 档）/ 近期打分
- [x] `features/user/client.ts` + `hooks.ts` —— `fetchUserProfile` / `useUserProfile`
      （HTTP 走共用的 `lib/scrape/client`，同样含限流退避）
- [x] `features/user/components/user-screen.tsx` —— 三列概览（清单作品 / 投票数 /
      发帖数）+ 资料行 + 特性分组 chip + 打分分布 + 近期打分（可点进作品详情）
- [x] `features/user/components/vote-histogram.tsx` —— 手绘直方图（10 档）
- [x] 路由 `app/user/[id]`
- [x] 讨论列表的「发起自 / 最后回复」与帖子页的作者昵称改为**可点**，
      用 `text-link` 标示（讨论列表解析新增 `starterId` / `lastPosterId`）
- [x] 冒烟新增真请求：资料页字段 + 列表能取到发起人 id
- [x] **修复 `getUser` 的真 bug**：查询参数是 `q` 而不是 `id`，
      写错会 `400 Invalid argument`（此前无人调用，bug 一直没暴露）
- [x] **「全部投票」独立页面（Master 要求）**：**不放进资料页** ——
      入口是「近期打分」标题**右侧**的「查看全部」按钮（`SectionHeader.trailing`），
      点进新页面 `/user/{id}/votes`
  - [x] 路由结构调整：`app/user/[id].tsx` → `app/user/[id]/index.tsx`，
        新增 `app/user/[id]/votes.tsx`
  - [x] 可视列由**头部筛选按钮**开面板控制（`VoteColumnsPanel`）——
        复用浏览页的 `FullScreenPanel` + `FilterGroup` / `FilterChip`
        （筛的不是数据而是外观，与「卡片显示」面板同类）
  - [x] 7 个可选列：作品名称 / 评分 / 游玩时长 / 通关速度 / 投票时间 / 开始 / 完成
        （默认前四项里的名称、评分、时长、投票时间）
  - [x] **分页**：`/ulist` 每页 50 条，滚到底自动加载下一页，尾部「没有更多了」
  - [x] ⚠️ **踩坑**：`/ulist` 的 `count` **未登录一律 400**
        （报 `Missing "user" parameter and not authenticated.`，报错信息有误导性
        —— 明明传了 `user`）。所以总数拿不到，只能报「已加载 N 条」
  - [x] 列定义 / 取值 / 格式化抽到 `features/user/vote-columns.ts`，
        面板与列表**同源**（各写一份迟早对不上）
- [x] 「全部投票」数据层（服务两处）
  - [x] `USER_VOTE_FIELDS` —— 瘦字段集（无封面 / 无 notes）；刻意不列 `vn.id`
        （与顶层 id 相同会被 VNDB 省略，导航用 `UListItem.id`）
  - [x] `queryUserVotes` —— 走 **Kana API**（`/ulist?user=…`），
        用**虚拟标签 7「已打分」**做服务端过滤
  - [x] ⚠️ **踩坑**：只按 `voted` 倒序排序时，Kana 把 `voted = null` 的条目排
        在**最前面** —— 愿望单条目霸占第一页，打分记录要翻好几页才出现；
        标签过滤后每页都是有效数据
  - [x] 游玩时长 / 通关速度走**抓取** `/u…/lengthvotes`（`/ulist` 没有时长字段，
        只有 `started` / `finished` 两个日期），按 vnId 合并进列表，抓不到显示「—」
  - [x] 冒烟新增两条：`USER_VOTE_FIELDS` 合法 + 能取到打分记录；时长页解析
  - [ ] 列开关的选择**暂存组件内**（跨启动不记住；要记住需加 preference 键）

---

## Module 3 · 用户数据层

### Type 3.1 · 登录

- [x] 粘贴 Token 登录 + `/authinfo` 权限校验
- [x] 权限检查（`listread` / `listwrite` 缺失时给出提示）

### Type 3.2 · 清单（**VNDB 直读直写**）

> 2026-09-30 架构调整（Master 决定）：**视觉小说清单数据一律不保存本地数据库**，
> 每次从 vndb.org 现拉现读；删除「同步」（下拉刷新即取最新）。
> 此前的本地镜像 / 写队列 / 乐观回滚 / 离线可读**全部移除**。

- [x] 数据层：`features/ulist/hooks.ts` 服务端驱动
  - [x] `useUlistInfinite` —— `useInfiniteQuery` 直查 `/ulist`（每页 50）
  - [x] `useUlistItem` —— 单条直查 `/ulist`（`filters: id = v…`）
  - [x] `useUlistLabels` —— `GET /ulist_labels`（含 count）
  - [x] 写入：`useUlistMutations`（PATCH / DELETE `/ulist`）、
        `useUlistReleaseHold`（PATCH / DELETE `/rlist`），成功后失效查询重取
- [x] 清单 Tab（`UlistTabScreen`）
  - [x] **标签筛选改成纯客户端**（Master 要求）：进入清单本来就整份拉回来（分页），
        切标签只是换个过滤条件，原来却换 `queryKey` 重新请求 + 回到全屏 loading。
        现在 `useUlistInfinite()` **不带** `label` 过滤、queryKey 固定，
        筛选走 `features/ulist/list-filter#filterByLabel`（纯逻辑，冒烟已测）
        —— 切标签零请求、零 loading
  - [x] ⚠️ **本地只能筛「已加载」的条目**（一页 50）：筛选态下列表底部只给一个
        「加载更多」按钮（Master 要求：**不要**显示「N 条里筛出 M 条」这类读数；
        各标签的真实条数胶囊上已经写着），补的是**未过滤**清单的下一页，
        筛出的结果随之变多；空态也保留同一个出口
  - [x] **排序 UI 已移除**（Master 要求）：清单固定「加入时间新 → 旧」，
        原「加入 / 打分 / 开始 / 均分 / 标题」分段控件与 `ULIST_SORT_PARAM` 一并删除
  - [x] **「标签」caption 已移除**：筛选条只剩胶囊行（`UlistLabelFilter`）
  - [x] 下拉刷新取最新；触底翻页；空态也能下拉刷新
  - [x] 删除「同步」按钮与「待同步」状态行；行组件复用 `VnListItem`
  - [x] **点条目进作品详情页**（2026-09-30 起）：清单 → 详情 → 右上角「编辑」→ 编辑页；
        原来直接跳编辑页，但多数时候用户只是想看看作品
  - [x] **网格 / 列表双视图**（`UlistItems`）：网格 = 纯封面墙（走共用的 `VnCoverGrid`），
        列表 = 带打分 / 标签的行；右上角**单个按钮**切换
        （`components/ViewModeButton`：图标 / 文案表示切过去的目标视图，不是 Tabs / 分段控件）
  - [x] **默认网格视图**，选择存 `preferences.vnViewMode` 跨启动记住（脏值回退网格，
        旧键 `ulistViewMode` 的值会自动迁移；制作者详情的「作品」页签共用这个偏好）
- [x] 打分 / 标签 / 备注 / 起止日期（`/ulist/[id]` 编辑页）
  - [x] 页面内容完全由服务端数据渲染（标题 / 封面 / 现有值）；未加入时的「加入清单」
        入口保留为深链兜底（正常路径下进不来 —— 右上角「编辑」只在已加入时出现）
  - [x] 表单 draft + 底部「保存」统一 diff 成一条 `UListPatch` 直写
  - [x] 打分滑杆 10–100；状态标签互斥收敛（`toggleLabel`）+ 自建标签多选
  - [x] 备注（多行）、开始 / 完成日期（YYYY-MM-DD 严格校验 + 今天/清除）
  - [x] 移出清单二次确认（连带删除发行版持有记录，不可撤销）
  - [x] 点头部**标题**进作品详情页（`/vn/[id]`，标题用站内链接色）；
        底部的「查看作品详情」按钮已按 Master 要求移除
- [x] 发行版持有状态（VN 详情 · 版本页签）
  - [x] Pending / Obtained / On loan 三档胶囊，再点已选中 = 移除记录
  - [x] 当前状态直读 `/ulist` 的 `releases`；只在有 `listwrite` 权限时渲染
- [x] **标签一律用 VNDB 英文原名**（Playing / Finished / 自建标签原文 / 持有状态
      Pending·Obtained·On loan），不再做中文翻译
- [x] VN 详情清单入口（`UlistQuickButton`）：服务端直读，不再有「本地没同步到」的误判
- [x] **VN 详情页清单操作改版**（Master 要求）：
  - [x] 右上角 `UlistToggleButton`：未加入 → 「加入清单」，已加入 → 「移除」
        （移除走系统 Alert 二次确认 —— `DELETE /ulist` 会连带删发行版持有记录）
  - [x] 头部原来的 `UlistQuickButton` 改成 `UlistEditEntry`：只在已加入时渲染，
        只显示「我的打分 N · 编辑」/「打分 / 标签 / 备注」并进编辑页，
        不再重复「已加入 / 加入清单」这个状态
- [x] **剔除详情页重复渲染的信息**（以 v2002 命运石之门为例）：
  - [x] 删掉「原始均分 x.xx / 10」——与评分 badge 是同一个数（v2002 两者都是 90.2），
        且 API 的 `average` 现在就是 0–100，`/ 10` 本身也是错的；
        `VN_DETAIL_FIELDS` 里的 `average` 与 `format.ts#averageToRating`（死代码）一并删除
  - [x] 头部的原始语言只在概览页签**不会**渲染语言行时兜底（概览已有「日语（原始）」）
- [x] **修复：清单列表点条目跳 `/ulist/undefined` 进错误页**
      （根因：`/ulist` 的 `vn` 子对象**不带 `id`** —— 与顶层 `id` 相同被 VNDB 省略，
      请求 `vn.id` 也不返回。`UlistItemRow` 之前把 `vn` 原样交给 `VnListItem`，
      点击回调取 `vn.id = undefined` → 路由变成 `/ulist/undefined` → 编辑页拿它当
      过滤器 → `400 Invalid 'id' filter`。现改用顶层 `item.id` 导航；编辑页对非法
      参数给「无效的作品 ID」空态、不发请求（`entryLogic.isVnId` + 冒烟））

### Type 3.3 · 统计

- [x] ~~`features/stats/RankScreen` —— 榜单~~ **已移除**（2026-09-30，Master 要求）：
      首页常用入口删掉后它没有入口了，`/rank` 路由、页面、`queryKeys.account.ratingRank`
      一并删除；统计需求由 `/stats` 收藏统计承接
- [x] **收藏统计页 `/stats`（M4 增强，chart-kit 图表页）**
  - [x] 数据：`features/stats/hooks.ts` 翻页拉完整份清单（每页 100，最多 20 页），
        字段集 `ULIST_STATS_FIELDS`（只取年份 / 厂商 / 标签 / 打分，比清单页瘦）
  - [x] 聚合纯函数 `features/stats/stats-logic.ts`：年份分布 / 标签分布 /
        厂商 Top N / 概览数字（冒烟已卡）
  - [x] 图表：**发售年代饼图**（十年一档，如 1990-1999）、清单标签饼图、
        游戏类型饼图（ADV / NVL / RPG…，VNDB 的 Technical 顶层标签，id 固定清单 +
        真接口冒烟复核）、厂商 Top 8 横向条（**手绘**：chart-kit 经典 API 没有横向柱，
        厂商名塞不进竖柱标签）
  - [x] 类型分布要带 `vn.tags.id`（实测 100 条 ≈ 121 KB，比其他统计字段重 6 倍），
        走**独立查询**：它慢慢加载，年代 / 标签 / 厂商先出来
  - [x] **卡片标题不带「· 数量」**（Master 明确不喜欢这种形式）—— 同类清理：
        详情页的「标签 / 特性 / 相关作品 / 制作 / 配音」标题也一并去掉数量后缀
  - [x] 颜色取主题 token（`accent` / `muted`），换主题跟着变；入口在「我的 → 收藏统计」
  - [x] `components/BackBar` —— 抽出的共用返回栏（统计页与榜单页共用）

---

## Module 4 · 打磨发布

### Type 4.1 · 体验

- [x] `components/ScreenState` —— 加载 / 空 / 错误三态
- [x] 设置页「当前主题」读数面板（后来按 Master 决定删除：外观页只留用户真正要调的东西）
- [ ] 骨架屏
- [ ] 首启引导页（`hasSeenOnboarding` 字段已就位）

### Type 4.3 · 设置信息架构（「我的」改版）

> 原状态：一页到底 —— 登录卡片、明暗模式、主题网格、背景滑杆、内容显示、
> 清缓存、关于、调试读数全堆在「我的」里，首屏滑很久才见底，
> 且绝大多数是「偶尔改一次」的设置。

- [x] 「我的」改成传统列表：**顶部用户信息 + item 列表**，未登录 / 已登录共用账号入口
- [x] 拆分二级页：`/settings/appearance`（明暗 / 主题 / 背景图）、
      `/settings/content`（成人内容 / 每页条数）、`/settings/account`（Token 登录 / 退出）、
      `/settings/about`（版本 / 数据源 / 免责声明）
- [x] `features/settings/components/SettingsShell` —— 四个二级页共用的返回栏 + 滚动外壳
      （`centerContent` 让内容区 `flexGrow: 1`，页面才能把内容垂直居中 ——
      ScrollView 的 contentContainer 默认按内容高度撑开，不给 flexGrow 的话
      子元素里的 `flex-1` 高度是 0，`justify-center` 不会有任何效果）
- [x] **账号页登录表单居中 + 给 Input 加 Label**（Master 要求）：整块垂直居中
      （`flex-1 justify-center` + `max-w-sm` 免得平板上拉太宽），
      输入框包进 HeroUI `TextField` + `Label`（`Label` 会通过 form-field 上下文
      自动接到 `Input` 的无障碍标签上）；两个按钮从「各裹一层 `flex-1` 的 View」
      改成 `Button` 自己带 `flex-1`
- [x] `features/settings/components/SettingsItem` —— 基于 HeroUI `ListGroup.Item` 的
      「图标 + 标题 + 读数 + 箭头」行，危险操作用红色图标
- [x] `features/settings/options.ts` —— 选项表只留一份（首页读数与分段控件共用同一套中文名）
- [x] 首页移除二级内容：调试读数挪进「外观」页，存储说明 / 示例作品链接删掉
- [x] 清空缓存后弹 toast 反馈（HeroUI `useToast`，原来点完没反应）
- [x] 关于页版本号取 `app.json`（不再手写）
- [ ] 设置项搜索 / 分组标题（条目变多之后再说）

### Type 4.5 · 构建与分发

- [x] **EAS 构建打通**（2026-09-30，Master 要求用 EAS）
  - [x] `eas.json`：`development`（dev client）/ **`preview`（APK，内部分发）** /
        `production`（AAB + `autoIncrement`）；`cli.appVersionSource = "remote"`
  - [x] `eas init --force`：项目 `@halory/vnlite` 已创建并链接
        （`app.json` 写入 `extra.eas.projectId`），`android.package = com.halory.vnlite`
  - [x] 首次构建成功：`eas build -p android --profile preview --non-interactive`，
        keystore 由 EAS 云端自动生成，产物 116.5 MB（**universal APK，含 4 个 ABI**；
        要更小可开 ABI 拆分或改 AAB）
  - [x] 本地 Gradle 路线暂缓：Gradle 9.3.1（Windows 读不了 settings 脚本）
        与 9.4.1（Kotlin 元数据版本冲突）都过不去，详见 `docs/PLAN.md` §8
  - [x] **版本 1.0.0 → 1.1.0**（2026-10-01）：补 `ios.bundleIdentifier = com.halory.vnlite`
        （iOS 构建必需）与 `ios.infoPlist.ITSAppUsesNonExemptEncryption = false`
        （TestFlight / App Store 必需，否则每次构建都告警）
  - [x] **Android 按架构分包**（2026-10-01，Master 要求「根据手机架构产出多个安装包」）
    - [x] ⚠️ **`eas.json` 没有 `splits` 选项** —— schema 里根本没这个字段
          （`"build.preview.android.splits" is not allowed`，eas-cli 24.8.0 实测），
          ABI 分包只能在 Gradle 层做
    - [x] `plugins/with-android-abi-splits.js` —— config plugin 在 prebuild 之后往
          `app/build.gradle` 的 android 块插 `splits { abi { … } }`；
          托管工作流下不用为此提交整个 `android/` 目录
    - [x] `include "armeabi-v7a", "arm64-v8a", "x86", "x86_64"` +
          **`universalApk true`**（架构不明的机器靠通用包装得上）
    - [x] 锚点用 `android {` + `ndkVersion rootProject.ext.ndkVersion`（模板固定结构），
          且**幂等**（含 `splits {` 就直接返回，prebuild 跑两遍也不会插两次）
    - [x] 构建产物（v1.1.0，5 个 APK）：`arm64-v8a` **49.0 MB** /
          `armeabi-v7a` 41.7 MB / `x86` 50.5 MB / `x86_64` 50.5 MB /
          `universal` 116.9 MB —— 主流 64 位机装 49 MB 那个就够
  - [x] `eas.json` 补 `preview-simulator`（iOS 模拟器包，**不需要证书**，
        用来验证 iOS 工具链能跑通；真机 .ipa 仍需 Apple 凭据）
  - [ ] **iOS 真机包待办**：EAS 报
        `couldn't find any credentials suitable for internal distribution`
        —— 要 Apple Developer 账号，在**交互模式**下跑
        `eas build -p ios --profile preview`（登录 Apple ID 或配 App Store Connect
        API Key）

### Type 4.4 · 图片查看器

> 封面和截图原来只能看缩略图，长截图 / 文字小的图根本没法看。

- [x] `components/ImageViewer` —— 全屏查看器，手势走第三方库
      `react-native-zoom-toolkit`（纯 JS，无需 prebuild，Expo Go 可跑；
      reanimated 4 + gesture-handler 2 + worklets 都是现成依赖）
- [x] 能力：双指缩放（maxScale 6）/ 双击放大 / 拖动平移 / 左右滑换图 /
      上下滑关闭 / 顶部显示 `i / n` + 关闭按钮（吃安全区）
- [x] 组件本身不持状态（`index === null` 即关闭），封面与截图墙共用一个
- [x] **修复「查看器一片空白」**：`GalleryItem` 的内层容器是**按内容量尺寸**的
      （量出来的宽高当作图片尺寸去算缩放/平移边界），子元素写 `w-full/h-full` 会量出 0。
      现在用 `fitContainer(比例, 窗口)` 显式算出像素尺寸再渲染，比例取自 API 的 `dims`
- [x] Modal 内部补 `GestureHandlerRootView`
      （原生 Modal 是另一棵根视图，手势库拿不到 App 根部那个，否则缩放/滑动全失灵）
- [x] 缩略图先铺、高清随后：`placeholder` = `thumbnail`，`source` = 原图；
      只有当前这张按原分辨率解码（`allowDownscaling`），左右相邻的降采样省内存
- [x] NSFW 策略与 `CoverImage` 一致：`hide` 档不渲染，`blur` 档糊住 + **点一下**放行
      （双击留给缩放，两者不冲突）
- [x] 接入点：VN 详情页封面、截图页签（`CoverImage` 新增 `onPress`，
      双击切敏感内容的既有交互不变）
- [x] 列表封面也接查看器：`VnInfiniteList`（浏览 / 搜索 / 标签等所有大列表）、
      角色详情页的「相关作品」、首页「随机一部」
      （查看器挂在列表那一层，整页只用一个 Modal，不受 FlashList 回收影响）
- [ ] 真机验证手势（尤其 Android 返回键 / 手势冲突）

### Type 4.2 · 质量

- [x] 已知踩坑清单记录在 `docs/PLAN.md` §8
- [x] 主题冒烟 21 项（对比度 AA、暗/亮底方向、token 合法、选中态撞色、描边阴影不变量）
- [x] `computeTextShadow` 拆成纯函数，与 hook 共用同一实现，避免「测一份跑另一份」
- [ ] 单测（`scripts/` 下目前只有冒烟脚本）
- [ ] 真机回归：Android 7.0 / 主流分辨率 / 刘海屏
- [ ] 背景图可读性真机走查（11 套主题 × 遮罩 0% / 50% / 100% 三档）

### Type 4.6 · 复制（选中复制 + 长按整条复制）

> Master 要求：「**选择性的**复制」——长按拖选、只复制其中一段，
> 并且要**全局**有，不是逐页想起来才加。

- [x] **普通文字全局可选中**：排版层（`components/typo` 的 `H1–H6` / `Body` /
      `Paragraph`，以及 `components/muted` 的 `Muted`）默认带 `selectable={true}`，
      长按 → 拖选 → 系统菜单「复制」。覆盖详情页标题 / 简介 / 语录 /
      键值行 / 统计数字 / 评论与讨论正文（`post-content` 的最外层 `Text` 也补了 `selectable`）
  - [x] 开关放在展开的 props **前面**，调用点显式传 `selectable={false}` 才赢
  - [x] **可点的那一层里的文字显式关掉**（列表行标题 / 随机一部标题 /
        语录页签角色名 / `LinkText`）：那一层已经有「长按整条复制」，
        不关的话平台差异会让两套手势打架（Android 上系统选区可能先弹出来）
  - [x] ⚠️ **HeroUI 的全局 `textProps` 白名单里没有 `selectable`**（只有
        `adjustsFontSizeToFit` / `allowFontScaling` / `maxFontSizeMultiplier` /
        `minimumFontScale`），所以覆盖不了 HeroUI 内部标签（按钮 / Chip / 页签文字）；
        那些本来也都套在 Pressable 里，不受影响
- [x] **点得动的一层改走「长按整条复制」**：`hooks/use-copy` 的 `useCopyProps`
      （写剪贴板 + 成功后震动 + toast 报复制了什么），文本格式由纯函数
      `utils/copy-text` 决定（冒烟已卡）
  - [x] `entryCopyText` —— 「名字 + `(id)` + 官网链接」。只复制名字没用：
        VNDB 上同名条目一搜一大把，带 id 与链接对方一点就打开
  - [x] `vnCopyText` —— 作品版（传 `VnSummary` / `VnDetail` 即可）
  - [x] `copyPreview` —— toast 只有一行，长文本先压空白再截断
  - [x] 接入点：`VnListItem`（浏览 / 搜索 / 标签 / 清单 / 相关作品等**所有**作品列表行）、
        首页「随机一部」与每日语录卡片里的作品名行、
        `ExtLinkCards`（复制链接）、语录页签的角色名链接
  - [x] 长按**不会**连带触发 `onPress`（RN `Pressability` 在长按命中后取消 press，
        `node_modules/react-native/Libraries/Pressability/Pressability.js` 的
        `isPressCanceledByLongPress`），所以进详情页 / 开外链的点击行为不受影响
  - [x] 震动只在复制**成功**之后发；失败弹 toast；空文本直接不复制（不提示）
- [x] **不加「长按可复制」之类的提示文案**（Master 明确要求）——只有读屏用的
      `accessibilityHint`（`copyable.accessibilityHint`）
- [ ] 真机验证两件事：① `selectable` 文字在 `FlashList` 行内长按是否正常弹选区；
      ② 可选的文字套 `numberOfLines` 截断时，Android 选区范围是否正确
