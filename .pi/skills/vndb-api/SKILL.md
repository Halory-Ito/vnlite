---
name: vndb-api
description: 通过 VNDB (vndb.org) 公开的 Kana HTTP API 查询视觉小说数据库并管理用户收藏清单。覆盖全部公开端点：查询 VN / 发行版 / 制作者 / 角色 / staff / 标签 / 特性 / 语录，按 ID 批量取条目，搜索与高级过滤（评分、标签、日期、平台、语言、角色属性），读取任意用户的收藏清单与标签，以及写操作（打分、备注、起止日期、增删标签、标记发行版持有状态、移出清单）。当用户提到 VNDB、vndb.org、视觉小说、galgame、VN 数据库、收藏夹 / 清单 / 打分 / 标记已通关，或要查某作品的评分、角色、发行版、制作者、语录时使用。
agent_created: true
---

# VNDB API 技能

封装 VNDB 的 Kana HTTP API（`https://api.vndb.org/kana`），覆盖全部公开端点。
用 `scripts/vndb.py` 执行查询与写入——它已处理认证、过滤器语法、翻页和错误信息，
无需手写 HTTP 请求。

## 前置说明

- 脚本仅依赖 Python 标准库，无需安装任何包。
  本机可用解释器：`C:/Users/Ciallo/.workbuddy/binaries/python/versions/3.13.12/python.exe`
  （通常直接用 `python` 亦可）。
- **读操作不需要认证**，可查询任何公开数据。
- **写操作需要 token**（`listwrite` 权限），且 VNDB **只能修改用户自己的清单**，
  不能修改数据库条目内容（标题、简介等），也没有论坛/账号相关接口。
- 速率限制：**每 5 分钟 200 次请求**，单请求超过 3 秒会被中止。
  批量取条目请用一次查询带多个 ID，不要在循环里单条请求。

## 快速开始

```bash
# 按 ID 取条目（自动合并为一次请求，最多 100 个）
vndb.py get v17 v11 v1

# 搜索 + 过滤 + 排序
vndb.py vn -f 'search=fate' -f 'rating>=80' -F 'id,title,rating,released' -n 5

# 读某人的公开收藏清单
vndb.py ulist -u u2 -s vote -r -F 'id,vote,labels{id,label},vn{title,rating}' -n 10

# 读某人的清单标签（拿到合法 label id）
vndb.py labels -u u2 -F count

# 数据库统计
vndb.py stats
```

## 命令速查

| 命令              | 端点                         | 说明                                               |
| ----------------- | ---------------------------- | -------------------------------------------------- |
| `get <id>...`     | `POST /<type>`               | 按 vndbid 批量取条目，单次上限 100，**不可混类型** |
| `vn`              | `POST /vn`                   | 视觉小说                                           |
| `release`         | `POST /release`              | 发行版                                             |
| `producer`        | `POST /producer`             | 制作者                                             |
| `character`       | `POST /character`            | 角色                                               |
| `staff`           | `POST /staff`                | 制作人员                                           |
| `tag`             | `POST /tag`                  | 标签                                               |
| `trait`           | `POST /trait`                | 角色特性                                           |
| `quote`           | `POST /quote`                | 语录（`-f 'random=1'` 随机一条）                   |
| `ulist`           | `POST /ulist`                | 用户 VN 清单（需 `-u` 或认证）                     |
| `labels`          | `GET /ulist_labels`          | 用户清单标签                                       |
| `user`            | `GET /user`                  | 按 ID/用户名查用户                                 |
| `stats`           | `GET /stats`                 | 全库统计                                           |
| `schema`          | `GET /schema`                | 字段/枚举/外链元数据                               |
| `authinfo`        | `GET /authinfo`              | 验证 token 与权限                                  |
| `set` / `unset`   | `PATCH`/`DELETE /ulist/<id>` | 写：改清单 / 移出清单                              |
| `rset` / `runset` | `PATCH`/`DELETE /rlist/<id>` | 写：改发行版持有状态 / 移除                        |
| `rlist`           | —                            | 仅提示：VNDB 无发行版清单读端点                    |

