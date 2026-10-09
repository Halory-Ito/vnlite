/**
 * 游玩记录 · 列表视图。
 *
 * 每一次游玩一行：日期 + 起止时间 + 时长。按开始时间倒序（DAO 已排好）。
 */

import type { JSX } from "react";
import { ScrollView, View } from "react-native";

import { Divider } from "@/components/separator";
import { Muted } from "@/components/typo";
import type { PlaySession } from "@/lib/db/dao/play-session";

import { formatClock, formatPlayDuration, formatSessionDate } from "../format";

export function PlayRecordsList({ sessions }: { sessions: PlaySession[] }): JSX.Element {
  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
      {sessions.map((session, index) => (
        <View key={session.id}>
          {index > 0 ? <Divider className="mx-4" /> : null}
          <View className="flex-row items-center justify-between gap-3 px-4 py-3">
            <View className="flex-1 gap-0.5">
              <Muted type="body-sm">{formatSessionDate(session.startedAt)}</Muted>
              <Muted type="body-xs" className="opacity-70">
                {formatClock(session.startedAt)} – {formatClock(session.endedAt)}
              </Muted>
            </View>
            <Muted type="body-sm" className="font-semibold text-accent">
              {formatPlayDuration(session.durationMs)}
            </Muted>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
