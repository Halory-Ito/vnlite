/** 「跳转到指定日期」弹窗（发售日历右上角）。 */

import { Button } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

import { DateOtpField } from "@/components/date-otp-field";
import { AppDialog } from "@/components/dialog";
import { useTranslation } from "@/hooks/use-translation";
import { dateFieldError, isValidDate } from "@/utils/date";

export interface JumpDialogProps {
  isOpen: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function JumpDialog({
  isOpen,
  value,
  onChange,
  onClose,
  onConfirm,
}: JumpDialogProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <AppDialog isOpen={isOpen} onClose={onClose} title={t("calendar.jumpTitle")}>
      <View className="gap-4 pb-2">
        <DateOtpField
          label={t("calendar.jumpDateLabel")}
          value={value}
          onChange={onChange}
          error={value ? (dateFieldError(value) ?? null) : null}
        />
        <View className="flex-row justify-end gap-2">
          <Button size="sm" variant="ghost" onPress={onClose}>
            <Button.Label>{t("common.cancel")}</Button.Label>
          </Button>
          <Button size="sm" onPress={onConfirm} isDisabled={!isValidDate(value)}>
            <Button.Label>{t("calendar.jumpConfirm")}</Button.Label>
          </Button>
        </View>
      </View>
    </AppDialog>
  );
}
