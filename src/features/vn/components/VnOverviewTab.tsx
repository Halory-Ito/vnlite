/**
 * VN 详情 · 概览页签。
 *
 * 只放「作品本体」的信息：简介 + 标签。
 *
 * 截图 / 关联作品 / 外部链接原本也在这里，但它们各自都是**列表型内容**，
 * 混在概览里会把页面拉得极长、还要一路滚到底才能看到 —— 已拆成独立页签
 * （见 `VnScreenshotsTab` / `VnRelationsTab` / `VnExtLinksTab`）。
 *
 * 平台 / 时长 / 语言三行也已移除（Master 要求）：时长进了详情页头部的三列概览，
 * 平台在「版本」页签里有更细的粒度（每个发行版各自的平台），语言同理。
 *
 * 简介与标签**默认折叠**：VNDB 的简介常有几千字，标签动辄几十个，
 * 一进来就铺满整屏，反而看不到真正想看的属性。
 */

import { Link } from "expo-router";
import type { JSX } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { CollapsibleText, ExpandToggle, useCollapsedList } from "@/components/Collapsible";
import { Divider } from "@/components/Separator";
import { Muted } from "@/components/Typo";
import { SectionHeader, TagChip } from "@/components/ui";
import type { VnDetail } from "@/lib/api/types";

/** 收起状态下最多显示几个标签 */
const TAG_LIMIT = 12;

export function VnOverviewTab({ vn }: { vn: VnDetail }): JSX.Element {
  // 按评分热度排序：VNDB 的标签是按「多少人打了这个标签」加权的
  const sortedTags = [...(vn.tags ?? [])].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const tags = useCollapsedList(sortedTags, TAG_LIMIT);

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
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
          <SectionHeader title="标签" />
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
              <ExpandToggle expanded={tags.expanded} onPress={tags.toggle} />
            </View>
          ) : (
            <View className="pb-6" />
          )}
        </>
      ) : null}
    </ScrollView>
  );
}
