# 待修复 / 待优化

> 勾选表示已完成。验证方式见每条括号。

## 首页

- [x] 移除底部的「高分佳作」板块
- [x] 「随机一部」卡片移除 Card.Title
- [x] 移除「标题」排序（VN 译名有多个别名，按字面排序无意义）
- [x] 移除「最新上架」板块（和「浏览 · 按发售时间」重复）
      （连同 `features/vn/components/LatestCard.tsx` 一起删掉；`features/vn/hooks.ts#useVnCards` 随之无人引用，见「待定」）
- [x] 「随机一部」改成真随机，不再维护固定 id 池
      （Kana 没有 `random` 排序：取最大 id（会话级缓存）→ 随机号段 → `["id", ">=", "vN"]` 拿最近的一条，见 `lib/api/endpoints/vn.ts#queryRandomVn`）
- [x] 封面加载不再被压到最低优先级
      （`CoverImage` 默认 `priority` 从 `low` 提到 `normal`；原生没有 lazy/eager，`priority` 才是对应物，`loading="eager"` 只对 web 生效）
- [x] 随机语录 / 随机一部加载时显示**骨架屏**（HeroUI `Skeleton`）
      （原来语录是「一片空白 → 突然冒出卡片」，随机一部是一个灰方块；现在都按真实卡片结构占位）

## 浏览

- [x] 筛选面板设置最大高度
      （`max-h-[85%]` 百分比对 auto 高度的绝对定位容器无效 → 改用 `useWindowDimensions` 算绝对像素）
- [x] 筛选面板底部多余 margin
      （`BottomSheet.Content` 自带 padding，我又加了 `pb-6` → 去掉）
- [x] 点击「浏览」后无法切换其他 Tab
      （`FlashList` 缺 `flex-1`，按内容高度撑开后溢出盖住 Tab 栏，吃掉触摸事件）
- [x] 卡片信息可选择性显示：独立的「卡片显示」面板
      （入口在浏览页头部、**筛选按钮左边**，图标 `eye` + 「显示」；改过显示项时按钮转强调色。
      面板内容：评分 / 发售日期 / 原语言 / 时长 / 平台 / 开发状态；存 `preferences.cardFields`，
      与筛选无关、跨启动记住。顺带发现列表字段集里没有 `devstatus`，卡片上的「开发中」徽标从来没显示过 —— 已补上）
- [x] `browse/components/Panel` —— 全屏面板外壳抽出来，筛选面板与卡片显示面板共用
      （仍是「无 Portal 的 absoluteFill 覆盖层」，规避 PortalHost 吃触摸的坑）
- [x] 列表封面 / 角色头像改用 `image.thumbnail`（256×362，几 KB），详情页大图仍用原图

## 筛选面板交互

- [x] 点击 option 时 active 效果不立即显示
      （根因：所有 ChipGroup 的 `selected` 读的是已提交的 `value` 而非草稿 `draft`）
- [x] 打开面板时草稿状态不同步
      （`useState(value)` 只捕获首次挂载的值；改用 React 官方的「渲染期调整 state」模式）

## 游戏详情页

- [x] 角色区分主要 / 次要角色（Tabs）
- [x] 主要信息用 Tabs 区分（概览 / 角色 / 制作 / 版本）
      （只渲染当前页签；角色与版本的数据切到页签才请求，不点不花限流配额）
- [x] 角色定位细分为四档：主角 / 主要角色 / 次要角色 / 登场（带计数）
      （先前的「主要 / 次要」是**假分档**：`/character` 的字段列表里没有 `vns.role`，拿不到定位 → 全落进「主要」。
      现在补上 `vns{id,role}`，并修掉枚举里的 `background` —— Kana 只有 `main` / `primary` / `side` / `appears`。
      实测弹丸论破 v7014：1 / 16 / 2 / 4）
- [x] 概览页简介 / 标签**默认折叠**
      （简介 6 行 + 「展开全部」，用 `onTextLayout` 判断是否真被截断，短简介不挂按钮；标签先显示 12 个）
- [x] 多语言作品的语言用 chip 表示
      （原来挤成「日语 · 英语 · 中文」一行；现在 chip 一眼可数，原始语言用 accent 标出）
