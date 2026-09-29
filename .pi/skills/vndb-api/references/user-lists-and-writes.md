# 用户清单读取与写入操作

覆盖：认证、读取任意用户的收藏清单、读取标签、以及全部 4 个写操作端点。

## 0. 重要前提

VNDB API **不允许**修改数据库条目本身（VN/角色/标签等）。
所谓"修改操作"仅指**修改你自己的用户清单**：

| 可写                                 | 不可写                     |
| ------------------------------------ | -------------------------- |
| 你清单里的投票、备注、起止日期、标签 | VN 条目的标题、简介、评分  |
| 发行版的持有状态                     | 标签的增删改、新增 VN 条目 |

写操作必须满足：token 具有 `listwrite` 权限。

---

## 1. 准备 token

1. 登录 vndb.org → My Profile → Applications 标签页
2. 或直接访问 https://vndb.org/u/tokens
3. 创建 token，勾选权限（读取私有清单需 `listread`，写入清单需 `listwrite`）

存放方式（脚本按此顺序查找）：

```bash
# 方式一：环境变量（推荐）
export VNDB_TOKEN="xxxx-xxxxx-xxxxx-xxxx-xxxxx-xxxxx-xxxx"

# 方式二：配置文件
mkdir -p ~/.config/vndb && echo "你的token" > ~/.config/vndb/token && chmod 600 ~/.config/vndb/token

# 方式三：命令行临时传入
vndb.py authinfo --token "xxxx-..."
```

验证：

```bash
vndb.py authinfo
# {"id":"u12345","username":"...","permissions":["listread","listwrite"]}
```

---

## 2. 读取用户的收藏清单

端点：`POST /ulist`。

- **必须**提供 `user`（用户 ID，如 `u2`），**或**已认证（不传 `user` 则读取自己的清单）。
- 只传 `user` 读他人清单：仅能看到对方**公开**的内容，私有标签不会出现。
- 已从数据库删除的条目不会返回。

```bash
# 基本：读某人清单
vndb.py ulist -u u2 -F 'id,vote,added,labels{id,label},vn{title,released}' -n 5

# 按分数降序
vndb.py ulist -u u2 -s vote -r -F 'id,vote,vn{title}' -n 10

# 只看「已通关」标签（label 过滤器可简写）
vndb.py ulist -u u2 -f 'label=2' -F 'id,vn{title}'

# 读发行版持有状态（VNDB 没有独立的发行版清单读端点）
vndb.py ulist -u u2 -F 'id,vn{title},releases{id,title,list_status,platforms}'

# 取全部（自动翻页）
vndb.py ulist -u u2 -F 'id,vote' --all --max-results 500
```

**排序字段**：`id` `title` `released` `rating` `votecount` `voted` `vote`
`added` `lastmod` `started` `finished` `searchrank`

⚠️ **`vote` 只能用于 `sort`，不能作为过滤器。**
`-f 'vote>=85'` 会报 `400 Invalid 'vote' filter: Unknown field`。
`/ulist` 可用的是**全部 `/vn` 过滤器**（`rating` `released` `olang` `label` `tag` …），
其中 `rating` 是全体用户的贝叶斯评分，不是清单主人的打分。
要按清单主人的打分筛选，请 `-s vote -r` 取回后自行截取。

**可用字段**（`/ulist` + 可继承全部 `/vn` 字段）：

| 字段                   | 类型          | 说明                                  |
| ---------------------- | ------------- | ------------------------------------- |
| `id`                   | vndbid        | VN ID                                 |
| `added`                | Integer       | 加入清单的 unix 时间戳                |
| `voted`                | Integer, null | 投票时间戳                            |
| `lastmod`              | Integer       | 最后修改时间戳                        |
| `vote`                 | Integer, null | 10–100                                |
| `started` / `finished` | String, null  | `YYYY-MM-DD`                          |
| `notes`                | String, null  | 私人备注（他人不可见）                |
| `labels`               | Array         | `{id, label}`；私有标签仅在认证时列出 |
| `vn`                   | Object        | 嵌套全部 VN 字段                      |
| `releases`             | Array         | `{list_status, ...release字段}`       |

`list_status`：`0`=Unknown `1`=Pending `2`=Obtained `3`=On loan `4`=Deleted

`/ulist` 同样支持全部 `/vn` 过滤器，因此可以这样查：

```bash
# 在某人清单里找 2020 年后发行、评分 80+ 的作品
vndb.py ulist -u u2 -f 'released>=2020' -f 'rating>=80' -F 'id,vn{title,rating}'
```

---

## 3. 读取清单标签

端点：`GET /ulist_labels`

```bash
vndb.py labels -u u2 -F count
# {"labels":[{"id":1,"label":"Playing","private":false,"count":1}, ...]}
```

- 不传 `user` 则返回**当前认证用户**的标签。
- `fields` 目前仅支持 `count`。
- 私有标签需要 `listread` 权限才会返回；`Voted`（id=7）总会返回。
- **id < 10 为预定义标签**，所有用户一致：

