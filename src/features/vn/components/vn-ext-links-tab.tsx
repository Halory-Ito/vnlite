/**
 * VN 详情 · 外部链接页签。
 *
 * 拆成独立页签的原因：外链是「出口」性质的内容（官网、商店、维基），
 * 和作品本体信息不是一类东西；放在概览最底部时几乎没人会滚到那里。
 *
 * 外观在 `components/ext-link-cards`（制作者 / staff 详情的外链页签共用同一份）。
 */

import type { JSX } from "react";

import { ExtLinkCards } from "@/components/ext-link-cards";
import type { VnDetail } from "@/lib/api/types";

export function VnExtLinksTab({ vn }: { vn: VnDetail }): JSX.Element {
  return <ExtLinkCards links={vn.extlinks} />;
}
