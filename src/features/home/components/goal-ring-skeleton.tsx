import { Skeleton } from "heroui-native";
import { useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { View } from "react-native";

export function GoalRingSkeleton() {
  const [size, setSize] = useState<number | null>(null);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0 && Math.abs((size ?? 0) - width) > 0.5) {
      setSize(width);
    }
  };

  return (
    <View className="w-full items-center py-1">
      <View
        className="aspect-square w-full max-w-28 items-center justify-center"
        onLayout={handleLayout}
      >
        {size !== null ? (
          <Skeleton
            style={{ width: size, height: size, borderRadius: size / 2 }}
            className="overflow-hidden"
          />
        ) : null}
      </View>
    </View>
  );
}
