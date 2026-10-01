import { Link } from "expo-router";
import type { JSX } from "react";
import { View } from "react-native";

import { EmptyState } from "@/components/screen-state";
import { LinkText } from "@/components/typo";

export default function NotFoundScreen(): JSX.Element {
  return (
    <View className="flex-1 justify-center">
      <EmptyState
        title="页面不存在"
        description="链接可能已失效"
        action={
          <Link href="/(tabs)" className="mt-2">
            <LinkText>回到首页</LinkText>
          </Link>
        }
      />
    </View>
  );
}
