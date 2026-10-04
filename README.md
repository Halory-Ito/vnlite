# vnlite

[VNDB](https://vndb.org/) 的**非官方第三方移动客户端**。查作品、看角色与staff、翻发行版与截图、读语录与讨论帖、追社区攻略、管理自己的收藏清单 —— 都在App 内完成，不用跳浏览器。

> vnlite 与 VNDB 无关。数据来自 [VNDB Kana API](https://api.vndb.org/kana) 与 vndb.org，遵循 [VNDB Data License](https://vndb.org/data)。

---

## 功能

底部五个主 Tab：**首页 / 浏览 / 搜索 / 清单 / 我的**

### 首页

- **每日语录** —— 每天固定一条（同一天内不变，杀进程重开还是那条）
- **信息流三档** —— 即将发售 / 最新发售 / 最新评价
- **数据库统计** —— VNDB 全库条目数与近期增长曲线
- 卡片上的**摇一摇**换一个作品

### 浏览

- 七档筛选：标签与特性、厂商与社团、原语言、平台、时长、开发状态、评分区间
- 四种排序：人气 / 评分 / 发售日期 / ID 升序
- 卡片可自选显示哪些信息（评分、日期、平台…），**网格 / 列表**双视图
- 无限翻页，每页条数可调（25 / 50 / 100）

### 搜索

四档范围：**作品 / 制作人员 / 用户 / 厂商**。厂商会按类型（publisher / developer / brand…）标注。

> VNDB 的 `/user` 端点不支持模糊搜索，用户只能按用户名精确匹配 —— 这是 API 的硬限制，搜索页会明确说明。

### 作品详情

十个页签：**概览 / 角色 / 制作 / 版本 / 截图 / 关联 / 语录 / 讨论 / 攻略 / 外链**

- **角色**按定位分档（主角 / 主要 / 次要 / 登场）
- **制作**区分职务与配音，可点进 staff 详情
- **版本**列出所有发行版，含平台、地区与持有状态
- **讨论**直接在App 内读帖子与楼层（抓取 vndb.org 的网页）
- **攻略**见下方专节
- 顶部三列概览（评价人数 / 均分 / 游玩时长）+ 值 chip 行；简介默认折叠，标签默认只显示 12 个

角色、厂商、staff、标签、用户各有自己的详情页；讨论帖、用户资料、用户评价都在App 内读完。

### 清单

- 与 VNDB 账号**直读直写**，不经过本地镜像（架构调整后清单数据一律不落本地库）
- 游玩状态、打分、标签；条目可单独编辑
- 收藏统计：总数、已通关、均分、游戏类型分布
- 网格 / 列表视图与排序偏好会记住

### 我的

主题与外观、内容显示（成人内容档位 / 剧透保护 / 每页条数）、账号、关于。

- **四套主题**：Fate / Stay Night、Gekkou No Carnevale、Seinarukana、Little Busters!
- 背景图可自定义，**遮罩不透明度（0–1 连续）与模糊半径可调** —— 保证文字对比度不靠描边
- 明暗三态（跟随系统 / 亮 / 暗），改完即生效
- 长按文字全局可选中复制；点得动的一层（列表行、站内链接）走「长按整条复制」

---

## 攻略

作品详情页的「攻略」页签，数据来自独立仓库 [`Halory-Ito/vnlite-walkthrough-and-guide`](https://github.com/Halory-Ito/vnlite-walkthrough-and-guide) 的静态 JSON —— Kana API 没有攻略端点。

- 结构是 **线路 → 结局 → 步骤**，两层都可折叠，默认全收起
- 结局类型（真结局 / 好结局 / 普通结局 / bad 结局）以徽标标注，「达成条件」单独一行
- **本地标记**：步骤「已走过」逐条打勾，结局「已达成」单独勾选，头部显示进度
  - 标记存在独立键里，**「清空浏览缓存」不会误删进度**
  - 标记过的攻略会钉住，不参与 LRU 淘汰
- **剧透保护**（设置里开关，默认关）：开启后结局名、达成条件、步骤内容按等长圆点打码，点一下显示原文
- 网络失败静默回落到本地副本，断网时仍能判断某作品有没有攻略

> 攻略索引目前覆盖 484 部作品，**不是全量**。内容由社区贡献，重要 flag 请以实际游戏为准。

---

## 数据来源

| 内容                                                   | 来源               | 说明                |
| ------------------------------------------------------ | ------------------ | ------------------- |
| 作品 / 角色 / 厂商 / staff / 标签 / 语录 / 用户 / 清单 | VNDB Kana API      | 主力数据源          |
| 讨论帖、用户资料、用户评价                             | 抓取 vndb.org 网页 | Kana API 无对应端点 |
| 攻略                                                   | 独立静态 JSON 仓库 | Kana API 无攻略端点 |

抓网页的部分是「官网改版就会挂」的脆弱方案 —— 项目用冒烟测试把当前 HTML 结构卡住，结构一变就会红。

---

## 开发

技术栈：Expo SDK 57 · React Native 0.86 · React 19 · [Expo Router](https://docs.expo.dev/router/introduction) · [HeroUI Native](https://heroui.com/docs/native) · [Uniwind](https://docs.uniwind.dev)（Tailwind CSS for RN）· TypeScript 严格模式

```bash
bun install
bun start
```

### 脚本

| 命令                              | 作用                                                   |
| --------------------------------- | ------------------------------------------------------ |
| `bun run check`                   | **一键质量门禁**：typecheck + lint + format + 三个冒烟 |
| `bun run typecheck`               | `tsc --noEmit`                                         |
| `bun run lint` / `bun run format` | oxlint / oxfmt                                         |
| `bun run smoke:api`               | 打真实接口与真实网页的冒烟（83 项）                    |
| `bun run smoke:theme`             | 主题色对比度检查（选中态文字不得撞色）                 |
| `bun run smoke:db`                | 本地库与偏好迁移（28 项）                              |
| `bun run bundle:check`            | 导出一次产物，确认能打包                               |

> `smoke:api` 会打**真实**的 VNDB 接口与网站，并跑两次真实攻略仓库请求。改解析逻辑后必须跑 —— 编译期类型只能保证「字段名合法」，真正的合法性要打真实数据才知道。

### 目录结构

```
src/
  app/            路由（expo-router 文件式，页面只做 re-export）
  features/       业务模块（feature-first）
    vn/           作品详情与其十个页签
    walkthrough/  攻略页签
    browse/ catalog/ discussion/ review/ user/ search/
    ulist/ stats/ home/ settings/ sort/
  components/     跨模块共用组件
  lib/            api（Kana 封装）/ query / db / storage / scrape
  theme/          主题种子与派生 token
  hooks/ utils/ constants/ types/
```

### 构建

Android 用 [EAS](https://docs.expo.dev/build/introduction/)，并通过 config plugin `plugins/with-android-abi-splits.js` 做 ABI 分包 —— `eas.json` 的 schema 里**没有** `splits` 字段（实测 `"build.preview.android.splits" is not allowed`），只能在 prebuild 之后往 `app/build.gradle` 注入。

```bash
eas build -p android --profile preview     # APK，分 4 个架构包 + universal
```

iOS 真机包需要 Apple 开发者凭据；无证书时只能出模拟器包（`--profile preview-simulator`）。

版本号从 `app.json` 读取，「关于」页不再手写。

---

## 许可与致谢

- 图标：[Gravity UI Icons](https://gravity-ui.com/icons)（MIT）
- 数据：[VNDB](https://vndb.org/) 及其社区，遵循 VNDB Data License
- 本项目为非官方客户端，与 VNDB 及其运营方无关
