/**
 * 外链卡片列表。
 *
 * 从 VN 详情「外链」页签抽出来的共用组件 —— 外观沿用那一版：
 * 卡片式（而不是 `components/typo#ExternalLinks` 的纯文本行），
 * 因为外链是「出口」性质的内容、数量不多（3–8 条），给足点击区域更好按。
 *
 * 原先外链塞在概览页最底部，几乎没人会滚到那里，所以制作者 / staff 详情
 * 也把它单独放进页签（见 `features/catalog/detail-screens`）。
 */

import { useThemeColor } from "heroui-native";
import * as Linking from "expo-linking";
import type { JSX } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { useCopyProps } from "@/hooks/use-copy";

import { Icon } from "./icon";
import { EmptyState } from "./screen-state";
import { Muted, Paragraph } from "./typo";

export interface ExtLink {
  label: string;
  name: string;
  url: string;
}

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

/** VNDB 的 label 查不到映射时原样显示（总比显示空白好） */
export function siteLabel(label: string): string {
  return SITE_LABEL[label] ?? label;
}

export interface ExtLinkCardsProps {
  links: readonly ExtLink[] | undefined;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function ExtLinkCards({
  links,
  emptyTitle = "没有外部链接",
  emptyDescription = "VNDB 上没有登记外链",
}: ExtLinkCardsProps): JSX.Element {
  if (!links || links.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="px-4" style={{ gap: 8 }}>
        {links.map((link) => (
          <ExtLinkCard key={`${link.label}-${link.name}`} {...link} />
        ))}
      </View>
    </ScrollView>
  );
}

function ExtLinkCard({ label, name, url }: ExtLink): JSX.Element {
  // 图标只能吃具体色值（不吃 className），所以走主题 accent
  const accent = useThemeColor("accent");
  const site = siteLabel(label);
  // 长按复制链接（点击是打开浏览器，两者不冲突）
  const copyable = useCopyProps(url, { message: "已复制链接", preview: name });

  return (
    <Pressable
      onPress={() => void Linking.openURL(url)}
      onLongPress={copyable.onLongPress}
      delayLongPress={copyable.delayLongPress}
      className="flex-row items-center gap-3 rounded-lg bg-default-soft px-3 py-2.5 active:opacity-60"
      accessibilityRole="link"
      accessibilityLabel={`打开 ${site}：${name}`}
      accessibilityHint={copyable.accessibilityHint}
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
