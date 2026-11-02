import { Skeleton } from "heroui-native";
import { View } from "react-native";

/** 先约束正方形容器，再让骨架填满，避免最大宽度与纵横比组合导致椭圆。 */
export function GoalRingSkeleton() {
  return (
    <View className="w-full items-center py-1">
      <View className="aspect-square w-full max-w-28 overflow-hidden rounded-full">
        <Skeleton className="absolute inset-0 rounded-full" />
      </View>
    </View>
  );
}
