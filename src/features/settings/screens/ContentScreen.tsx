/**
 * 内容显示设置：成人内容档位 / 每页条数。
 */

import type { JSX } from "react";

import { SegmentedControl } from "@/components/SegmentedControl";
import { SettingsSection, SettingsShell } from "@/features/settings/components/SettingsShell";
import { NSFW_OPTIONS, PAGE_SIZE_OPTIONS } from "@/features/settings/options";
import { usePreferences, useSetPreference } from "@/hooks/usePreferences";

export default function ContentScreen(): JSX.Element {
  const preferences = usePreferences();
  const setPreference = useSetPreference;

  return (
    <SettingsShell title="内容显示">
      <SettingsSection title="成人内容（封面 / 截图 / 立绘）" hint="模糊档下可双击封面单独显示">
        <SegmentedControl
          options={NSFW_OPTIONS}
          value={preferences.nsfwMode}
          onChange={(value) => setPreference("nsfwMode", value)}
        />
      </SettingsSection>

      <SettingsSection title="每页条数（上限 100）">
        <SegmentedControl
          options={PAGE_SIZE_OPTIONS.map((size) => ({ value: size, label: size }))}
          value={String(preferences.pageSize)}
          onChange={(value) => setPreference("pageSize", Number(value))}
        />
      </SettingsSection>
    </SettingsShell>
  );
}
