import { BlurTargetView } from "expo-blur";
import { useCallback, useContext, type ComponentRef, type ReactNode } from "react";
import { Platform, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppBackground } from "@/components/app-background";
import { BackgroundContext } from "@/theme/background-context";

export function TabBlurTarget({
  routeKey,
  onTarget,
  includeBackground = true,
  children,
}: {
  routeKey: string;
  onTarget: (key: string, target: ComponentRef<typeof View> | null) => void;
  includeBackground?: boolean;
  children: ReactNode;
}) {
  const background = useContext(BackgroundContext);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const setTarget = useCallback(
    (target: ComponentRef<typeof View> | null) => onTarget(routeKey, target),
    [onTarget, routeKey]
  );

  return (
    <BlurTargetView ref={setTarget} style={{ flex: 1 }}>
      {includeBackground && Platform.OS === "android" && background ? (
        // Only the bar needs a background inside the sampling target. Keeping
        // its dark base off the rest of the scene avoids a full-page flash.
        <View
          pointerEvents="none"
          className="absolute inset-x-0 bottom-0 overflow-hidden"
          style={{ height: 64 + Math.max(insets.bottom, 12) }}
        >
          <View className="absolute inset-x-0 bottom-0" style={{ height }}>
            <AppBackground {...background} transitionDuration={0} />
          </View>
        </View>
      ) : null}
      {children}
    </BlurTargetView>
  );
}
