/**
 * 首页常用入口。
 *
 * 四个入口的排序逻辑参照 vndb-lite 的 `HomeSectionsCode`（我的收藏 /
 * Top Rated / Top Voted / Popular Ongoing），另外补一个 vndb.org 有而
 * vndb-lite 没有的「我的评分排名」。
 *
 * 「我的评分排名」的语义：把自己打过分的所有 VN 按**全球评分**排出名次，
 * 并显示自己打的那一分在其中的位置。vndb.org 的「rating rank」就是这个意思。
 * 需要登录（要读自己的清单），游客态显示引导。
 */

import { useRouter } from "expo-router";
import { Typography, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

import { Icon, type IconName } from "@/components/Icon";
import { Muted } from "@/components/Typo";
import { useSession } from "@/hooks/useSession";

interface Entry {
  id: string;
  label: string;
  hint: string;
  icon: IconName;
  onPress: () => void;
}

export function QuickEntries(): JSX.Element {
  const router = useRouter();
  const session = useSession();
  const isLoggedIn = session.status === "authenticated";
  const accent = useThemeColor("accent");

  const entries: Entry[] = [
    {
      id: "collection",
      label: "我的游戏",
      hint: isLoggedIn ? "清单与打分" : "需登录",
      icon: "folderOpen",
      onPress: () => router.push("/(tabs)/list"),
    },
    {
      id: "top-rated",
      label: "评分排行",
      hint: "全站最高分",
      icon: "star",
      onPress: () => router.push("/(tabs)/explore?sort=rating"),
    },
    {
      id: "my-rank",
      label: "我的评分排名",
      hint: isLoggedIn ? "我在全球的位置" : "需登录",
      icon: "medal",
      onPress: () => router.push("/rank"),
    },
    {
      id: "popular-ongoing",
      label: "近期热门",
      hint: "开发中的热门",
      icon: "flame",
      onPress: () => router.push("/(tabs)/explore?sort=votecount&ongoing=1"),
    },
  ];

  return (
    <View className="flex-row flex-wrap gap-2 px-4 pb-2">
      {entries.map((entry) => (
        <Pressable
          key={entry.id}
          onPress={entry.onPress}
          className="flex-1 min-w-[45%] flex-row items-center gap-2.5 rounded-xl bg-default-soft px-3 py-3 active:opacity-60"
          accessibilityRole="button"
          accessibilityLabel={entry.label}
        >
          {/* 图标走主题 accent，之前写死 #F31260 换主题后完全对不上 */}
          <Icon name={entry.icon} size={20} color={accent} />
          <View className="flex-1">
            <Typography type="body-sm" className="font-medium">
              {entry.label}
            </Typography>
            <Muted type="body-xs" className="text-[10px]">
              {entry.hint}
            </Muted>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
