import { Button, Dialog, InputOTP, REGEXP_ONLY_DIGITS, Typography } from "heroui-native";
import { useId } from "react";
import {
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";

import { useTranslation } from "@/hooks/use-translation";
import { isValidDate } from "@/utils/date";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  onDateChange: (date: string) => void;
  onConfirm: () => void;
}

export function ReleaseCalendarJump({ open, onOpenChange, date, onDateChange, onConfirm }: Props) {
  const { t } = useTranslation();
  const accessoryId = useId();
  const [year, month] = date.split("-");
  const valid = isValidDate(`${year}-${month}-01`);
  // The day is internally fixed to 01 for month navigation; keep it out of the OTP value.
  const digits = `${year ?? ""}${month ?? ""}`.replace(/\D/g, "").slice(0, 6);
  const updateDate = (value: string) => {
    const next = value.replace(/\D/g, "").slice(0, 6);
    onDateChange(next.length <= 4 ? next : `${next.slice(0, 4)}-${next.slice(4)}-01`);
  };
  const confirm = () => {
    if (!valid) return;
    Keyboard.dismiss();
    onConfirm();
  };
  return (
    <Dialog isOpen={open} onOpenChange={onOpenChange}>
      <Dialog.Portal className="items-center justify-center p-4">
        <Dialog.Overlay className="bg-transparent" isCloseOnPress />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="w-full items-center justify-center"
          pointerEvents="box-none"
        >
          <Dialog.Content className="w-full max-w-[360px] self-center p-5">
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerClassName="gap-4"
              bounces={false}
            >
              <Dialog.Title className="text-base font-semibold">
                {t("home.jumpToDate")}
              </Dialog.Title>
              <View className="items-center gap-1 pt-1">
                <InputOTP
                  value={digits}
                  onChange={updateDate}
                  maxLength={6}
                  pattern={REGEXP_ONLY_DIGITS}
                  inputMode="numeric"
                  placeholder="YYYYMM"
                  textInputProps={{
                    accessibilityLabel: `${t("home.jumpYear")} / ${t("home.jumpMonth")}`,
                    returnKeyType: "done",
                    submitBehavior: "submit",
                    onSubmitEditing: confirm,
                    inputAccessoryViewID: Platform.OS === "ios" ? accessoryId : undefined,
                  }}
                  style={{ gap: 6, alignSelf: "center" }}
                >
                  <InputOTP.Group style={{ gap: 4 }}>
                    {[0, 1, 2, 3].map((index) => (
                      <InputOTP.Slot key={index} index={index} style={{ width: 30, height: 40 }} />
                    ))}
                  </InputOTP.Group>
                  <Typography type="body-sm" className="text-muted">
                    {t("home.jumpYear")}
                  </Typography>
                  <InputOTP.Separator />
                  <InputOTP.Group style={{ gap: 4 }}>
                    {[4, 5].map((index) => (
                      <InputOTP.Slot key={index} index={index} style={{ width: 30, height: 40 }} />
                    ))}
                  </InputOTP.Group>
                  <Typography type="body-sm" className="text-muted">
                    {t("home.jumpMonth")}
                  </Typography>
                </InputOTP>
              </View>
              <Button
                onPress={confirm}
                isDisabled={!valid}
                size="md"
                variant="primary"
                className="w-full"
              >
                <Button.Label>{t("home.timeLeap")}</Button.Label>
              </Button>
            </ScrollView>
            {Platform.OS === "ios" ? (
              <InputAccessoryView nativeID={accessoryId}>
                <View className="items-end border-t border-border bg-background px-4 py-2">
                  <Button size="sm" variant="ghost" onPress={confirm} isDisabled={!valid}>
                    <Button.Label>{t("common.confirm")}</Button.Label>
                  </Button>
                </View>
              </InputAccessoryView>
            ) : null}
          </Dialog.Content>
        </KeyboardAvoidingView>
      </Dialog.Portal>
    </Dialog>
  );
}
