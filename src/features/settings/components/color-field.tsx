/**
 * 颜色输入：一行预设色块 + 一个十六进制输入框。
 *
 * 没有引第三方取色器（多一个原生依赖、还很难做到和主题一致），
 * 实际用起来「挑个接近的色 + 需要时改 hex」这条路径够用：
 * 预设覆盖常用的冷暖色，想精确就输 `#rrggbb`。
 *
 * 输入不合法时**不覆盖**当前颜色，只标红提示 —— 输到一半的 `#12` 不该被当成有效值。
 */

import { Input, Label, TextField } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Muted } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";
import { normalizeHexColor } from "@/theme/custom-theme";

/** 预设色板：饱和 / 明度都经过挑选，走 `deriveTokens` 后明暗两套都不会崩 */
const PRESET_COLORS = [
  "#5082E1",
  "#6EC8D2",
  "#27AE60",
  "#B4DCFF",
  "#F0AA64",
  "#F2994A",
  "#EB5757",
  "#FF4696",
  "#9B51E0",
  "#AFAFAF",
  "#463232",
  "#141414",
] as const;

export interface ColorFieldProps {
  label: string;
  /** 当前生效的 `#rrggbb` */
  value: string;
  onChange: (hex: string) => void;
}

export function ColorField({ label, value, onChange }: ColorFieldProps): JSX.Element {
  const { t } = useTranslation();
  /**
   * 正在输入的原始文本。
   *
   * 不用 `useEffect` 把外部 `value` 同步回 state（lint 会拦 set-state-in-effect，
   * 也确实会多一轮渲染）：没动过输入框时直接显示 `value`，动过之后
   * 显示用户自己敲的东西 —— 本轮编辑由本组件发起，不需要跟外部值对齐。
   */
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? value;
  const invalid = draft !== null && draft.trim().length > 0 && normalizeHexColor(draft) === null;

  const handleChange = (next: string): void => {
    setDraft(next);
    const hex = normalizeHexColor(next);
    if (hex) onChange(hex);
  };

  const pickPreset = (hex: string): void => {
    setDraft(hex);
    onChange(hex);
  };

  return (
    <View className="gap-2">
      <TextField>
        <Label>{label}</Label>
        <Input
          value={text}
          onChangeText={handleChange}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="#rrggbb"
        />
      </TextField>

      {invalid ? (
        <Muted type="body-xs" className="text-danger-soft-foreground">
          {t("settings.colorInvalid")}
        </Muted>
      ) : null}

      <View className="flex-row flex-wrap gap-2">
        {PRESET_COLORS.map((hex) => (
          <Pressable
            key={hex}
            onPress={() => pickPreset(hex)}
            accessibilityRole="button"
            accessibilityLabel={hex}
            hitSlop={4}
            className={`h-8 w-8 rounded-full border-2 active:opacity-70 ${
              value.toLowerCase() === hex.toLowerCase() ? "border-accent" : "border-border"
            }`}
            style={{ backgroundColor: hex }}
          />
        ))}
      </View>
    </View>
  );
}
