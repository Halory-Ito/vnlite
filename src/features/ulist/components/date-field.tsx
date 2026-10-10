/**
 * 日期输入（开始 / 完成）。
 *
 * VNDB 的日期格式固定 `YYYY-MM-DD`，没有第三方日期选择器（Expo Go 约束），
 * 用文本输入 + 「今天 / 清除」快捷键；格式校验在保存时统一做。
 */

import { Input, Typography } from "heroui-native";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

import { Muted } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";
import { todayIso } from "@/utils/format";

export interface DateFieldProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  /** 校验错误文案（null = 合法） */
  error?: string | null;
}

export function DateField({ label, value, onChange, error = null }: DateFieldProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <Muted type="body-xs" className="font-medium">
          {label}
        </Muted>
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => onChange(todayIso())}
            className="active:opacity-60"
            accessibilityRole="button"
            accessibilityLabel={t("ulist.setToday", { label })}
          >
            <Typography type="body-xs" className="text-accent">
              {t("ulist.today")}
            </Typography>
          </Pressable>
          {value !== "" ? (
            <Pressable
              onPress={() => onChange("")}
              className="active:opacity-60"
              accessibilityRole="button"
              accessibilityLabel={t("ulist.clearField", { label })}
            >
              <Typography type="body-xs" className="text-muted">
                {t("common.clear")}
              </Typography>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Input
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={label}
      />

      {error ? (
        <Muted type="body-xs" className="text-danger-soft-foreground">
          {error}
        </Muted>
      ) : null}
    </View>
  );
}
