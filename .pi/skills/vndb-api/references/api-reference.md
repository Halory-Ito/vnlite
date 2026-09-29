# VNDB Kana API 完整参考

数据来源：`https://api.vndb.org/kana` 官方文档 + `GET /schema` 实时内省（2026-09 实测）。
本文件中的字段名、枚举值均来自 `/schema`，为权威值。过滤器清单来自官方文档。

- 正式环境：`https://api.vndb.org/kana`
- 测试环境：`https://beta.vndb.org/api/kana`
- 旧版 TCP API（已废弃，勿用）：`api.vndb.org:19534`

---

## 1. 速率限制与使用条款

| 限制       | 值                |
| ---------- | ----------------- |
| 请求数     | 每 5 分钟 200 次  |
| CPU 时间   | 每分钟 1 秒       |
| 单请求上限 | 超过 3 秒会被中止 |

- 免费、非商业用途，best-effort 提供。
- 数据处理受 VNDB Data License 约束（https://vndb.org/d17#4）。
- 超限返回 `429`。
- **官方有意不暴露的功能**：论坛、数据库编辑（改条目内容）、注册账号。
  因此"修改操作"仅限于**用户自己的清单（list）**，不能改 VN 条目本身。

---

## 2. 认证

两种方式：

1. **Cookie**：仅用于 vndb.org 站点内的脚本（需 `credentials: 'include'`）。
2. **Token**（命令行/外部程序用这个）：

```
Authorization: Token xxxx-xxxxx-xxxxx-xxxx-xxxxx-xxxxx-xxxx
```

Token 在 https://vndb.org/u/tokens 创建（My Profile → Applications）。

**权限（permissions）**：

| 权限        | 含义                                            |
| ----------- | ----------------------------------------------- |
| `listread`  | 读取**私有**标签和清单条目                      |
| `listwrite` | 写入 VN 清单（PATCH/DELETE `/ulist`、`/rlist`） |

无效 token → `401`。用 `GET /authinfo` 验证 token 及其权限。

Token 字符串形如 z-base-32，短横线可省略；本 skill 的脚本会自动处理。

---

## 3. 查询模型（POST 端点通用）

所有数据库查询都是 `POST`，body 为 JSON：

```json
{
  "filters": [],
  "fields": "id,title",
  "sort": "id",
  "reverse": false,
  "results": 10,
  "page": 1,
  "user": null,
  "count": false,
  "compact_filters": false,
  "normalized_filters": false
}
```

| 成员                 | 类型                | 默认    | 说明                                         |
| -------------------- | ------------------- | ------- | -------------------------------------------- |
| `filters`            | Array/Object/String | `[]`    | 决定抓取哪些条目，见下                       |
| `fields`             | String              | `""`    | 逗号分隔的字段列表；顶层 `id` 始终返回       |
| `sort`               | String              | `"id"`  | 排序字段，取值随端点而异                     |
| `reverse`            | Boolean             | `false` | `true` 为降序                                |
| `results`            | Integer             | `10`    | 每页条数，**最大 100**，可为 0               |
| `page`               | Integer             | `1`     | 页码，从 1 开始                              |
| `user`               | String              | `null`  | 用户 ID（`/ulist` 必需，`label` 过滤器也用） |
| `count`              | Boolean             | `false` | 是否返回匹配总数（**性能开销大**）           |
| `compact_filters`    | Boolean             | `false` | 返回过滤器的紧凑字符串表示                   |
| `normalized_filters` | Boolean             | `false` | 返回规范化后的过滤器 JSON                    |

**响应**：

```json
{ "results": [], "more": false, "count": 1 }
```

- `more: true` → 增大 `page` 可取下一页。
- `count` 仅在请求时为 true 才出现。

---

## 4. 过滤器（Filters）

### 4.1 基本语法

**简单谓词** —— 三元数组 `[字段名, 运算符, 值]`：

```json
["id", "=", "v17"]
["rating", ">=", 80]
["released", ">", "2020-01-01"]
```

**运算符**：所有过滤器支持 `=` 和 `!=`；文档标注可排序（flag `o`）的还支持 `>=`、`>`、`<=`、`<`。

