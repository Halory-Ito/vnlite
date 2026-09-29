/**
 * VN 详情 · 外部链接页签。
 *
 * 拆成独立页签的原因：外链是「出口」性质的内容（官网、商店、维基），
 * 和作品本体信息不是一类东西；放在概览最底部时几乎没人会滚到那里。
 *
 * 相比原先 `ExternalLinks` 的纯文本行，这里做成了卡片式列表：
 * 外链数量通常不多（3–8 条），给足点击区域更好按。
 */

import * as Linking from "expo-linking";
import type { JSX } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useThemeColor } from "heroui-native";

import { Icon } from "@/components/Icon";
import { EmptyState } from "@/components/ScreenState";
import { Muted, Paragraph } from "@/components/Typo";
import type { VnDetail } from "@/lib/api/types";

/** 站点 label / name → 可读名称。VNDB 的 label 是英文短标识 */
const SITE_LABEL: Record<string, string> = {
  homepage: "官方网站",
  vndb: "VNDB",
  wikipedia: "Wikipedia",
  "wikipedia-ja": "Wikipedia（日文）",
  twitter: "Twitter / X",
  steam: "Steam",
  dlsite: "DLsite",
  getchu: "Getchu",
  erogamescape: "ErogameScape",
  renai: "Renai",
  dengeki: "电击",
  animategames: "Animate Games",
  playstation: "PlayStation Store",
  nintendo: "Nintendo eShop",
  vgmdb: "VGMdb",
  ann: "Anime News Network",
  encubed: "Encubed",
  novelnews: "NovelNews",
  kagyuu: "Kagyuu",
  gyutto: "Gyutto",
  "sakura-game": "Sakura Game",
};

export function VnExtLinksTab({ vn }: { vn: VnDetail }): JSX.Element {
  const links = vn.extlinks ?? [];
  if (links.length === 0) {
    return <EmptyState title="没有外部链接" description="VNDB 上没有登记外链" />;
  }

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
      <Muted type="body-xs" className="px-4 pt-3 pb-2">
        共 {links.length} 条，点击用浏览器打开
      </Muted>
      <View className="px-4" style={{ gap: 8 }}>
        {links.map((link) => (
          <ExtLinkRow
            key={`${link.label}-${link.name}`}
            label={link.label}
            name={link.name}
            url={link.url}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function ExtLinkRow({
  label,
  name,
  url,
}: {
  label: string;
  name: string;
  url: string;
}): JSX.Element {
  // 图标只能吃具体色值（不吃 className），所以走主题 accent
  const accent = useThemeColor("accent");
  const site = SITE_LABEL[label] ?? label;

  return (
    <Pressable
      onPress={() => void Linking.openURL(url)}
      className="flex-row items-center gap-3 rounded-lg bg-default-soft px-3 py-2.5 active:opacity-60"
      accessibilityRole="link"
      accessibilityLabel={`打开 ${site}：${name}`}
    >
      <View className="flex-1">
        <Paragraph className="text-sm" numberOfLines={1}>
          {name}
        </Paragraph>
        <Muted type="body-xs">{site}</Muted>
      </View>
      <Icon name="arrowUpRightFromSquare" size={16} color={accent} />
    </Pressable>
  );
}
