/**
 * VN 详情 · 制作页签。
 *
 * 两部分：制作人员（按职位分组）+ 配音（角色 → 声优）。
 * 数据来自概览响应，所以没有额外请求。
 */

import { Link } from "expo-router";
import type { JSX } from "react";
import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { EmptyState } from "@/components/screen-state";
import { Muted, Paragraph } from "@/components/typo";
import { SectionHeader } from "@/components/ui";
import type { VnDetail, VnStaff } from "@/lib/api/types";
import { staffRoleLabel } from "@/utils/format";

export function VnStaffTab({ vn }: { vn: VnDetail }): JSX.Element {
  const staff = useMemo(() => vn.staff ?? [], [vn.staff]);
  const va = vn.va ?? [];

  // 按职位分组，保持 API 返回顺序（官方的职位顺序本身有意义）
  const groups = useMemo(() => {
    const map = new Map<string, VnStaff[]>();
    for (const person of staff) {
      const role = person.role ?? "staff";
      const bucket = map.get(role);
      if (bucket) bucket.push(person);
      else map.set(role, [person]);
    }
    return [...map.entries()];
  }, [staff]);

  if (staff.length === 0 && va.length === 0) {
    return <EmptyState title="没有登记制作人员" />;
  }

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
      {groups.map(([role, people]) => (
        <View key={role}>
          <SectionHeader title={staffRoleLabel(role)} />
          <View className="px-4 pb-3">
            {people.map((person, i) => (
              <Link key={`${person.id}-${i}`} href={`/staff/${person.id}`} asChild>
                <Pressable className="flex-row items-baseline gap-2 py-1 active:opacity-60">
                  <Paragraph className="text-sm">{person.name}</Paragraph>
                  {person.original && person.original !== person.name ? (
                    <Muted type="body-xs" numberOfLines={1}>
                      {person.original}
                    </Muted>
                  ) : null}
                  {person.note ? (
                    <Muted
                      type="body-xs"
                      className="flex-1 text-[10px] opacity-70"
                      numberOfLines={1}
                    >
                      {person.note}
                    </Muted>
                  ) : null}
                </Pressable>
              </Link>
            ))}
          </View>
        </View>
      ))}

      {va.length > 0 ? (
        <>
          <SectionHeader title="配音" />
          <View className="px-4 pb-8">
            {va.map((entry, i) =>
              entry.character ? (
                <View
                  key={`${entry.character.id}-${i}`}
                  className="flex-row items-center gap-2 py-1.5"
                >
                  <Link href={`/character/${entry.character.id}`} asChild>
                    <Pressable className="flex-1 active:opacity-60">
                      <Paragraph className="text-sm">{entry.character.name}</Paragraph>
                    </Pressable>
                  </Link>
                  {entry.staff ? (
                    <Link href={`/staff/${entry.staff.id}`} asChild>
                      <Pressable className="active:opacity-60">
                        <Muted type="body-xs" className="text-link">
                          {entry.staff.name}
                        </Muted>
                      </Pressable>
                    </Link>
                  ) : null}
                  {entry.note ? (
                    <Muted type="body-xs" className="text-[10px]">
                      {entry.note}
                    </Muted>
                  ) : null}
                </View>
              ) : null
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}
