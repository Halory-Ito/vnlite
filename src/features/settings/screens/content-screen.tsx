/**
 * 内容显示设置：成人内容档位 / 每页条数。
 */

import type { JSX } from "react";

import { SegmentedControl } from "@/components/segmented-control";
import { SettingsSection, SettingsShell } from "@/features/settings/components/settings-shell";
import { NSFW_OPTIONS, PAGE_SIZE_OPTIONS } from "@/features/settings/options";
import { usePreferences } from "@/hooks/use-preferences";
import { setPreference } from "@/lib/storage/preferences";

export default function ContentScreen(): JSX.Element {
  const preferences = usePreferences();

  return (
    <SettingsShell title="内容显示">
      <SettingsSection title="成人内容">
        <SegmentedControl
          options={NSFW_OPTIONS}
          value={preferences.nsfwMode}
          onChange={(value) => setPreference("nsfwMode", value)}
        />
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