**组合谓词**：

```json
["and", ["olang","=","ja"], ["rating",">=",80]]
["or",  ["id","=","v17"], ["id","=","v11"]]
```

首元素为 `"and"` 或 `"or"`，后面跟**两个或更多**谓词。可嵌套。
单请求谓词总数上限 **1000**。

### 4.2 ⚠️ 嵌套过滤器（最容易踩的坑）

某些过滤器的值**不是标量，而是另一个谓词**。写成 `["vn","=","v17"]` 会返回
`400 Invalid 'filters' member`。

| 端点         | 嵌套过滤器                                   | 值应为   |
| ------------ | -------------------------------------------- | -------- |
| `/vn`        | `release`, `character`, `staff`, `developer` | 谓词数组 |
| `/release`   | `vn`, `producer`                             | 谓词数组 |
| `/character` | `vn`, `seiyuu`                               | 谓词数组 |
| `/quote`     | `vn`, `character`                            | 谓词数组 |

正确写法：

```json
["vn", "=", ["id", "=", "v17"]]
["vn", "=", ["released", ">=", "2010"]]
["producer", "=", ["id", "=", "p24"]]
```

配合脚本的**点号简写**更省事（外层运算符固定为 `=`）：

```bash
vndb.py release -f 'vn.id=v17'
vndb.py release -f 'vn.released>=2010'
vndb.py character -f 'vn.id=v17' -f 'role=main'
```

### 4.3 元组型过滤器

`tag` / `dtag` 接受纯 ID，或 `[tag_id, max_spoiler(0-2), min_tag_level(0-3)]`：

```bash
vndb.py vn --filter-json '["tag","=",[105,1,0]]'
```

`label` 接受 `[user_id, label_id]`；已认证或已设置 `user` 时可只给 label id：

```bash
vndb.py ulist -u u2 -f 'label=2'
```

`extlink` 有三种形式：站点名 `["extlink","=","steam"]`、`[站点名, 远程ID]`、或完整 URL。

### 4.4 紧凑过滤器字符串

与网站高级搜索 URL 共用的紧凑表示，也可直接作为 `filters` 的值。
用 `compact_filters: true` 让 API 回传该字符串。脚本支持 `--compact-filters`。

### 4.5 过滤器标志（flag）

| 标志 | 含义                                     |
| ---- | ---------------------------------------- |
| `o`  | 支持排序运算符（`>` `<` `>=` `<=`）      |
| `n`  | 接受 `null` 作为值                       |
| `m`  | 单条目可匹配多个值                       |
| `i`  | 取反与「补集」不等价（通常意味额外约束） |

---

## 5. 字段选择（fields）

- 逗号分隔，**不支持通配符**；顶层 `id` 始终返回。
- **点号**取嵌套字段：`image.url`
- **花括号**取子对象（可配合点号混用）：`image{id,url,dims}`、`labels{id,label}`
- 括号可嵌套：`vn{id,title,image{url}}`

```bash
vndb.py vn -f 'id=v17' -F 'id,title,image.url,titles{lang,title}'
```

### ⚠️ 对象型字段必须指定子字段

**对象或对象数组**不能单独选择，否则报
`400 Invalid 'fields' member: The 'xxx' object requires specifying sub-field(s)`。

- 需要子字段：`image` `titles` `tags` `relations` `screenshots` `developers`
  `staff` `va` `editions` `extlinks` `vns` `producers` `releases` `labels`
  `images` `media` `traits`
- **标量数组可直接选择**：`platforms` `languages` `aliases`

```bash
vndb.py producer -f 'id=p24' -F 'extlinks'                # ✗ 报错
vndb.py producer -f 'id=p24' -F 'extlinks{url,label,name}' # ✓
```

**`Too much data selected`**：服务端会估算 JSON 键数量，超阈值报错。
减少 `fields` 或 `results` 即可。

---

## 6. 各端点详解

### 6.1 `POST /vn` —— 视觉小说

排序：`id` `title` `released` `rating` `votecount` `searchrank`

过滤器：