| id  | 标签                       |
| --- | -------------------------- |
| 0   | No label（虚拟，不可设置） |
| 1   | Playing                    |
| 2   | Finished                   |
| 3   | Stalled                    |
| 4   | Dropped                    |
| 5   | Wishlist                   |
| 6   | Blacklist                  |
| 7   | Voted（虚拟，不可设置）    |

id ≥ 10 是用户自建标签（例如某用户的 `13` = `Waiting`）。

---

## 4. 写操作之一：`PATCH /ulist/<id>` —— 添加/更新 VN

需要 `listwrite`。body 中所有成员都可选，缺失即不修改。

| 成员           | 类型         | 说明                     |
| -------------- | ------------ | ------------------------ |
| `vote`         | Integer      | 10–100                   |
| `notes`        | String       | 私人备注                 |
| `started`      | String       | `YYYY-MM-DD`             |
| `finished`     | String       | `YYYY-MM-DD`             |
| `labels`       | Array\<int\> | **覆盖**现有标签         |
| `labels_set`   | Array\<int\> | **追加**标签，不影响现有 |
| `labels_unset` | Array\<int\> | **移除**标签             |

传 `null` 可清空字段（`labels` 除外），脚本用 `--null <字段>`。

```bash
# 打分 + 追加「已完成」标签，保留其他标签
vndb.py set v17 --vote 90 --labels-set 2 --yes

# 设置备注与起止日期
vndb.py set v17 --notes "神作" --started 2026-01-01 --finished 2026-02-01 --yes

# 用 labels 整体替换标签集
vndb.py set v17 --labels 2,13 --yes

# 清空完成日期
vndb.py set v17 --null finished --yes
```

### ⚠️ 行为陷阱

1. **PATCH 一定会把该 VN 加入清单**，哪怕你只是想删掉分数。
   要从清单移除必须用 `DELETE`。
2. **虚拟标签不可设置**：id `0`（No label）和 `7`（Voted）。
   `Voted` 会根据 `vote` 是否为空自动增删。
3. **API 不校验 label id**（官方已知问题）：可以写入根本不存在的标签。
   设置前先用 `vndb.py labels` 确认 id。
4. **网站会自动清理互斥标签**（Playing/Finished/Stalled/Dropped 只留一个），
   但 **API 不会**。同时设置 `1,2` 会真的都写进去。操作时请自行只保留一个。
5. API **不检查** VN 是否存在以外的业务逻辑，写错请到网站手动修。

---

## 5. 写操作之二：`DELETE /ulist/<id>` —— 移除 VN

需要 `listwrite`。

```bash
vndb.py unset v17 --yes
```

- 即使该 VN 不在清单中，也返回成功（幂等）。
- **移除 VN 会连带移除其关联的发行版条目。**

---

## 6. 写操作之三/四：`PATCH` / `DELETE /rlist/<id>` —— 发行版持有状态

需要 `listwrite`。

```bash
vndb.py rset r196 --status 2 --yes    # 标记为已获得
vndb.py runset r196 --yes             # 移除发行版条目
```

- `PATCH` 的 `status` 取值：`0` Unknown `1` Pending `2` Obtained `3` On loan `4` Deleted
- **`PATCH /rlist/<id>` 会把该发行版关联的所有 VN 也加入你的 VN 清单。**
- `DELETE /rlist/<id>` **不会**移除关联的 VN；需要另外调用 `DELETE /ulist/<id>`。
- 两者都幂等（不在清单中也返回成功）。

---

## 7. 面向 Agent 的安全约定

执行任何写操作前，必须遵守：

1. **先读后写**：先用 `/ulist` 或 `vndb.py labels` 确认当前状态和合法 label id。
2. **必须向用户确认**：把即将发送的请求内容展示给用户，得到明确同意后再执行。
   脚本默认是 **dry-run**（打印请求后以退出码 3 结束），只有加 `--yes` 才真正提交。
3. **不要猜 token**：没有 token 时不要尝试绕过，直接告知用户去
   https://vndb.org/u/tokens 创建。
4. **不要批量猜测式写入**：不要在循环里对不确定的 ID 连续 PATCH。
5. **提示不可逆性**：`DELETE /ulist/<id>` 会连带删除发行版条目。

---

## 8. 完整示例

```bash
# 1) 确认身份与权限
vndb.py authinfo

# 2) 查看自己的标签（拿到合法 label id）
vndb.py labels

# 3) 看某人公开清单中的高分作品
vndb.py ulist -u u2 -s vote -r -F 'id,vote,vn{title,rating}' -n 10

# 4) 给自己清单里的 v17 打分并标记已通关（dry-run → 确认 → 执行）
vndb.py set v17 --vote 88 --labels-set 2
vndb.py set v17 --vote 88 --labels-set 2 --yes

# 5) 复核写入结果
vndb.py ulist -F 'id,vote,labels{id,label},vn{title}' -f 'id=v17'
```
