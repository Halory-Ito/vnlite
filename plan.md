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
- [x] **VN 详情页签细化**：概览 / 角色 / 制作 / 版本 / **截图 / 关联 / 语录 / 讨论 / 攻略 / 外链**
  - [x] 截图 / 关联作品 / 语录 / 讨论 / 攻略 / 外部链接从概览里拆成独立页签
        （它们都是列表型内容，混在概览里既把页面拉得极长、又只能挤在窄带里）
  - [x] 10 个页签超出一屏宽 → 页签列表走 `Tabs.ScrollView`（自动把选中项滚进视野）
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
- [x] VN 详情页新增「讨论」页签（现共 10 个页签）
- [x] 冒烟新增真请求：反爬挑战能过 + 列表 / 单帖 HTML 结构还能解析（含引用块）
- [x] `VNDB_WEB_BASE` 收敛到 `constants/config`

### Type 2.10 · 攻略页签（独立静态 JSON 仓库）

> ⚠️ Kana API **没有攻略端点**，攻略数据来自独立仓库
> `Halory-Ito/vnlite-walkthrough-and-guide`（纯静态 JSON，Master 提供）。
> 和「讨论」不同的是这里**没有反爬与限流**（CDN 上的公开文件），
> 真正的风险是「别人改了字段」——所以重点放在**解析容错**而不是重试退避。

- [x] **数据源与降级**（`constants/config`）
  - [x] `WALKTHROUGH_REPO_URL` / `WALKTHROUGH_INDEX_PATH` / `WALKTHROUGH_SOURCES`
  - [x] **两个源逐个降级**：GitHub 原始文件 → jsDelivr 镜像（Master 提供的镜像地址）。
        内容同源，谁先通用谁；全失败才算失败。镜像响应快且带 CORS `*`，
        正好解决国内直连 GitHub 经常超时的问题
  - [x] 单源超时 6 秒自己实现（`AbortSignal.timeout` 在 Hermes 上不可用），
        并把调用方的 `signal` 一并接上（切页签要能取消）
- [x] `features/walkthrough/types.ts` —— 解析**后**的类型（不是 JSON 原样镜像）
- [x] `features/walkthrough/parse.ts` —— 纯函数解析，冒烟直接覆盖
  - [x] 缺字段补默认值、坏条目整条丢弃、未知枚举**原样保留**
        （结局 / 步骤类型可能新增，丢掉等于让攻略凭空少一段）
  - [x] `walkthroughs` 不是数组时抛错 —— 静默当空索引会把「取不到索引」
        说成「这部作品没有攻略」，是最容易说错话的地方
- [x] `features/walkthrough/cache.ts` —— AsyncStorage 落盘
  - [x] **打开即存**（Master 要求）：正文一到就落本地，不必手动点保存；
        「不是所有游戏攻略」由 LRU 兜底 —— 未标记的只留最近 20 篇
  - [x] **钉住（pinned）**：标记过的攻略永不参与淘汰（用户要反复回来对照）；
        `pinned` 只许 false → true，从缓存回填不会把已钉住的降级
  - [x] 缓存**不按时间淘汰**，何时重取交给 React Query 的 `staleTime` ——
        这里只管「有没有一份可用的」，所以断网时索引仍能判断「这篇有没有攻略」
  - [x] ⚠️ **「清空浏览缓存」跳过标记**（`MARKS_PREFIX`）：标记是用户数据，
        清缓存清掉进度会非常意外