| 名称                                                              | 标志 | 说明                              |
| ----------------------------------------------------------------- | ---- | --------------------------------- |
| `id`                                                              | o    | vndbid                            |
| `search`                                                          | m    | 搜索标题、别名、发行版标题        |
| `lang`                                                            | m    | 有该语言版本                      |
| `olang`                                                           |      | 原始语言                          |
| `platform`                                                        | m    | 有该平台版本                      |
| `length`                                                          | o    | 游玩时长估计，整数 1–5            |
| `released`                                                        | o,n  | 发布日期                          |
| `rating`                                                          | o,i  | 贝叶斯评分，整数 10–100           |
| `votecount`                                                       | o    | 投票数                            |
| `has_description` / `has_anime` / `has_screenshot` / `has_review` |      | 只接受 `1`，用 `!=` 取反          |
| `devstatus`                                                       |      | 开发状态 0=完成 1=开发中 2=已取消 |
| `tag`                                                             | m    | 含父标签                          |
| `dtag`                                                            | m    | 仅直接标签                        |
| `anime_id`                                                        |      | AniDB 动漫 ID                     |
| `label`                                                           | m    | 用户标签                          |
| `release`                                                         | m    | **嵌套**：匹配发行版              |
| `character`                                                       | m    | **嵌套**：匹配角色                |
| `staff`                                                           | m    | **嵌套**：匹配 staff              |
| `developer`                                                       | m    | **嵌套**：匹配制作者              |

字段（`/schema` 权威）：`id` `title` `alttitle` `titles{lang,title,latin,official,main}`
`aliases` `olang` `devstatus` `released` `languages` `platforms`
`image{id,url,dims,sexual,violence,votecount,thumbnail,thumbnail_dims}`
`length` `length_minutes` `length_votes` `description`
`average` `rating` `votecount` `popularity`(已废弃)
`screenshots{...,release{...}}` `relations{relation,relation_official,...vn字段}`
`tags{rating,spoiler,lie,...tag字段}` `developers{...producer字段}`
`editions{eid,lang,name,official}` `staff{eid,role,note,...staff字段}`
`va{note,staff{...},character{...}}` `extlinks{id,label,name,url}`

- `average` = 原始均分；`rating` = 贝叶斯评分（都缓存，可能滞后约 1 小时）

### 6.2 `POST /release` —— 发行版

排序：`id` `title` `released` `searchrank`

过滤器：`id`(o) `search`(m) `lang`(m) `platform`(m) `released`(o) `resolution`(o,i)
`resolution_aspect`(o,i) `minage`(o,n,i) `medium`(m,n) `voiced`(n) `engine`(n)
`rtype`(m) `extlink`(m) `drm`(m) `image`(m,n) `patch` `freeware` `uncensored`(i)
`official` `has_ero` | **嵌套**：`vn`(m) `producer`(m)

字段：`id` `title` `alttitle` `languages{lang,title,latin,mtl,main}`
`platforms` `media{medium,qty}` `vns{rtype,...vn字段}`
`producers{developer,publisher,...producer字段}`
`images{type,vn,languages,photo,...image字段}` `released` `minage`
`patch` `freeware` `uncensored` `official` `has_ero` `resolution` `engine`
`voiced` `notes` `gtin` `catalog` `extlinks`

- `images.type`：`pkgfront` `pkgback` `pkgcontent` `pkgside` `pkgmed` `dig`
- `voiced`：1=无配音 2=仅 ero 场景 3=部分 4=全配音
- `resolution`：`null` | `"non-standard"` | `[width, height]`
- `rtype`：`trial` `partial` `complete`

### 6.3 `POST /producer` —— 制作者

排序：`id` `name` `searchrank`
过滤器：`id`(o) `search`(m) `lang` `type` `extlink`(m)
字段：`id` `name` `original` `aliases` `lang` `type` `description` `extlinks`

- `type`：`co`=公司 `in`=个人 `ng`=业余团体

### 6.4 `POST /character` —— 角色

排序：`id` `name` `searchrank`

