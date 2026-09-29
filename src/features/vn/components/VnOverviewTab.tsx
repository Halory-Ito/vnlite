/**
 * VN 详情 · 概览页签。
 *
 * 只放「作品本体」的信息：基本属性 + 简介 + 标签。
 *
 * 截图 / 关联作品 / 外部链接原本也在这里，但它们各自都是**列表型内容**，
 * 混在概览里会把页面拉得极长、还要一路滚到底才能看到 —— 已拆成独立页签
 * （见 `VnScreenshotsTab` / `VnRelationsTab` / `VnExtLinksTab`）。
 *
 * 简介与标签**默认折叠**：VNDB 的简介常有几千字，标签动辄几十个，
 * 一进来就铺满整屏，反而看不到真正想看的属性。
 */

import { Link } from "expo-router";
import type { JSX } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { CollapsibleText, ExpandToggle, useCollapsedList } from "@/components/Collapsible";
import { Divider } from "@/components/Separator";
import { Muted, Paragraph } from "@/components/Typo";
import { KeyValueRow, PlatformBadges, SectionHeader, TagChip } from "@/components/ui";
import type { VnDetail } from "@/lib/api/types";
import { formatLength, formatMinutes, languageLabel } from "@/utils/format";

/** 收起状态下最多显示几个标签 */
const TAG_LIMIT = 12;

export function VnOverviewTab({ vn }: { vn: VnDetail }): JSX.Element {
  const languages = vn.languages ?? [];
  // 按评分热度排序：VNDB 的标签是按「多少人打了这个标签」加权的
  const sortedTags = [...(vn.tags ?? [])].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const tags = useCollapsedList(sortedTags, TAG_LIMIT);

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="py-2">
        <KeyValueRow label="平台">
          <PlatformBadges platforms={vn.platforms} max={8} />
        </KeyValueRow>
        <KeyValueRow label="时长">
          <Muted type="body-sm">{formatLength(vn.length)}</Muted>
          {vn.length_minutes != null ? (
            <Muted type="body-xs">{formatMinutes(vn.length_minutes)}</Muted>
          ) : null}
        </KeyValueRow>
        {languages.length > 0 ? (
          <KeyValueRow label="语言">
            <LanguageChips languages={languages} original={vn.olang} />
          </KeyValueRow>
        ) : null}
      </View>

      <Divider />

      {vn.description ? (
        <>
          <SectionHeader title="简介" />
          <View className="px-4 pb-4">
            <CollapsibleText text={vn.description} lines={6} />
          </View>
        </>
      ) : (
        <View className="px-4 py-4">
          <Muted type="body-sm">该作品没有登记简介</Muted>
        </View>
      )}

      {sortedTags.length > 0 ? (
        <>
          <Divider />
          <SectionHeader title={`标签 · ${sortedTags.length}`} />
          <View className="flex-row flex-wrap gap-1.5 px-4 pb-3">
            {tags.shown.map((tag) => (
              <Link key={tag.id} href={`/tag/${tag.id}`} asChild>
                <Pressable className="active:opacity-60">
                  <TagChip id={tag.id} name={tag.name} spoiler={tag.spoiler} />
                </Pressable>
              </Link>
            ))}
          </View>

          {tags.truncated ? (
            <View className="px-4 pb-8">
              <ExpandToggle
                expanded={tags.expanded}
                total={sortedTags.length}
                onPress={tags.toggle}
              />
            </View>
          ) : (
            <View className="pb-6" />
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

/**
 * 语言标签。
 *
 * 支持多语言的作品在 VNDB 上会列出全部可用语言（英化 / 汉化 / 官方双语…），
 * 挤成一行「日语 · 英语 · 中文」读起来像一句话，做成 chip 才一眼能数。
 * 原始语言用 accent 色标出来。
 */
function LanguageChips({
  languages,
  original,
}: {
  languages: readonly string[];
  original?: string;
}): JSX.Element {
  return (
    <View className="flex-row flex-wrap items-center gap-1.5">
      {languages.map((lang) => {
        const isOriginal = original === lang;
        return (
          <View
            key={lang}
            className={`rounded-full px-2 py-0.5 ${isOriginal ? "bg-accent-soft" : "bg-default-soft"}`}
            accessibilityLabel={
              isOriginal ? `${languageLabel(lang)}，原始语言` : languageLabel(lang)
            }
          >
            <Paragraph
              type="body-xs"
              className={`text-[11px] ${isOriginal ? "text-accent" : "text-foreground"}`}
            >
              {languageLabel(lang)}
              {isOriginal ? "（原始）" : ""}
            </Paragraph>
          </View>
        );
      })}
    </View>
  );
}