- [x] **本地标记**（Master 要求：步骤「已走过 / 重点」+ 结局「已达成」）
  - [x] `features/walkthrough/marks.ts` —— 纯函数操作 + 独立键
        `vnlite.walkthrough_marks.<vid>`（与正文分开存，
        正是为了上一条那个「清缓存不清进度」）
  - [x] `parseMarks` 容错：只认严格 `true`，两个标记都取消后**删键不留空壳**，
        `endings` 去重、坏元素丢弃，非对象输入退化成空标记而不是崩
  - [x] `markStepsDone` 批量标记**不覆盖**已有的「重点」（段落「完成」用）
  - [x] 打第一个标记 → `pinWalkthrough` 把该篇钉住
        （离线看不到正文，标记也就没有意义）
  - [x] ⚠️ **刻意不做孤儿标记清理**：作者重排步骤后旧 id 会失效，那条标记就静静躺着。
        静默删用户数据比留一个看不见的孤儿更糟
  - [x] `features/walkthrough/use-marks.ts` —— 用 React Query 托管
        （切页签重挂不必等异步读取，不会闪一下空进度）；
        `setQueryData` 乐观更新，点一下立刻有反应
  - [x] 组件只吃 `WalkthroughMarkApi` 接口，不关心存储怎么实现
- [x] **标记的交互**（`walkthrough-step-row.tsx`，一行三个互不抢触的点击区）
  - [x] **复选框 = 已走过、星 = 重点、内容 = 剧透遮罩解锁**
        （Master 要求：圆圈会被读成「单选 / 当前项」，而「我走过这一步」是
        逐条勾掉的多选语义，所以必须是方框）
  - [x] **直接用 HeroUI 的 `Checkbox`**（Master 要求），不自研 —— 手搓的版本要自己
        补 hitSlop / 按压反馈 / `role="checkbox"` / `accessibilityState` /
        勾号淡入动画，而 HeroUI 全都自带（受控用法：`isSelected` + `onSelectedChange`）
  - [x] ⚠️ 用受控模式而不是 `defaultSelected`：标记的写入是异步的
        （先改内存、再落盘 AsyncStorage），必须由组件完全持有状态，
        否则关掉再打开会回到初始值
  - [x] 只补 `accessibilityLabel`：库已经自己设了 `role="checkbox"` /
        `aria-checked` / `accessibilityState`，重复传会被它的 `...props` 覆盖
  - [x] 步骤的「已走过」与结局的「已达成」**共用同一个 `Checkbox`** ——
        同屏里两个形状不一样的「勾」会被读成两种东西
  - [x] HeroUI 的 Checkbox **没有 color prop**（只有 `variant` primary/secondary，
        且默认按是否在 surface 上自动选），所以结局「已达成」的语义色
        改由**整行的 success 左边框**承担，不去覆盖库的配色
  - [x] ⚠️ **不打序号**（Master 要求）：攻略是照着走的流程，不是按编号查阅的清单；
        编号占掉一列宽度却不带来信息 —— 「走到哪」由复选框与进度汇总表达
  - [x] `check` 图标仍留在图标集里：它还做 `choice` 步骤类型的图标
  - [x] ⚠️ **不做「整行点一下 = 已走过」**：那会让剧透保护失效 ——
        点内容想看原文，结果把步骤标成走过了
  - [x] 已走过的步骤整行压暗，扫一眼就知道走到哪
  - [x] 未标记的星只留 35% 透明，避免满页实心星
  - [x] 结局行右侧加「已达成」复选框（**独立于展开箭头**），
        达成的整行换语义色左边框
  - [x] **段落级「完成」**：最长的攻略 507 步，逐行打勾不现实；
        每段标题行一个「完成本段（N 步）」，全段已标记时自动变「取消本段完成」
  - [x] 无标题的段不挂「完成」（那类段通常很短，逐行点更省事）
- [x] **进度汇总**（头部）：`结局 x/y`、`步骤 x/y`、`重点 n`，满进度追加 ✓；
      **不受剧透保护影响** —— 自己的进度不是剧透
  - [x] `markProgress` 的总数一律**现算**（攻略更新后步骤会增减，
        用上次的总数会算出超过 100%）；孤立标记不计入分子（否则数字虚高）
  - [x] 有标记时露出「清除本篇标记」