查询类选项（`vn`/`release`/…/`ulist` 通用）：

```
-f, --filter EXPR     过滤器，可重复，多个之间为 AND
--filter-json JSON    原始 JSON 谓词，可重复
-F, --fields LIST     字段列表，支持 image.url 与 labels{id,label}
-s, --sort FIELD      排序字段（各端点取值不同，默认 id）
-r, --reverse         降序
-n, --results N       每页条数，默认 10，最大 100
-p, --page N          页码，从 1 开始
-u, --user ID         用户 ID，如 u2
--count               一并返回总匹配数（较慢）
--all                 自动翻页并合并全部结果
--max-results N       --all 的结果上限，默认 1000
--max-pages N         --all 的页数上限，默认 200
--body FILE           用文件（或 `-` 读 stdin）提供完整 JSON 查询体
--compact             单行 JSON 输出
```

## 七个必须知道的坑

### 1. 嵌套过滤器不能传标量

`release`/`character`/`staff`/`developer`/`producer`/`seiyuu`/`vn` 这些过滤器
的值**本身是另一个谓词**。`-f 'vn=v17'` 会返回
`400 Invalid 'filters' member`。

用**点号简写**（外层运算符固定为 `=`）：

```bash
vndb.py release -f 'vn.id=v17'
vndb.py release -f 'vn.released>=2010'
vndb.py character -f 'vn.id=v17' -f 'role=main'
```

等价于原始写法 `["vn","=",["id","=","v17"]]`。

### 2. 没有「发行版清单」读端点

`POST /rlist` 和 `GET /rlist` 都返回 **404**，只有 `PATCH`/`DELETE /rlist/<id>`。
发行版持有状态要通过 `ulist` 的 `releases` 字段读取：

```bash
vndb.py ulist -u u2 -F 'id,vn{title},releases{id,title,list_status}'
```

### 3. 过滤器的值类型不需要纠结

API 对 `"80"` 和 `80` 都会做类型转换，两种写法都能用。
脚本会自动尝试 JSON 解析：`[105,1,0]` 这类元组能正确变成数组。

```bash
vndb.py vn --filter-json '["tag","=",[105,1,0]]'   # tag_id, max_spoiler, min_tag_level
```

### 4. `PATCH /ulist` 一定会把 VN 加入清单

即使你只是想删掉分数，该 VN 也会被加进清单。要移除必须用 `DELETE`（`unset`）。
另外 API **不校验 label id**，可以写入不存在的标签——设置前先用 `labels` 确认。

### 5. 对象型字段必须指定子字段

`image`、`tags`、`titles`、`extlinks`、`relations`、`screenshots`、`developers`、
`staff`、`va`、`editions`、`vns`、`releases`、`labels` 等**对象或对象数组**，
不能单独选，否则报
`400 The 'image' object requires specifying sub-field(s)`。

```bash
vndb.py vn -f 'id=v17' -F 'image'                  # ✗ 报错
vndb.py vn -f 'id=v17' -F 'image.url'              # ✓ 点号
vndb.py vn -f 'id=v17' -F 'image{url,dims}'        # ✓ 花括号
```

**标量数组可以单独选**，无需子字段：`platforms`、`languages`、`aliases`。

### 6. `/ulist` 的 `vote` 只能排序，不能过滤

`-s vote` 合法，但 `-f 'vote>=85'` 会报 `400 Invalid 'vote' filter: Unknown field`。
`/ulist` 支持的是**全部 `/vn` 过滤器**（`rating`、`released`、`olang`、`label`…），
不含 `vote`。要按自己的打分筛选，请取回后用 `-s vote -r` 排序再自行截取。

### 7. 写操作默认是 dry-run

`set`/`unset`/`rset`/`runset` 不带 `--yes` 时**不会真的提交**，
只打印将要发送的请求并以退出码 3 结束。这是刻意的安全设计，见下节。

