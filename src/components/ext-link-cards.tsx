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

import type { Translator } from "@/hooks/use-translation";
import { useCopyProps } from "@/hooks/use-copy";
import { useTranslation } from "@/hooks/use-translation";
import type { TranslationKey } from "@/lib/i18n/translate";

import { Icon } from "./icon";
import { EmptyState } from "./screen-state";
import { Muted, Paragraph } from "./typo";

export interface ExtLink {
  label: string;
  name: string;
  url: string;
}

/** 站点 label / name → 可读名称。VNDB 的 label 是英文短标识（专有名词保留原文） */
const SITE_LABEL: Record<string, string> = {
  vndb: "VNDB",
  wikipedia: "Wikipedia",
  twitter: "Twitter / X",
  steam: "Steam",
  dlsite: "DLsite",
  getchu: "Getchu",
  erogamescape: "ErogameScape",
  renai: "Renai",
  animategames: "Animate Games",
  playstation: "PlayStation Store",
  nintendo: "Nintendo eShop",
  vgmdb: "VGMDB",
  ann: "Anime News Network",
  encubed: "Encubed",
  novelnews: "NovelNews",
  kagyuu: "Kagyuu",
  gyutto: "Gyutto",
  "sakura-game": "Sakura Game",
};

/** 需要翻译的站点名（其余走 `SITE_LABEL` 原样展示） */
const SITE_LABEL_KEY: Record<string, TranslationKey> = {
  homepage: "catalog.siteHomepage",
  "wikipedia-ja": "catalog.siteWikipediaJa",
  dengeki: "catalog.siteDengeki",
};

/** VNDB 的 label 查不到映射时原样显示（总比显示空白好） */
export function siteLabel(label: string, t: Translator): string {
  const key = SITE_LABEL_KEY[label];
  return key ? t(key) : (SITE_LABEL[label] ?? label);
}

export interface ExtLinkCardsProps {
  links: readonly ExtLink[] | undefined;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function ExtLinkCards({
  links,
  emptyTitle,
  emptyDescription,
}: ExtLinkCardsProps): JSX.Element {
  const { t } = useTranslation();

  if (!links || links.length === 0) {
    return (
      <EmptyState
        title={emptyTitle ?? t("catalog.extlinksEmptyTitle")}
        description={emptyDescription ?? t("catalog.extlinksEmptyDescription")}
      />
    );
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
  const { t } = useTranslation();
  const site = siteLabel(label, t);
  // 长按复制链接（点击是打开浏览器，两者不冲突）
  const copyable = useCopyProps(url, { message: t("catalog.extlinksCopied"), preview: name });

  return (
    <Pressable
      onPress={() => void Linking.openURL(url)}
      onLongPress={copyable.onLongPress}
      delayLongPress={copyable.delayLongPress}
      className="flex-row items-center gap-3 rounded-lg bg-default-soft px-3 py-2.5 active:opacity-60"
      accessibilityRole="link"
      accessibilityLabel={t("catalog.extlinksOpen", { site, name })}
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