- [x] `features/walkthrough/select.ts` —— 纯展示映射：结局类型 / 步骤类型 →
      文案 + 图标 + 语义色，按 `group` 步骤分段，统计，进度
  - [x] 统计与进度**实际数一遍**，不信任索引里的 `*Count`
        （作者改正文忘了重跑生成脚本时会对不上）
  - [x] `groupSteps` 的 key 取**该段首个步骤 id**：章节名不能当 key
        （全篇都没写 group 时标题都是空串，会撞成一个 key）
- [x] `features/walkthrough/hooks.ts` —— `useWalkthroughIndex` / `useWalkthrough`
      / `useWalkthroughMarks`
  - [x] 两级串起来：索引决定「有没有攻略」，拿到路径才请求正文
  - [x] 网络失败**静默回落**本地缓存（攻略不是关键路径，不值得弹错误页）；
        只有「既没网络又没缓存」才进错误态
  - [x] `retry: false` —— 客户端内部已在源之间降级过，再叠加重试只是拉长等待
  - [x] 标记的 hook 必须排在提前 return **之前**（rules-of-hooks）
- [x] `features/walkthrough/components/walkthrough-tab.tsx` —— 页签主体
  - [x] 三种「没有内容」严格分开：索引加载中 / 确实没攻略 / 请求失败
  - [x] 沿用页签约定：**始终显示**，空内容自己渲染空态并说明「由社区维护，覆盖有限」
- [x] `features/walkthrough/components/walkthrough-routes.tsx` —— **HeroUI `Accordion`** 线路 → 结局 → 步骤
  - [x] **线路用 `Accordion` 而不是手写折叠**（Master 要求；也顺带修好了展开慢）
  - [x] `selectionMode="multiple"`：攻略的常见用法是**对照着看**（开着A 线确认选项、
        翻 B 线的分支），`single` 会强制收起另一条，来回对照要反复点
  - [x] 默认全收起：先给全局概览（有哪些线路、多少结局），再逐层深入
  - [x] `Accordion.Content` 收起时**返回 null**（不是 `display:none`）→
        收起的线路**完全不渲染结局**。这是手写折叠做不到的（手写只能自己判断渲不渲染）
  - [x] ⚠️ `hideSeparator` 必须开：HeroUI 默认在**每对子节点之间**插发丝线，
        而每条线路自带底板，中间夹一条线像渲染错了；且 Root 用 `Children.map`
        把分隔线**穿插**进子节点之间，不藏的话 `gap` 会在「卡片/线/卡片」各留一次、间距翻倍
  - [x] ⚠️ 样式只能挂在子组件上：根组件 `classNames` 只认 `container`/`separator`/`base`，
        没有 trigger / content 槽位（试过直接传 `classNames={{ trigger: … }}` 会编译报错）
  - [x] `Accordion.Indicator` 自带旋转箭头，省掉手写 chevronRight / chevronDown 切换
  - [x] `Accordion.Trigger` 默认 `padding-block` 是 spacing*4（16px），
        十几条线路排下来太松 → 压到 `py-2`，间距交给根容器 `gap-2`
  - [x] 结局默认全部收起，同屏能纵览所有结局名（单个结局最多 507 步）
  - [x] 步骤**只在展开时挂载**，收起的结局零渲染成本
  - [x] **结局也用 `Accordion`**（Master 要求）——**嵌套**在线路那个里面，
        不并成一层：并进去两层的展开状态会混进同一个扁平集合，
        出现「结局开着但线路收起、重开线路时结局还开着」
  - [x] `Accordion.Indicator` 放在 `Item` 下、**不放 Trigger 里** ——
        放进去点箭头会连带触发 Trigger 的展开逻辑
  - [x] 达成条件单独一行（flag / 前置周目是攻略最有价值的部分之一）
  - [x] ⚠️ **HeroUI `Accordion.Trigger` 的 `className` 落在内层 Pressable 上**：
        它渲染成 `Header(View) > Pressable`，`Header` 拿不到 className。
        所以**把 Trigger 放进 `flex-row` 里时，`flex-1` 必须加在外面那层普通 View 上** ——
        否则作为 flex 子节点的是 Header（按内容宽度收缩），
        Trigger 的 `flex-1` 跑到内层去按**高度**伸缩、完全没用，
        表现是「结局名 徽标 ☑ ⌄」后面拖一截空白（Master 反馈的布局问题）
  - [x] 顺带要覆盖 Trigger 的底样式：`flex-direction: row` 会让「结局名 + 达成条件」
        并排、`align-items: center` 让它们水平居中 → 用 `flex-col items-stretch` 改回纵向撑满；
        `p-0` 清掉内边距（外层已经给了 px-3 py-2.5）
  - [x] 线路那边不受影响：`Accordion.Item` 是 column 容器且默认 `align-items: stretch`，
        直接子节点的 Trigger 会自动撑满
  - [x] **长结局分批挂载**（Master 反馈「steps 多的结局展开有明显延迟」）：
        实测最长一篇单个结局 **171 步**（3 个结局 > 100 步），一行里有 1 个
        HeroUI `Checkbox`（内部 3 个 `Animated.createAnimatedComponent` + 3 个 shared value），
        171 行一次提交里建几百个组件与动画节点 → 展开瞬间卡顿
    - [x] 首次只挂 60 行 → 点一下**立刻**展开
    - [x] `InteractionManager.runAfterInteractions` 在动画结束后每次补 60 行
    - [x] ⚠️ 必须 `handle.cancel()`：`Accordion.Content` 收起时整体卸载，
          不取消就会对同一个结局重复排队，展开几次越挂越多
    - [x] 补到 240 行就停，剩下的给「显示更多」按钮 —— 给未来数据兜底
          （现在的最长结局 171 行早就低于此值）
    - [x] ⚠️ **不用 FlashList 虚拟化**：页签的滚动容器是外层 `ScrollView`
          （页头 + 线路 + 结局都在里面），竖向虚拟列表嵌进竖向 ScrollView
          是典型的 nested VirtualizedLists，两个滚动容器会互抢手势
    - [x] `WalkthroughSteps` 自己也包 `memo`：Accordion 根的展开状态一变
          所有 Item 都会重渲染，这里 props 不变就能整体跳过
