import { useSafeAreaInsets } from "react-native-safe-area-context";

export function useTabContentPadding(): number {
  const insets = useSafeAreaInsets();
  return 80 + insets.bottom;
}