过滤器：`id`(o) `search`(m) `role`(m) `blood_type` `sex` `sex_spoil` `gender`
`gender_spoil` `height`(o,n,i) `weight`(o,n,i) `bust`(o,n,i) `waist`(o,n,i)
`hips`(o,n,i) `cup`(o,n,i) `age`(o,n,i) `trait`(m) `dtrait`(m) `birthday`(n)
| **嵌套**：`seiyuu`(m) `vn`(m)

字段：`id` `name` `original` `aliases` `description`
`image{id,url,dims,sexual,violence,votecount}` `blood_type` `height` `weight`
`bust` `waist` `hips` `cup` `age` `birthday[月,日]`
`sex[表观,真实]` `gender[非剧透,剧透]`
`vns{spoiler,role,release{...},...vn字段}` `traits{spoiler,lie,...trait字段}`

- `sex` 取值：`null` `"m"` `"f"` `"b"`(两者皆有) `"n"`(无性)
- `gender` 取值：`null` `"m"` `"f"` `"o"`(其他) `"a"`(皆可)
- `birthday` 中 `day` 为 `0` 表示只知月份

### 6.5 `POST /staff` —— 制作人员

⚠️ Staff 有多个标识符：主 staff ID（`id`）和每个别名 ID（`aid`）。
该端点查询的是 **staff 姓名**，多姓名 staff 会重复出现；用 `ismain=1` 去重。

排序：`id` `name` `searchrank`
过滤器：`id`(o) `aid` `search`(m) `lang` `gender` `role`(m) `extlink`(m) `ismain`
字段：`id` `aid` `ismain` `name` `original` `lang` `gender` `description`
`extlinks` `aliases{aid,name,latin,ismain}`

### 6.6 `POST /tag` —— 标签

排序：`id` `name` `vn_count` `searchrank`
过滤器：`id`(o) `search`(m) `category`
字段：`id` `name` `aliases` `description` `category` `searchable` `applicable` `vn_count`

- `category`：`cont`=内容 `ero`=性相关 `tech`=技术
- 标签是 **DAG**（不是树），API 不提供父子标签查询

### 6.7 `POST /trait` —— 角色特性

排序：`id` `name` `char_count` `searchrank`
过滤器：`id`(o) `search`(m)
字段：`id` `name` `aliases` `description` `searchable` `applicable` `sexual`
`group_id` `group_name` `char_count`

### 6.8 `POST /quote` —— 语录

排序：`id` `score`
过滤器：`id`(o) `vn`(嵌套) `character`(嵌套) `random`（只接受 `1`，随机取一条正分语录）
字段：`id` `quote` `score` `vn{...}` `character{...}`

⚠️ `random` 不能与其他过滤器组合，否则可能返回 0 条。

### 6.9 `GET /user`

| 参数     | 说明                                                 |
| -------- | ---------------------------------------------------- |
| `q`      | 用户 ID 或用户名，**可重复**                         |
| `fields` | 目前可指定 `lengthvotes`（`id`/`username` 始终返回） |

返回**以用户 ID 为键的对象**（⚠️ 不是 `results` 数组）：

```json
{ "u2": { "id": "u2", "username": "Yorhel", "lengthvotes": 10 } }
```

用户名匹配不区分大小写；形如 `u123` 的字符串不会被当作用户名。

### 6.10 `GET /stats`

```json
{
  "chars": 171554,
  "producers": 30274,
  "releases": 157854,
  "staff": 54620,
  "tags": 3014,
  "traits": 3328,
  "vn": 66746
}
```

### 6.11 `GET /authinfo`

返回 `{"id","username","permissions"}`。用于验证 token。

### 6.12 `GET /schema`

返回 API 元数据：

- `api_fields`：以 `/vn`、`/ulist` 等为键的字段树（`_inherit` 表示继承另一端点字段）
- `enums`：`language` `medium` `platform` `staff_role`
- `extlinks`：各端点支持的外部链接站点及 `url_format`

⚠️ `url_format` **仅供展示**，不要用它拼接 URL。

---

## 7. 枚举值（来自 `/schema`）