## 写操作规范（重要）

写操作会改动用户的真实账号数据，必须按此流程：

1. **确认 token 与权限**：`vndb.py authinfo`。没有 token 时告知用户去
   https://vndb.org/u/tokens 创建（需要 `listwrite` 权限），不要尝试绕过。
2. **先读后写**：用 `ulist` 查当前状态；用 `labels` 确认合法 label id。
3. **先 dry-run**：不加 `--yes` 跑一次，把要发送的请求展示给用户。
4. **取得用户明确同意后**再加 `--yes` 执行。
5. **复核结果**：再次 `ulist` 确认写入生效。

```bash
# 1) dry-run，展示请求
vndb.py set v17 --vote 88 --labels-set 2

# 2) 用户确认后执行
vndb.py set v17 --vote 88 --labels-set 2 --yes

# 3) 复核
vndb.py ulist -F 'id,vote,labels{id,label},vn{title}' -f 'id=v17'
```

写操作要点：

- `--labels` **覆盖**全部标签；`--labels-set` **追加**；`--labels-unset` **移除**。
- 虚拟标签 `0`（No label）和 `7`（Voted）不可设置；`Voted` 随 `vote` 自动增删。
- 网站会自动清理互斥标签（Playing/Finished/Stalled/Dropped 只留一个），
  **API 不会**——需要自己保证只设一个。
- `DELETE /ulist/<id>` 会**连带删除**该 VN 的发行版条目，且不可逆。
- `PATCH /rlist/<id>` 会把关联的所有 VN 也加入清单。
- 传 `--null <字段>` 可清空日期/备注（`labels` 除外）。

## 常用任务示例

```bash
# 某年之后、评分 80+ 的日文作品，按评分降序
vndb.py vn -f 'olang=ja' -f 'rating>=80' -f 'released>=2020' -s rating -r -F 'id,title,rating' -n 10

# 某 VN 的全部主角及配音
vndb.py character -f 'vn.id=v17' -f 'role=main' -F 'id,name,sex,vns{role}'

# 某制作者的资料与已确认的官方链接
vndb.py producer -f 'search=key' -F 'id,name,original,type,lang,extlinks{url,label,name}'

# 在某人清单里筛「已完成」，按对方打分降序
# （注意：vote 只能排序不能过滤；rating 是全体用户的评分，可以过滤）
vndb.py ulist -u u2 -f 'label=2' -s vote -r -F 'id,vote,vn{title}'
vndb.py ulist -u u2 -f 'rating>=85' -s vote -r -F 'id,vote,vn{title,rating}'

# 随机来一条语录
vndb.py quote -f 'random=1' -F 'id,quote,score,vn{title}'

# 查某个标签下的作品数
vndb.py tag -f 'search=yuri' -s vn_count -r -F 'id,name,category,vn_count'

# 取某 VN 的全部发行版及其平台
vndb.py release -f 'vn.id=v17' -F 'id,title,released,platforms,minage,extlinks{url,label}'

# 实时确认字段名（字段会随版本新增）
vndb.py schema --section fields --name vn
vndb.py schema --section enums --name platform
```

## 参考资料

按需加载，不必全读：

- `references/api-reference.md`
  完整 API 参考：查询模型、过滤器语法与标志、嵌套过滤器、每个端点的全部
  过滤器/字段/排序值、枚举值、错误码、分页与性能技巧、变更日志。
  **不记得字段名或过滤器名时查这里。**
- `references/user-lists-and-writes.md`
  认证与 token 权限、读取任意用户清单、标签体系、4 个写操作端点的完整参数
  与行为陷阱、面向 Agent 的安全约定。

## GET /schema 是权威来源

字段和枚举会随 VNDB 更新而变化，发生「字段不存在」类报错时，
用 `schema` 命令实时核对，而不是依赖文档里的历史快照：

```bash
vndb.py schema --section fields --name character
vndb.py schema --section enums --name language
```
