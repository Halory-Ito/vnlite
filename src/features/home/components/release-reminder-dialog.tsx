import { Button, Dialog } from "heroui-native";
import { View } from "react-native";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirm: string;
  cancel?: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ReleaseReminderDialog(props: Props) {
  return (
    <Dialog
      isOpen={props.open}
      onOpenChange={(open) => {
        if (!open && !props.pending) props.onClose();
      }}
    >
      <Dialog.Portal className="items-center justify-center p-4">
        <Dialog.Overlay />
        <Dialog.Content className="w-full max-w-[400px] self-center gap-4 p-5">
          <Dialog.Title>{props.title}</Dialog.Title>
          <Dialog.Description>{props.message}</Dialog.Description>
          <View className="gap-2">
            <Button isDisabled={props.pending} onPress={props.onConfirm}>
              <Button.Label>{props.confirm}</Button.Label>
            </Button>
            {props.cancel ? (
              <Button variant="secondary" isDisabled={props.pending} onPress={props.onClose}>
                <Button.Label>{props.cancel}</Button.Label>
              </Button>
            ) : null}
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
