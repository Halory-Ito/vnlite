/**
 * 内容显示设置：成人内容档位 / 剧透保护 / 每页条数。
 */

import { ListGroup, Switch, useThemeColor } from "heroui-native";
import type { JSX } from "react";

import { Icon } from "@/components/icon";
import { SegmentedControl } from "@/components/segmented-control";
import { SettingsSection, SettingsShell } from "@/features/settings/components/settings-shell";
import { NSFW_OPTIONS, PAGE_SIZE_OPTIONS } from "@/features/settings/options";
import { usePreferences } from "@/hooks/use-preferences";
import { setPreference } from "@/lib/storage/preferences";

export default function ContentScreen(): JSX.Element {
  const preferences = usePreferences();
  const accent = useThemeColor("accent");

  return (
    <SettingsShell title="内容显示">
      <SettingsSection title="成人内容">
        <SegmentedControl
          options={NSFW_OPTIONS}
          value={preferences.nsfwMode}
          onChange={(value) => setPreference("nsfwMode", value)}
        />
      </SettingsSection>

      <SettingsSection
        title="剧透保护"
        hint="开启后攻略页签的结局名、达成条件与步骤内容默认打码，点一下才显示"
      >
        {/*
         * 这里手写 ListGroup.Item 而不是复用 `SettingsItem`：那个组件的右槽位
         * 画的是「读数 + 箭头」，给 Switch 就得整体换掉 `suffix`，
         * 与其绕一层不如直接用 ListGroup 的原语（外观 / 关于等页仍用 SettingsItem）。
         */}
        <ListGroup>
          <ListGroup.Item>
            <ListGroup.ItemPrefix>
              <Icon name="eye" size={20} color={accent} />
            </ListGroup.ItemPrefix>
            <ListGroup.ItemContent>
              <ListGroup.ItemTitle>隐藏攻略内容</ListGroup.ItemTitle>
            </ListGroup.ItemContent>
            <ListGroup.ItemSuffix>
              <Switch
                isSelected={preferences.spoilerShield}
                onSelectedChange={(value: boolean) => setPreference("spoilerShield", value)}
              />
            </ListGroup.ItemSuffix>
          </ListGroup.Item>
        </ListGroup>
      </SettingsSection>

      <SettingsSection title="每页条数">
        <SegmentedControl
          options={PAGE_SIZE_OPTIONS.map((size) => ({ value: size, label: size }))}
          value={String(preferences.pageSize)}
          onChange={(value) => setPreference("pageSize", Number(value))}
        />
      </SettingsSection>
    </SettingsShell>
  );
}
