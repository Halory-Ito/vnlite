/**
 * VN 详情 · 角色页签。
 *
 * 数据独立请求（列表页的字段集不含角色），所以没进这个页签就不会发请求。
 *
 * 顶部按 VNDB 的**角色定位**分档：主角 / 主要角色 / 次要角色 / 登场
 * （对应 `main` / `primary` / `side` / `appears`）。
 * 弹丸论破那种「1 主角 + 16 主要 + 2 次要 + 4 登场」的分布，
 * 平铺在一起根本没法扫，必须先分档再列。
 */

import { Link } from "expo-router";
import { Tabs, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { CoverImage } from "@/components/cover-image";
import { Icon } from "@/components/icon";
import { EmptyState, ErrorState, LoadingState } from "@/components/screen-state";
import { Muted, Paragraph } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";
import type { CharacterRole } from "@/lib/api/enums";
import type { Character } from "@/lib/api/types";
import { characterRoleLabel } from "@/utils/format";

import { useVnCharacters } from "../hooks";

/** 分档顺序 = 重要程度，页签也按这个顺序排 */
const ROLE_ORDER: readonly CharacterRole[] = ["main", "primary", "side", "appears"];

/** 查不到定位（或出现未知枚举）时的兜底档：宁可多显示，也不要让角色凭空消失 */
const FALLBACK_ROLE: CharacterRole = "primary";

export function VnCharactersTab({ vnId }: { vnId: string }): JSX.Element {
  // 跳转箭头取主题 muted（不能写死 iOS 系统灰 #8E8E93，换主题后对不上）
  const muted = useThemeColor("muted");
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch } = useVnCharacters(vnId);
  const [picked, setPicked] = useState<CharacterRole | null>(null);

  const groups = useMemo(() => groupByRole(data ?? [], vnId), [data, vnId]);

  if (isLoading) return <LoadingState label={t("vn.charactersLoading")} className="py-12" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data || data.length === 0) return <EmptyState title={t("vn.charactersEmpty")} />;

  const available = ROLE_ORDER.filter((role) => groups[role].length > 0);
  // 默认落在最重的一档（通常是「主要角色」）；用户点过之后听用户的
  const active = picked && available.includes(picked) ? picked : (available[0] ?? FALLBACK_ROLE);
  const shown = groups[active];

  return (
    <View className="flex-1">
      <Tabs value={active} onValueChange={(v) => setPicked(v as CharacterRole)}>
        <Tabs.List className="mx-4">
          {/* 4 档 + 计数在小屏上会挤，走 ScrollView，选中项会自动滚进视野 */}
          <Tabs.ScrollView>
            <Tabs.Indicator />
            {available.map((role) => (
              <Tabs.Trigger key={role} value={role}>
                <Tabs.Label>
                  {characterRoleLabel(role)} {groups[role].length}
                </Tabs.Label>
              </Tabs.Trigger>
            ))}
          </Tabs.ScrollView>
        </Tabs.List>
      </Tabs>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: 8 }}>
        {shown.map((c) => (
          <CharacterRow key={c.id} character={c} muted={muted} />
        ))}
        <View className="h-4" />
      </ScrollView>
    </View>
  );
}

function CharacterRow({ character, muted }: { character: Character; muted: string }): JSX.Element {
  return (
    <Link href={`/character/${character.id}`} asChild>
      <Pressable className="flex-row items-center gap-3 px-4 py-2 active:opacity-60">
        <CoverImage
          url={character.image?.thumbnail ?? character.image?.url}
          width={48}
          height={[48, 64]}
          sexual={character.image?.sexual}
          violence={character.image?.violence}
          disableToggle
        />
        <View className="flex-1">
          <Paragraph className="line-clamp-1 text-sm">{character.name}</Paragraph>
          {character.original && character.original !== character.name ? (
            <Muted type="body-xs" numberOfLines={1}>
              {character.original}
            </Muted>
          ) : null}
        </View>
        <Icon name="chevronRight" size={16} color={muted} />
      </Pressable>
    </Link>
  );
}

/** 按「这个角色在本作里的定位」分档 */
function groupByRole(
  characters: readonly Character[],
  vnId: string
): Record<CharacterRole, Character[]> {
  const groups: Record<CharacterRole, Character[]> = {
    main: [],
    primary: [],
    side: [],
    appears: [],
  };

  for (const character of characters) {
    const role = character.vns?.find((vn) => vn.id === vnId)?.role;
    const bucket = role && ROLE_ORDER.includes(role) ? role : FALLBACK_ROLE;
    groups[bucket].push(character);
  }

  return groups;
}