- [x] `features/walkthrough/components/walkthrough-steps.tsx` +
      `walkthrough-step-row.tsx` —— 步骤列表（行与列表拆开，单文件不至于超 200 行）
  - [x] 复选框 + 类型图标 + 语义色；存档 / 读档必须一眼可辨（错了会毁掉一整周目）
  - [x] `subfix`（存档备注，如「初期」）与 `prefix`（作者的重点标记）都渲染出来
  - [x] 章节标题行用 `bg-separator` 拉一条分隔线，视觉上把长列表切成段
- [x] `features/walkthrough/components/walkthrough-meta.tsx` —— 头部
  - [x] 完整度（`level` 1=详细 / 2=简略）+ 实际统计 + 相对更新时间
  - [x] 渲染作者写的 `tips`（绝大多数就是剧透警告），放在最上面
  - [x] 明示数据来源并可点开仓库 —— 攻略不覆盖全部作品，要说清这是社区数据
- [x] **剧透保护**（Master 要求）
  - [x] `Preferences.spoilerShield` + 设置页「内容显示」的开关（默认关 ——
        用户是主动点开这个页签的）；迁移时只认严格 `true`，脏值一律按关处理
  - [x] `components/spoiler-text.tsx` —— **等长**圆点打码，点一下显示原文
  - [x] ⚠️ 不用遮罩层：遮罩揭开的瞬间行高 / 换行位置全变，一行塌成三行，
        整个列表往下跳，用户刚点开就被甩出去。等长圆点保留字符数，排版基本一致
  - [x] 结局名 / 达成条件 / 步骤内容全部打码（达成条件里的 flag 也是剧透）
