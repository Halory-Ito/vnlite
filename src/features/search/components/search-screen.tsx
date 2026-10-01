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
import { View } from "react-native";

import { SegmentedControl } from "@/components/segmented-control";
import { DatabaseStats } from "@/features/stats/database-stats";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

import { SCOPE_OPTIONS, SEARCH_PLACEHOLDER, type SearchScope } from "../search-logic";

import { CatalogSearchResults } from "./catalog-search-results";
import { UserSearchResults } from "./user-search-results";
import { VnSearchResults } from "./vn-search-results";

const DEBOUNCE_MS = 350;

export function SearchScreen(): JSX.Element {
  // 默认「作品」：绝大多数搜索意图是找作品
  const [scope, setScope] = useState<SearchScope>("vn");
  const [input, setInput] = useState("");
  const keyword = useDebouncedValue(input, DEBOUNCE_MS).trim();

  return (
    <View className="flex-1">
      <View className="gap-2.5 px-4 pt-1">
        <SearchField value={input} onChange={setInput}>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={SEARCH_PLACEHOLDER} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <SegmentedControl options={SCOPE_OPTIONS} value={scope} onChange={setScope} />
      </View>

      {keyword.length === 0 ? (
        <View className="flex-1">
          <DatabaseStats />
        </View>
      ) : (
        <View className="flex-1 pt-2">
          {scope === "vn" ? (
            <VnSearchResults keyword={keyword} />
          ) : scope === "user" ? (
            <UserSearchResults keyword={keyword} />
          ) : (
            <CatalogSearchResults scope={scope} keyword={keyword} />
          )}
        </View>
      )}
    </View>
  );
}
