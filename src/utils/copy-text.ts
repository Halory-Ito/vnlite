/**
 * 长按「整条复制」时往剪贴板里放什么文本。
 *
 * **纯逻辑**：不 import 任何原生模块（`expo-clipboard` / `expo-haptics` 都在
 * `hooks/use-copy` 里），所以冒烟脚本能直接测。
 *
 * ## 这套只服务于「点得动的那一层」
 *
 * 全项目复制分两种（别混）：
 *   - **普通文字**（标题 / 简介 / 语录 / 评论）→ 长按弹系统选区，只复制其中一段
 *     （`components/typo` 与 `muted.tsx` 全局默认 `selectable`）
 *   - **可点的一层**（列表行 / 站内链接 / 外链卡片）→ 外面套着 `Pressable`，
 *     JS 的 responder 会先拿到触摸，系统选区出不来；所以长按 = 整条复制，
 *     格式由这里的纯函数决定
 */

/** VNDB 网站上的条目地址（`v2002` / `p24` / `s1234` / `c7` / `t11` 都适用） */
function vndbUrl(id: string): string {
  return `https://vndb.org/${id}`;
}

/**
 * 站内条目：名字 + `(id)` + 官网链接。
 *
 * 只复制名字是没用的 —— VNDB 上同名条目有好几个（「CLANNAD」能搜出一串），
 * 带上 id 与链接，粘给别人的时候对方一点就打开。
 *
 * id 或名字缺了就退化成另一项；两项都没有返回空串，
 * 调用点的复制手势会自动变成空操作（`useCopyProps` 里有判空）。
 */
export function entryCopyText(name: string, id: string): string {
  const label = name.trim();
  const key = id.trim();
  if (!key) return label;
  return label ? `${label} (${key})\n${vndbUrl(key)}` : `(${key})\n${vndbUrl(key)}`;
}

/** 作品（`VnSummary` / `VnDetail` 都有 `id` + `title`，直接传进去即可） */
export function vnCopyText(vn: { id: string; title?: string | null }): string {
  return entryCopyText(vn.title ?? "", vn.id);
}

/**
 * toast 里显示的短摘要 —— toast 只有一行，几千字的文本不能整段塞进去。
 * 换行与连续空白压成空格（VNDB 的字段经常是软换行），超长再截断。
 */
export function copyPreview(text: string, limit = 14): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= limit) return flat;
  return `${flat.slice(0, limit)}…`;
}