**language**（部分）：`ar` `bg` `zh` `zh-Hans` `zh-Hant` `cs` `da` `nl` `en` `fi`
`fr` `de` `el` `he` `hu` `id` `it` `ja` `ko` `la` `ms` `no` `fa` `pl` `pt-br`
`pt-pt` `ro` `ru` `es` `sv` `ta` `th` `tr` `uk` `vi` …
（完整列表用 `vndb.py schema --section enums --name language`）

**platform**：`win` `lin` `mac` `web` `ios` `and` `swi` `sw2` `ps1` `ps2` `ps3`
`ps4` `ps5` `psp` `psv` `xbo` `xxs` `xb1` `xb3` `nds` `n3d` `wii` `wiu` `gba`
`gbc` `drc` `sat` `smd` `scd` `pce` `pcf` `nes` `sfc` `dos` `msx` `p88` `p98`
`x68` `x1s` `fmt` `fm7` `fm8` `tdo` `bdp` `dvd` `vnd` `mob` `oth`

**medium**：`blr` `mrt` `cas` `cd` `dc` `dvd` `flp` `gdr` `in` `mem` `nod` `umd` `otc`

**staff_role**：`scenario` `director` `chardesign` `art` `music` `songs`
`translator` `editor` `qa` `staff`（另有 `seiyuu`，仅用于 `role` 过滤器）

---

## 8. HTTP 状态码

| 码  | 含义                           |
| --- | ------------------------------ |
| 200 | 成功（带 JSON）                |
| 204 | 成功（PATCH/DELETE 无内容）    |
| 400 | 请求 body 或查询无效           |
| 401 | token 无效                     |
| 404 | API 路径或 HTTP 方法不存在     |
| 429 | 被限流                         |
| 500 | 服务器错误（持续报错多为 bug） |
| 502 | 服务器暂时不可用               |

---

## 9. 性能与实用技巧

**批量按 ID 取条目**：一次查询远快于 N 次调用。

```json
{ "filters": ["or", ["id", "=", "v1"], ["id", "=", "v2"]], "results": 100 }
```

- 单查询**不要超过 100 个 ID**；不要用高 `page` 反复翻同一列表。
- 脚本的 `get` 子命令已封装该逻辑：`vndb.py get v17 v11 v1`

**分页**：默认按 `id` 排序时，用 `["id", ">", 上页最后ID]` 做游标最可靠；
按其他字段排序时用 `page` 参数。脚本 `--all` 会自动选对策略。

**随机条目**：

1. 先取最大 ID（结果可缓存）：`{"sort":"id","reverse":true,"results":1}`
2. 在 1 到最大 ID 之间随机取数，再查最近的：`{"filters":["id",">=","v4567"],"results":1}`

**日期比较**：不完整日期排在同年的完整日期**之后**
（`"2022"` 排在 `"2022-12"` 之后）。所以 `["released","<","2022-01"]`
也会匹配 2022 年 1 月的所有完整日期。未定的未来日期为 `"TBA"`；
过滤器另支持 `"unknown"` 和 `"today"`。

---

## 10. 近期变更（择要）

| 日期       | 变更                                                         |
| ---------- | ------------------------------------------------------------ |
| 2026-01-10 | `/release` 新增 `image` 过滤器                               |
| 2025-06-02 | `/trait` 新增 `sexual` 字段                                  |
| 2025-05-02 | 单请求过滤器谓词上限 1000                                    |
| 2025-04-05 | `/character` 新增 `gender` 字段                              |
| 2025-01-11 | `/character` 新增 `gender`/`gender_spoil` 过滤器             |
| 2025-01-07 | 新增 `POST /quote`                                           |
| 2024-09-09 | `/release` 新增 `images` 字段                                |
| 2024-05-18 | `/vn` 新增 `va` 字段                                         |
| 2024-03-13 | 新增 `POST /staff`；`/vn` 新增 `editions`/`staff`            |
| 2023-08-02 | `/vn` 新增 `developers` 字段                                 |
| 2023-07-11 | 废弃 `popularity`（现等价于 `votecount` 反转）               |
| 2023-01-17 | token 新增 `listwrite`；新增 PATCH/DELETE `/ulist`、`/rlist` |

需要最新字段时，直接查实时 schema：

```bash
vndb.py schema --section fields --name vn
vndb.py schema --section enums --name platform
```