- [x] 图标：`icon-glyphs` 补 `check` / `floppyDisk` / `arrowRotateLeft` /
      `route` / `triangleExclamation` / `chevronDown`（Gravity UI，逐字节对照上游 svgs）
- [x] `queryKeys.walkthrough`（含 `marks`）+ `STALE_TIME.walkthrough`（6 小时；
      落盘不再按时间淘汰，重取时机全交给它）
- [x] **长列表性能**（Master 反馈「展开和标记很慢」后定位）
  - [x] 先用真实数据（最大一篇 v810，717 步 / 137KB）实测**纯 JS**：
        `groupSteps` 0.018ms、`markProgress` 0.017ms、`JSON.stringify(marks)` 0.001ms
        → **合计 0.04ms，数据逻辑不是瓶颈**，问题在渲染与存储 I/O
  - [x] 步骤行删掉 4 个**死的** `useThemeColor`（删图标/星标后遗留，但仍被传进 `toneColor`，
        所以 lint 抓不到）：每次渲染少 684 次 CSS 变量订阅抖动
  - [x] `WalkthroughStepRow` 包 `memo` + `use-marks` 的回调全部 `useCallback` 稳定化
        → 打一个勾只重渲染 1 行，不是整段几百行
  - [x] ⚠️ `queryKeys.walkthrough.marks(vid)` **必须 `useMemo` 包住**：
        它每次返回**新数组**，直接当依赖会让上面所有 `useCallback` 白做、
        `memo` 全部失效（这个坑踩过一次）
  - [x] 回调改用 `client.getQueryData(key)` 在调用时读最新值，
        不闭包捕获 `marks`（也不用 ref —— `react/refs` 规则禁止渲染期写 `ref.current`）
  - [x] `pinWalkthrough` 加进程内 `pinnedInSession` 集合：它原本每次调用都要从
        AsyncStorage 读**整篇正文**（最大 137KB）+`JSON.parse`，
        只为了看一眼 `pinned` 是不是 true，而**每次打标记**都会调
  - [x] `groupSteps` 用 `useMemo`（配合行级 memo 才有意义）
  - [ ] 首次挂载 500+ 行仍未虚拟化（要虚拟化得换 `FlashList`，
        会改变滚动行为，暂不做）
- [x] 冒烟新增 17 项（`smoke:api` 第 7 / 8 节）：索引 / 正文的解析容错、
      未知枚举保留、分段 key、统计、打码等长、LRU 淘汰（含**标记过的不淘汰**）、
      标记的取反 / 批量 / 进度（含孤立标记不计入分子），以及**两次真实请求**
      （索引结构 + CLANNAD 全篇步骤形状）
- [x] `smoke:db` 补 `spoilerShield` 的迁移断言
- [x] **Master 手动精简后的现状**（后续改动务必以此为准，别恢复回去）：
  - [x] 步骤行**去掉**类型图标与「重点」星标，只留复选框
  - [x] **去掉**段落级「完成」按钮（`groupSteps` 之外的批量标记）
  - [x] 头部**去掉**完整度 / 统计 / 更新时间 / 数据来源链接 / 进度小段
        （只留作者的 `tips` 与重点计数），相应 props 一并收窄，避免留下死 prop
  - [x] 线路行**去掉**「第 N 条 / 共 M 条」序号与结局计数

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
- [x] **Token 生命周期（Master 规则）**：只有 401 才允许在本地删除 Token，其它
      情况（超时 / 断网 / 5xx）一律保留；另有用户主动退出
  - [x] `restoreSession`：仅在 401（`ApiError.needsAuth`）时走统一入口
        `handleUnauthorized()`（清 Token + 账号缓存 → 游客）；非 401 保留 Token
  - [x] 运行时的 401 同样即时登出：`query/client.ts` 的 `QueryCache` /
        `MutationCache` `onError` 检测到 401 调用 `handleUnauthorized()`，
        不必等下次冷启动
  - [x] 冷启动「缓存账号乐观登录 → authinfo 异步校准」：非 401 失败且有缓存账号
        时维持登录态，避免网络抖动把用户踢成游客
  - [x] `loginWithToken`：换 Token 失败一律还原旧 Token；无旧 Token 时仅 401 清掉
        刚输入的新 Token，超时 / 断网保留
  - [x] `logout` 同时清理 Token 与本地 `account` 缓存，保持登出彻底
  - [x] `loggedInAt` 首次登录时间不再被每次冷启动覆盖

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
    - [x] v1.1.0 模拟器构建 **FINISHED**，产物 31.8 MB —— 说明 prebuild / CocoaPods /
          编译整条 iOS 链路是通的，缺的只是签名凭据
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

