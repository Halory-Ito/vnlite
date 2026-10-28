/**
 * 「选择题材」全屏面板。
 *
 * 选 / 取消题材、删除题材、搜新题材进来都在这一个面板里完成 ——
 * 名次列表要占半屏，题材行一长在横向滚动里既看不清选了哪些、也点不中。
 * 壳走 `browse` 的 `FullScreenPanel`（同层覆盖层，原因见其头注释）。
 *
 * 结构自上而下：
 *   - 题材搜索（`tag-search.tsx`）：结果点一下加入列表并选中
 *   - 「已选」：当前命中的题材，一目了然，点 chip 取消
 *   - 「题材列表」：全部候选勾选切换；右上角「编辑」进入删除模式，
 *     每个题材带 × 点一下从列表删掉（自己加的删除、候选的进屏蔽名单）
 */

import { useThemeColor, Typography } from "heroui-native";
import type { JSX, ReactNode } from "react";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/icon";
import { Muted } from "@/components/typo";
import { FilterChip } from "@/features/browse/components/filter-group";
import { FullScreenPanel } from "@/features/browse/components/panel";
import { TagSearch } from "@/features/browse/components/tag-search";
import { useTranslation } from "@/hooks/use-translation";

import type { TagLite } from "@/lib/api/types";

export interface TagPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** 完整题材列表（基础候选 ∪ 自加 − 已删除） */
  pool: readonly TagLite[];
  selected: readonly string[];
  onToggle: (id: string) => void;
  /** 从列表删除（id 集合交给调用方，屏幕同一份状态） */
  onRemove: (ids: readonly string[]) => void;
  /** 搜索结果加入列表（并选中） */
  onAddTags: (tags: readonly TagLite[]) => void;
}

export function TagPanel({
  isOpen,
  onClose,
  pool,
  selected,
  onToggle,
  onRemove,
  onAddTags,
}: TagPanelProps): JSX.Element | null {
  const { t } = useTranslation();
  const muted = useThemeColor("muted");
  /** 编辑模式：chips 带 ×，点一下从列表删除 */
  const [managing, setManaging] = useState(false);
  const poolIds = useMemo(() => new Set(pool.map((tag) => tag.id)), [pool]);

  if (!isOpen) return null;

  return (
    <FullScreenPanel
      title={t("ranking.pickTag")}
      accessibilityLabel={t("ranking.pickTag")}
      onClose={onClose}
    >
      <TagSearch poolIds={poolIds} onAddTags={onAddTags} autoFocus />

      {selected.length > 0 ? (
        <Section title={t("ranking.selectedTitle")}>
          {pool
            .filter((tag) => selected.includes(tag.id))
            .map((tag) => (
              <FilterChip
                key={tag.id}
                option={{ value: tag.id, label: tag.name }}
                active
                onPress={() => onToggle(tag.id)}
              />
            ))}
        </Section>
      ) : null}

      <Section
        title={t("ranking.poolTitle")}
        action={
          pool.length > 0 ? (
            <Pressable
              onPress={() => setManaging((prev) => !prev)}
              className="rounded-full px-2 py-0.5 active:opacity-60"
              accessibilityRole="button"
              accessibilityState={{ expanded: managing }}
            >
              <Typography type="body-xs" className="text-accent">
                {managing ? t("common.finish") : t("common.edit")}
              </Typography>
            </Pressable>
          ) : null
        }
      >
        {pool.length === 0 ? (
          <Muted type="body-xs" className="py-2">
            {t("ranking.tagPoolEmpty")}
          </Muted>
        ) : (
          pool.map((tag) => (
            <PoolChip
              key={tag.id}
              label={tag.name}
              active={!managing && selected.includes(tag.id)}
              managing={managing}
              muted={muted}
              onPress={() => (managing ? onRemove([tag.id]) : onToggle(tag.id))}
            />
          ))
        )}
      </Section>
    </FullScreenPanel>
  );
}

/** 面板里的一节：标题行（可带右侧动作）+ 流式排布的内容 */
function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Typography type="body-sm" className="font-semibold">
          {title}
        </Typography>
        {action}
      </View>
      <View className="flex-row flex-wrap items-start gap-1.5">{children}</View>
    </View>
  );
}

/**
 * 题材列表里的 chip：普通模式点选切换（选中态与 `FilterChip` 一致），
 * 编辑模式带一把 ×，点一下从列表删除。
 *
 * 高度显式写死：换选中态 / 重新渲染的瞬间（类名重算）不能让 flex 容器
 * 把它拉高（见 `calendar-day` 同样的处理方式）。
 */
const CHIP_HEIGHT = 32;

function PoolChip({
  label,
  active,
  managing,
  muted,
  onPress,
}: {
  label: string;
  active: boolean;
  managing: boolean;
  muted: string;
  onPress: () => void;
}): JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 active:opacity-70 ${
        active ? "border-accent bg-accent-soft" : "border-border bg-default-soft"
      }`}
      style={{
        height: CHIP_HEIGHT,
        alignItems: "center",
        justifyContent: "center",
      }}
      accessibilityRole={managing ? "button" : "checkbox"}
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
    >
      {managing ? <Icon name="xmark" size={12} color={muted} /> : null}
      <Typography type="body-xs" className={active ? "font-semibold text-accent" : "text-muted"}>
        {label}
      </Typography>
    </Pressable>
  );
}
