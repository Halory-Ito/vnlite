/**
 * VN 详情 · 关联作品页签。
 *
 * 拆成独立页签的原因：关联作品可能很多（同系列动辄十几部），
 * 混在概览里既挤又难扫。
 *
 * 顺带按关联类型分组：用户找「续作」和找「同一世界观」是两种意图，
 * 平铺在一起时得一条条读类型标签才知道。
 */

import { Link } from "expo-router";
import type { JSX } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { CoverImage } from "@/components/cover-image";
import { EmptyState } from "@/components/screen-state";
import { Divider } from "@/components/separator";
import { Muted, Paragraph } from "@/components/typo";
import { SectionHeader } from "@/components/ui";
import { useTranslation } from "@/hooks/use-translation";
import type { VnDetail } from "@/lib/api/types";
import { formatReleased, relationLabel } from "@/utils/format";

type Relation = NonNullable<VnDetail["relations"]>[number];

export function VnRelationsTab({ vn }: { vn: VnDetail }): JSX.Element {
  const { t } = useTranslation();
  const relations = vn.relations ?? [];
  if (relations.length === 0) {
    return (
      <EmptyState
        title={t("vn.relationsEmptyTitle")}
        description={t("vn.relationsEmptyDescription")}
      />
    );
  }

  /*
   * 按关联类型分组，但**保持 API 返回的相对顺序** ——
   * 官方关联通常排在非官方前面，重排会让「官方」信息失去意义。
   */
  const groups = new Map<string, Relation[]>();
  for (const rel of relations) {
    const key = rel.relation ?? "other";
    const bucket = groups.get(key);
    if (bucket) bucket.push(rel);
    else groups.set(key, [rel]);
  }

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
      {[...groups.entries()].map(([relation, items], index) => (
        <View key={relation}>
          {index > 0 ? <Divider /> : null}
          <SectionHeader title={relationLabel(relation)} />
          <View className="pb-2">
            {items.map((rel) => (
              <RelationRow key={rel.id} rel={rel} />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function RelationRow({ rel }: { rel: Relation }): JSX.Element {
  const { t } = useTranslation();
  return (
    <Link href={`/vn/${rel.id}`} asChild>
      <Pressable className="flex-row items-center gap-3 px-4 py-2 active:opacity-60">
        <CoverImage
          url={rel.image?.url}
          width={48}
          height={[48, 64]}
          sexual={rel.image?.sexual}
          violence={rel.image?.violence}
          roundedClassName="rounded"
        />
        <View className="flex-1">
          <Paragraph className="text-sm" numberOfLines={2}>
            {rel.title}
          </Paragraph>
          <View className="mt-0.5 flex-row flex-wrap items-center gap-x-2">
            <Muted type="body-xs">{rel.id}</Muted>
            {rel.released ? <Muted type="body-xs">{formatReleased(rel.released)}</Muted> : null}
            <Muted type="body-xs" className={rel.relation_official ? "text-accent" : undefined}>
              {rel.relation_official ? t("vn.official") : t("vn.unofficial")}
            </Muted>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}