---

## Module 5 · 浏览历史

### Type 5.1 · 历史记录数据层

- [x] SQLite 迁移 v4：`history` 表（type / entry_id / title / subtitle / image_url /
      viewed_at，唯一索引 `(type, entry_id)`）
- [x] `lib/db/dao/history.ts` —— recordView / getHistoryPage / getHistoryCount /
      clearHistory / deleteHistoryEntry
  - [x] 查询接口按**类型集合**工作（`IN (?, ?)`），「人员」档 = 角色 + 制作人员
  - [x] 唯一索引兜住去重：重复浏览同一条只更新 `viewed_at`，不新增行
- [x] `features/history/hooks.ts` —— **走 React Query**（与项目其它数据层一致，
      不手写 `useEffect + setState`）：`useRecordHistory` / `useHistoryInfinite` /
      `useHistoryCount` / `useClearHistory` / `useRemoveHistoryEntry`
- [x] `queryKeys.history`（list / count，按展示档位分段）

### Type 5.2 · 历史记录页面

- [x] `features/history/history-screen.tsx` —— 顶部 `SegmentedControl` 切四档 +
      **FlashList** 分页（触底自动加载）+ 空/错误态
- [x] Header（`BackBar` 右侧 `trailing`）常驻三个操作：
  - [x] **日期筛选**：图标按钮（`calendar` 日历图标）打开 `TimeRangePanel`
  - [x] **视图切换**（仅作品档）：复用 `ViewModeButton`
  - [x] **清空**：HeroUI `Button isIconOnly`，**常显**（Master 要求）
- [x] **清空二次确认走项目自己的 `AppDialog`**，不用系统 `Alert`（Master 要求）
- [x] **清空弹窗支持勾选分类**（Master 要求）：多选「作品 / 人员 / 用户 / 厂商」，
      默认全选，未勾任何一项时「清空」按钮禁用
- [x] `features/history/components/history-item.tsx` —— 行组件
      （封面/头像 + 标题 + 原名 + 相对时间；无图条目用时钟图标兜底）；
      点进详情页，长按删除单条
- [x] `features/history/components/history-list.tsx` —— 集合视图：
      **作品档支持网格 / 列表切换**（网格复用 `VnCoverGrid`，存 `preferences.vnViewMode`）
- [x] `features/history/components/time-range-panel.tsx` —— **日期筛选面板**
      （复用 `FullScreenPanel` + `FilterGroup` / `FilterChip`）：
      **自定义开始 / 结束日期**（Master 要求，不能只给固定时间段），
      上面一排「全部 / 今天 / 近 7 天 / 近 30 天」只是快速填日期的捷径；
      草稿在面板内，点「应用」才生效，未填满 / 无效 / 顺序错误挡住
- [x] `features/history/components/date-otp-field.tsx` —— **`InputOTP` 日期输入**
      （Master 要求）：8 位数字 `YYYYMMDD` 数字键盘逐位输入，**不用手敲 `-`**；
      年月日三组用 `InputOTP.Separator` 分隔；槽位用 `style` 收窄以适配手机宽度
