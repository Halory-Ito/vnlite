import { useLayoutEffect } from "react";
import { Platform } from "react-native";
import { setBackgroundColorAsync } from "expo-system-ui";

/** Expo Blur uses the Android window drawable to clear each captured frame. */
export function useWindowBackground(background: string): void {
  useLayoutEffect(() => {
    if (Platform.OS !== "android") return;

    void setBackgroundColorAsync(background).catch((error: unknown) => {
      console.warn("Failed to synchronize the Android window background", error);
    });
  }, [background]);
}
