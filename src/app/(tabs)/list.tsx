/**
 * 清单 Tab。
 *
 * M1 阶段是占位：清单数据属于「用户数据」，需要登录（Token），
 * 按 C1 决策落 SQLite，到 M2/M3 真正实现。
 */

import { Link } from "expo-router";
import { Button, Card } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

import { H5, Muted, Paragraph } from "@/components/Typo";
import { useSession } from "@/hooks/useSession";

export default function ListTab(): JSX.Element {
  const session = useSession();

  return (
    <View className="flex-1 gap-4 px-4 pt-1">
      <H5>我的清单</H5>

      {session.status === "authenticated" ? (
        <Card>
          <Card.Body>
            <Paragraph>已登录：{session.account.username}</Paragraph>
            <Muted type="body-xs">
              权限：{session.account.permissions.join(" / ") || "仅读公开数据"}
            </Muted>
          </Card.Body>
        </Card>
      ) : null}

      <Card>
        <Card.Body>
          <Paragraph>清单功能将在 M3 开放</Paragraph>
          <Muted type="body-xs">
            需要先在「我的」页粘贴 VNDB Token 登录。清单是你的数据，按规划会存在本地
            SQLite，离线也能看。
          </Muted>
        </Card.Body>
        <Card.Footer>
          <Link href="/(tabs)/me" asChild>
            <Button size="sm">
              <Button.Label>去登录</Button.Label>
            </Button>
          </Link>
        </Card.Footer>
      </Card>
    </View>
  );
}