- [x] `history-constants` 日期筛选纯函数：`presetDateFilter`（快捷 → 具体日期）、
      `isoToDigits` / `digitsToIso`（OTP 数字串 ↔ ISO）、
      `dateDigitsRangeErrors`（位数 / 有效性 / 顺序校验）、
      `dateFilterBounds`（→ 时间上下界，**含首尾整天**）
- [x] `utils/format#formatRelativeTime` —— 刚刚 / 分钟 / 小时 / 天 / 日期（纯函数）
- [x] 路由 `app/history.tsx`
- [x] 「我的」页添加入口（`clockArrowRotateLeft` 历史图标）

### Type 5.3 · 详情页接入

- [x] VN 详情页调用 `useRecordHistory`
- [x] 角色 / 厂商 / staff 详情页调用 `useRecordHistory`
- [x] 用户详情页调用 `useRecordHistory`

### Type 5.4 · 质量

- [x] 冒烟测试：history DAO 的 CRUD + 分页 + 去重 + 「人员」档聚合 + 空集合短路 +
      日期上下界过滤；`formatRelativeTime` / `presetDateFilter` / `isoToDigits` /
      `digitsToIso` / `dateDigitsRangeErrors` / `dateFilterBounds` 的纯逻辑

---

## Module 6 · 游戏计时

### Type 6.1 · 全局计时状态

- [x] `features/game-timer/store.ts` —— 模块级单例 + 订阅者（与 `preferences` /
      `session` 同一套 `useSyncExternalStore` 模式），**跨页面常驻**，不随路由卸载
  - [x] 用「本段起点 `segmentStartedAt` + 已累计 `accumulatedMs`」表达耗时，
        后台 / 掉帧 / 卡顿都不掉时间；另存 `sessionStartedAt` 作为会话落记录的起点
  - [x] 全局**同时只有一个**计时器；动作 start / pause / resume / togglePause / stop
  - [x] 状态带作品名与封面（`coverUrl`，通知大图用）；
        `stopGameTimer` 返回本次会话成果（起止 + 实际时长）供落库；
        `sanitizeGameTimer` 兜底持久化脏数据
- [x] `features/game-timer/persistence.ts` —— 计时状态持久化到 AsyncStorage，
      **冷启动按时间戳恢复**：后台 / 杀进程期间也一直在计（Master 要求「后台运行」）
  - [x] 与 store 分离，store 保持纯净可被 bun 冒烟直接 import
  - [x] 水合期间用户已点「开始游戏」则不覆盖
- [x] `features/game-timer/hooks.ts` —— `useGameTimer`（只随动作变化）+
      `useElapsedMs`（运行中由独立秒级时钟源驱动，暂停 / 空闲时定时器自动停）
- [x] `features/game-timer/format.ts` —— `formatGameDuration`：毫秒 → `HH:MM:SS`（含秒）
- [x] 图标 `play` / `pause` / `stop`（Gravity UI）

### Type 6.2 · 详情页入口

- [x] VN 详情页新增「开始游戏」按钮（`components/start-game-button.tsx`），
      位于三列概览下方
  - [x] 全局唯一计时器：空闲 → 开始；本作运行中 → 置灰「计时中」；
        本作暂停 → 「继续游戏」；其他作品计时中 → 置灰提示

### Type 6.3 · 全局浮层

- [x] `features/game-timer/components/game-timer-overlay.tsx` —— 挂在根布局
      （`app/_layout.tsx` 的 `Stack` 之后），跨页面盖在最上层
  - [x] 默认圆形显示 `HH:MM:SS`；点一下额外展开「暂停 / 继续」与「结束」按钮
  - [x] **可拖动**（Master 要求）：gesture-handler 的 `Pan` + `Tap` 用 `Race` 组合
        （拖了就拖、没拖就点），位置夹在屏幕安全区内；操作按钮行随圆形一起移动
  - [x] 暂停时圆形转中性色；外层 `pointerEvents="box-none"`，不吃底层触摸
  - [x] 点「结束」→ 落一条游玩记录并失效记录页签
