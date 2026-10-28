/**
 * 搜索页。
 *
 * 一个输入框 + 一排范围切换：作品（默认）/ 人员 / 用户 / 厂商
 * （即 VN / staff / user / producer，完整说法见 `search-logic`）。
 * 四档共用同一个关键词，换范围不清空输入（对比着看更直观）。
 *
 * 没有输入时下半屏是**数据库统计图表**（原首页那张卡，Master 要求搬过来并去掉卡片外框）——
 * 搜索页的「没事干」状态正好放它，不输入关键词时也有东西看。
 *
 * 输入防抖 350ms（`useDebouncedValue`），避免每敲一个字就打一次接口 ——
 * VNDB 的限流是 200 次 / 5 分钟，白烧配额不划算。
 */

import { SearchField } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { SegmentedControl } from "@/components/segmented-control";
import { DatabaseStats } from "@/features/stats/components/database-stats";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useTranslucentSurface } from "@/hooks/use-translucent-surface";
import { useTranslation } from "@/hooks/use-translation";

import {
  SCOPE_OPTIONS,
  SEARCH_PLACEHOLDER_KEY,
  type SearchScope,
} from "@/features/search/lib/search-logic";

import { CatalogSearchResults } from "@/features/search/components/catalog-search-results";
import { TagSearchResults } from "@/features/search/components/tag-search-results";
import { UserSearchResults } from "@/features/search/components/user-search-results";
import { VnSearchResults } from "@/features/search/components/vn-search-results";

const DEBOUNCE_MS = 350;

export function SearchScreen(): JSX.Element {
  const { t } = useTranslation();
  // 搜索框的底色跟卡片用同一个透明度，输入框也能透出背景图
  const fieldSurface = useTranslucentSurface();
  // 默认「作品」：绝大多数搜索意图是找作品
  const [scope, setScope] = useState<SearchScope>("vn");
  const [input, setInput] = useState("");
  const keyword = useDebouncedValue(input, DEBOUNCE_MS).trim();
  const scopeOptions = SCOPE_OPTIONS.map((option) => ({
    value: option.value,
    label: t(option.labelKey),
  }));

  return (
    <View className="flex-1">
      <View className="gap-2.5 px-4 pt-1">
        <SearchField value={input} onChange={setInput}>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={t(SEARCH_PLACEHOLDER_KEY)} style={fieldSurface} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <SegmentedControl options={scopeOptions} value={scope} onChange={setScope} />
      </View>

      {keyword.length === 0 ? (
        /*
         * 空输入时下半屏只有一张统计图 —— 让它在**剩余空间里垂直居中**，
         * 而不是贴着搜索框往下堆。`contentContainerStyle.flexGrow = 1` 是
         * `justifyContent` 生效的前提（ScrollView 的容器默认按内容高度撑开）。
         * 屏幕太矮时仍然可以滚，不会把图表裁掉。
         */
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <DatabaseStats />
        </ScrollView>
      ) : (
        <View className="flex-1 pt-2">
          {scope === "vn" ? (
            <VnSearchResults keyword={keyword} />
          ) : scope === "user" ? (
            <UserSearchResults keyword={keyword} />
          ) : scope === "tag" ? (
            <TagSearchResults keyword={keyword} />
          ) : (
            <CatalogSearchResults scope={scope} keyword={keyword} />
          )}
        </View>
      )}
    </View>
  );
}