- [x] 截图列表优先出缩略图
      （`screenshots.thumbnail` 136×102 当 `placeholder` 先铺上，高清图随后盖上来；查看器里加载原图）
- [x] **修复：角色列表整个加载失败**
      （上一轮给 `/character` 的字段集里加了 `image.thumbnail` —— `/vn` 的 image 有 `thumbnail`，
      `/character` 的**没有**，直接 `400 Field 'thumbnail' not found`，切到角色页签就是一片错误。
      已移除，并补了一条冒烟：`queryCharactersByVn 字段集合法（含 vns.role）`，
      真请求跑一遍，字段集的坑以后不会再漏到线上）
- [x] 角色详情页「特性」默认只显示 12 个 + 「展开全部 N 个」
      （VNDB 的角色特性常有 40–70 条，一屏铺满 chip 反而看不到简介）
- [x] ⚠️ **修复：角色详情页「简介下方的部分无法显示」**
      （根因不是布局：`queryVnsByCharacter` 把 `/character` 的 `vn` 过滤器用在了 `/vn` 上 →
      `400 Invalid 'vn' filter: Unknown field`，「登场作品」那一块直接进错误态。
      改用已有的 `vnWithCharacter`，并补了真请求冒烟 `queryVnsByCharacter 用对了过滤器`）
- [x] 角色 / 制作者 / staff / 标签 四个详情页的简介（说明）统一改成**默认折叠 6 行**
      （长简介会把页面撑得极长，下面的内容要滚很久）

## 主题

- [x] 主题切换时看不见背景图片
      （各页面根节点是不透明的 `bg-background`，把背景图全盖住；底色改由 `ThemeShell` 提供）
- [x] 底部 Tabs 栏样式未适配
      （react-navigation 不读 Uniwind 的 CSS 变量，必须显式传 `tabBarStyle` / tint 颜色）
- [x] 页面跳转时的加载页样式未适配
      （给 `Stack` 显式传 `contentStyle.backgroundColor`）
- [x] 详情页 Tabs 文字未适配
      （已确认 `-soft` 变体是 `color-mix(... var(--accent) ...)`，会随原始 token 自动联动）
- [x] Tabs 选中态「active 与 Tab 底色 / 字体颜色重复」 （三个问题叠在一起：① `--segment`（选中块）从 `--default` 只混 20% accent，暗色主题下通道差只有 22 → 提到 30%，
      并对「推亮后配黑字白字都不达标」的主题按需退让；② `--segment-foreground`（选中文字）与 `--muted`（未选中文字）
      在灰调主题里算成同一个颜色（Gekkou No Carnevale 暗色下都是 `#848484`）→ 新增 ≥1.5:1 区分度约束；
      ③ 详情页那 7 个页签**从来没挂 `Tabs.Indicator`**（HeroUI 不自动注入）→ 补上。
      冒烟新增「选中 / 未选中文字不能撞色」，选中块与列表底色差阈值 10 → 25）
- [ ] **真机验证**：切主题时看「背景图 / 底部 Tab 选中态 / 详情页 Tabs 选中块」是否都跟着变
      （原来靠「外观」页的诊断读数判断，读数已按决定删除 —— 现在直接目视；
      背景图看不见 = 图层遮挡，颜色不变 = `ScopedVariables` 没生效。**待 Master 在设备上确认。**）

## 其他

- [x] 报错 `Text strings must be rendered within a <Text> component`
      （裸字符串直接放在 `Card.Footer` 这个 View 里，根因在 `LatestCard.tsx`）
- [x] Safe Area 未处理好，顶部与刘海重叠
- [x] 首页多余的 subtitle
- [x] 「随机一部」作品与按钮之间要有间距
- [x] `(tabs)/_layout.tsx` 里 `ACTIVE_PILL_RADIUS` 未引用的 const 已删掉
      （连带修正注释里「药丸靠 `tabBarItemStyle` 撑出来」的说法 —— 实际上并没有挂那个 style，是句过期的描述）