- [x] 样式全部走 uniwind + HeroUI token

### Type 6.5 · 游玩记录（详情页「记录」页签）

- [x] SQLite 迁移 v5：`play_session` 表（vn_id / started_at / ended_at / duration_ms + `vn_id, started_at DESC` 索引）
- [x] `lib/db/dao/play-session.ts` —— insert / getPlaySessions / delete / clear
- [x] `features/play-records/play-stats.ts` —— 纯函数：`summarizeSessions`
      （总时长 / 次数 / 平均 / 最长 / 最近）+ `weeksOfMonth` / `weeklyBuckets`
      （按**实际月长**切周：1-7 / 8-14 / … 收月末）+ `monthTotalMs` / `monthSessionCount` /
      `currentWeekIndex` / `currentYearMonth`
- [x] `features/play-records/format.ts` —— `formatPlayDuration`（`1 小时 24 分`）/
      `formatPlayDurationShort`（统计块 `1.5 h`）/ 日期、`HH:MM` 时间、`YYYY 年 M 月`
- [x] `features/play-records/hooks.ts` —— `usePlaySessions`（本地查询）
- [x] `features/play-records/components/play-records-tab.tsx` —— 「图表 / 列表」两视图
      （`SegmentedControl` 切换）
  - [x] 图表视图：四块统计（总时长 / 次数 / 平均每次 / 最长一次）+ 按月按周的
        **手绘竖条**（Master 嫌 chart-kit 丑后重做）：读数在柱顶、日期范围在柱底、
        今天所在周满色高亮、其余周半透明；顶部圆钮切换年月 + 本月合计
        （配色 / 圆角 / 间距全走主题 token 与 uniwind，与「厂商 Top」横条同一思路）
  - [x] 列表视图：每次游玩的日期、起止时间与时长
- [x] VN 详情页页签表新增「记录」

### Type 6.6 · 系统通知（锁屏可见）

- [x] 引入 `@notifee/react-native`（原生模块，需 EAS 开发构建；Expo Go 不支持）
- [x] `features/game-timer/notification.ts` —— 常驻通知：封面大图 + 游戏名称 +
      计时（`HH:MM:SS`）+「暂停 / 继续」「结束」按钮；`visibility: PUBLIC` 锁屏可见；
      计时中每秒刷新，暂停 / 空闲时停刷新；按钮走 store 动作
- [x] `features/game-timer/actions.ts` —— 共享 `finishGameTimer`（停计时 → 落记录 → 失效），
      浮层与通知按钮共用

### Type 6.7 · 系统悬浮球（跨 App 悬浮）

- [x] 引入 `react-native-android-overlay`（原生模块，需 EAS 开发构建；Android only）
- [x] `features/game-timer/overlay-window.ts` —— 计时开始即显示、结束即收起；
      动态 `import` + try/catch，未链接（Expo Go / iOS）时静默降级
- [x] `features/game-timer/components/overlay-window-view.tsx` —— 悬浮球里渲染的组件：
      独立 AppRegistry 根、不依赖 HeroUI/Theme Provider，配色自取主题 token
- [x] 自定义入口 `index.js`：先引 `expo-router/entry`，再 `AppRegistry.registerComponent`
      注册「GameTimerOverlayWindow」；`package.json` 的 `main` 指向它

### Type 6.4 · 质量

- [x] 冒烟测试：`formatGameDuration` 的时分秒 / 小时不封顶；
      start / pause / resume / stop 状态流转、暂停冻结、`stopGameTimer` 成果、
      `sanitizeGameTimer` 脏数据兜底；`play_session` DAO 的写 / 查 / 删（验证 v5 迁移）；
      `formatPlayDuration` / `summarizeSessions` / `weeklyBuckets` / `monthTotalMs` 的纯逻辑
