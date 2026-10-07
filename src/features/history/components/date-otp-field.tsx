/**
 * 日期输入（`InputOTP` 版）。
 *
 * 8 位数字 = `YYYYMMDD`，用**数字键盘逐位输入**，用户不必自己敲 `-`
 * （中英输入法来回切换太麻烦）。年 / 月 / 日三组之间用 `InputOTP.Separator`
 * 的小横条分隔，视觉上就是日期。
 *
 * 组件的值在外部是 **8 位数字串**（空串 = 未填），与 `history-constants` 的
 * `isoToDigits` / `digitsToIso` 互转。
 *
 * ⚠️ 槽位默认宽 `spacing*11`，8 个槽会超出手机宽度，所以用 `style` 收窄
 * （内联样式优先级高于组件自带的 CSS 类），并压小根 / 组间距。
 */

import { InputOTP, REGEXP_ONLY_DIGITS, Typography } from "heroui-native";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

import { Muted } from "@/components/typo";
import { todayIso } from "@/utils/format";

import { isoToDigits } from "../history-constants";

/** 收窄后的槽位尺寸（内联样式覆盖组件默认宽度） */
const SLOT_STYLE = { width: 30, height: 40 } as const;
const GROUP_STYLE = { gap: 4 } as const;

export interface DateOtpFieldProps {
  label: string;
  /** 8 位数字 `YYYYMMDD`，空串 = 未填 */
  value: string;
  onChange: (digits: string) => void;
  /** 校验错误文案（null = 合法） */
  error?: string | null;
}

export function DateOtpField({
  label,
  value,
  onChange,
  error = null,
}: DateOtpFieldProps): JSX.Element {
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <Muted type="body-xs" className="font-medium">
          {label}
        </Muted>
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => onChange(isoToDigits(todayIso()))}
            className="active:opacity-60"
            accessibilityRole="button"
            accessibilityLabel={`${label}设为今天`}
          >
            <Typography type="body-xs" className="text-accent">
              今天
            </Typography>
          </Pressable>
          {value !== "" ? (
            <Pressable
              onPress={() => onChange("")}
              className="active:opacity-60"
              accessibilityRole="button"
              accessibilityLabel={`清除${label}`}
            >
              <Typography type="body-xs" className="text-muted">
                清除
              </Typography>
            </Pressable>
          ) : null}
        </View>
      </View>

      <InputOTP
        value={value}
        onChange={onChange}
        maxLength={8}
        pattern={REGEXP_ONLY_DIGITS}
        inputMode="numeric"
        isInvalid={Boolean(error)}
        placeholder="YYYYMMDD"
        textInputProps={{ accessibilityLabel: label }}
        style={{ gap: 6 }}
      >
        <InputOTP.Group style={GROUP_STYLE}>
          {[0, 1, 2, 3].map((index) => (
            <InputOTP.Slot key={index} index={index} style={SLOT_STYLE} />
          ))}
        </InputOTP.Group>
        <InputOTP.Separator />
        <InputOTP.Group style={GROUP_STYLE}>
          {[4, 5].map((index) => (
            <InputOTP.Slot key={index} index={index} style={SLOT_STYLE} />
          ))}
        </InputOTP.Group>
        <InputOTP.Separator />
        <InputOTP.Group style={GROUP_STYLE}>
          {[6, 7].map((index) => (
            <InputOTP.Slot key={index} index={index} style={SLOT_STYLE} />
          ))}
        </InputOTP.Group>
      </InputOTP>

      {error ? (
        <Muted type="body-xs" className="text-danger-soft-foreground">
          {error}
        </Muted>
      ) : null}
    </View>
  );
}
