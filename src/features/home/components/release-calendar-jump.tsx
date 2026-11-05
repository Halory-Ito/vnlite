import { Button, Dialog } from "heroui-native";
import { View } from "react-native";
import { DateOtpField } from "@/components/date-otp-field";
import { useTranslation } from "@/hooks/use-translation";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  onDateChange: (date: string) => void;
  onConfirm: () => void;
}

export function ReleaseCalendarJump({ open, onOpenChange, date, onDateChange, onConfirm }: Props) {
  const { t } = useTranslation();
  return (
    <Dialog isOpen={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-transparent" isCloseOnPress />
        <Dialog.Content className="w-full max-w-[360px] gap-4 p-5">
          <Dialog.Title className="text-base font-semibold">{t("home.jumpToDate")}</Dialog.Title>
          <View className="w-full items-center pt-1">
            <DateOtpField label={t("home.jumpDateLabel")} value={date} onChange={onDateChange} />
          </View>
          <Button onPress={onConfirm} size="md" variant="primary" className="w-full">
            <Button.Label>{t("home.jumpToDate")}</Button.Label>
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
