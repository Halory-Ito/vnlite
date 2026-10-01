/**
 * 关于页：版本 / 数据源 / 免责声明。
 *
 * 版本号取 `app.json`，不手写 —— 免得改了配置忘了这里。
 */

import Constants from "expo-constants";
import type { JSX } from "react";
import { View } from "react-native";

import { KeyValueRow } from "@/components/ui";
import { Muted } from "@/components/typo";
import { SettingsShell } from "@/features/settings/components/settings-shell";

const VERSION = Constants.expoConfig?.version ?? "1.0.0";

export default function AboutScreen(): JSX.Element {
  return (
    <SettingsShell title="关于">
      {/* KeyValueRow 自带 px-4，这里不要再套一层 */}
      <View className="gap-1 py-3">
        <KeyValueRow label="版本">
          <Muted type="body-sm">{VERSION}</Muted>
        </KeyValueRow>
        <KeyValueRow label="数据源">
          <Muted type="body-sm">VNDB Kana API（api.vndb.org/kana）</Muted>
        </KeyValueRow>
        <KeyValueRow label="图标">
          <Muted type="body-sm">Gravity UI Icons（MIT License）</Muted>
        </KeyValueRow>
      </View>

      <View className="px-4 py-3">
        <Muted type="body-xs">
          本应用为非官方第三方客户端，与 VNDB 无关。数据遵循 VNDB Data License。
        </Muted>
      </View>
    </SettingsShell>
  );
}