- [ ] 「我的」页列表容器观感偏松：HeroUI `ListGroup` 根被 `surface__root` 的 16pt padding 撑开
      （`list-group__root { padding: 0 }` 被 CSS 顺序盖掉）→ 待真机确认是否 `p-0` 或换自绘容器

## 我的 / 设置

- [x] 「我的」改成传统列表：顶部用户信息 + item 列表，设置项拆成二级页
      （`/settings/appearance`（明暗 / 主题 / 背景图）、`/settings/content`（成人内容 / 每页条数）、
      `/settings/account`（Token 登录 / 退出）、`/settings/about`；详见 plan.md「Type 4.3 · 设置信息架构」）
- [x] 「我的」首页移除二级内容（调试读数挪进「外观」页，后又按 Master 决定删除；存储说明 / 示例作品链接删除）
- [x] 清空缓存补上反馈（HeroUI `useToast`，原来点完没有任何提示）
- [x] 图标走内置封装 `components/Icon`（Gravity UI Icons），**全项目迁移已完成**
      （`@gravity-ui/icons` 只导出渲染原生 `<svg>` 的 Web 组件，RN 用不了 → 内置 19 个 SVG 源码 + `react-native-svg` 的 `SvgXml`；
      Tab 栏 / 返回箭头 / 首页入口 / 筛选 / 外链全部换完，`@expo/vector-icons` 已从依赖移除，bundle 6.7 MB → 6.3 MB）

## 图片查看器

- [x] 新增全屏查看器 `components/ImageViewer`（第三方 `react-native-zoom-toolkit`：纯 JS，不用 prebuild，Expo Go 可跑）
      （双指缩放 / 双击放大 / 拖动平移 / 左右滑换图 / 上下滑关闭 / 顶部 `i / n` + 关闭按钮吃安全区；
      组件不持状态，`index === null` 即关闭，封面与截图墙共用一个）
- [x] NSFW 策略与 `CoverImage` 一致（`hide` 不渲染，`blur` 糊住 + 点一下放行；双击留给缩放）
- [x] **修复：查看器一片空白加载不出图**
      （两个原因：① `GalleryItem` 的内层容器是**按内容量尺寸**的，子元素写 `w-full/h-full` 会量出 0 ——
      改用库导出的 `fitContainer(比例, 窗口)` 显式给像素尺寸，比例取 API 的 `dims`；
      ② 原生 `Modal` 是另一棵根视图，手势库拿不到 App 根部那个 `GestureHandlerRootView` —— Modal 内补一层）
- [x] 高清图只在当前这张按原分辨率解码（`allowDownscaling`），左右相邻的降采样省内存
- [x] 接入点：VN 详情页封面、截图页签
      （`CoverImage` 新增 `onPress`，双击切敏感内容的既有交互不变）
- [x] 列表封面也接查看器：`VnInfiniteList`（浏览 / 搜索 / 标签等所有大列表）、
      角色详情页的「相关作品」、首页「随机一部」
      （查看器挂在列表那一层，整页只用一个 Modal，不受 FlashList 回收影响）
- [ ] **真机验证**：双指缩放 / 左右滑换图 / 上下滑关闭 / Android 返回键与手势冲突
      （返回键已挂 `onRequestClose`，但滑动手势只能上设备看）
- [ ] 查看器底色：现在跟随主题 `background`，是否改「固定深色底」待定

## 待定（需要 Master 拍板）

- [x] `useVnCards` / `queryVnCards` / `VN_CARD_FIELDS` —— 按决定**已删掉**
      （冒烟里原来那条 `queryVnCards` 检查换成了 `queryRandomVn`，正好补上随机接口的覆盖）
- [x] 「外观」页底部的「当前主题」诊断读数 —— 按决定**已删掉**
      （`features/settings/components/ThemeDebugReadout.tsx` 一并删除；真机验证改为目视：切主题看背景图与各处选中态）

## M4 待办（按规划，非本轮）

- [ ] 主题包扩充（当前 11 套来自 vndb-lite，可再补）
- [ ] 用户自定义背景图（`backgroundUrl` 字段已预留，设置页未开放入口）
- [ ] 统计图表（`react-native-chart-kit` 已装未用）
- [ ] 清单写入 + 乐观更新（依赖 M2 用户数据层）
