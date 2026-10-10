/**
 * 搜索页 · 用户档的结果。
 *
 * ⚠️ Kana 的 `GET /user` **只支持精确匹配**（完整用户名，不区分大小写；
 * 或 `u123` 形式的 id），没有模糊搜索 —— 详见 `lib/api/endpoints/ulist#findUser`。
 * 所以这一档：最多一条结果、不翻页，且必须把限制说清楚，
 * 否则用户看到「搜不到人」会以为是自己输错了。
 */

import { useRouter } from "expo-router";
import type { JSX } from "react";
import { View } from "react-native";

import { EmptyState, ErrorState, LoadingState } from "@/components/screen-state";
import { Muted } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";

import { useUserLookup } from "../hooks";
import { resultHeadline, userMissDescription } from "../search-logic";

import { SearchResultRow } from "./search-result-row";

export function UserSearchResults({ keyword }: { keyword: string }): JSX.Element {
  const router = useRouter();
  const { t } = useTranslation();
  const query = useUserLookup(keyword);

  if (query.isLoading) return <LoadingState label={t("search.lookingUp")} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const user = query.data;
  if (!user) {
    return (
      <EmptyState title={t("search.userEmptyTitle")} description={userMissDescription(keyword)} />
    );
  }

  return (
    <View>
      <Muted type="body-xs" className="px-4 pb-1 pt-1">
        {resultHeadline(keyword)}
      </Muted>
      <SearchResultRow
        entry={{ id: user.id, title: user.username, meta: user.id }}
        onPress={(id) => router.push(`/user/${id}`)}
      />
    </View>
  );
}
