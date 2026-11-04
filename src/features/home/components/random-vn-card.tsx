import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Card, Skeleton } from "heroui-native";
import type { JSX } from "react";
import { Pressable, View } from "react-native";
import { Muted, Paragraph } from "@/components/typo";
import { useCopyProps } from "@/hooks/use-copy";
import { useTranslucentSurface } from "@/hooks/use-translucent-surface";
import { useTranslation } from "@/hooks/use-translation";
import { VnDisplayTitle } from "@/features/vn/components/vn-display-title";
import { STALE_TIME } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";
import { vnCopyText } from "@/utils/copy-text";
import { useMemo, useState } from "react";
import * as Haptics from "expo-haptics";
import { CoverImage } from "@/components/cover-image";
import { ImageViewer } from "@/components/image-viewer";
import { useShake } from "@/hooks/use-shake";
import { ApiError } from "@/lib/api/errors";
import { queryRandomVn } from "@/lib/api/endpoints/vn";
import type { VnSummary } from "@/lib/api/types";
import { coverUrl, formatRating, formatReleased, languageLabel } from "@/utils/format";

export function RandomVnCard(): JSX.Element {
  const router = useRouter();
  const { t } = useTranslation();
  const surface = useTranslucentSurface();
  // round 进 queryKey：点一次「换一部」= 一次新查询，随机逻辑放在 queryFn 里
  const [round, setRound] = useState(0);

  const pick = useQuery({
    queryKey: queryKeys.vn.random(round),
    queryFn: ({ signal }) => queryRandomVn(signal),
    staleTime: STALE_TIME.vn,
    // 随机失败再自动重试没意义（点一次就是一次）
    retry: false,
  });

  const reshuffle = (): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRound((r) => r + 1);
  };

  // 摇一摇 = 换一部（和点按钮同一条路径；首页本来就是「摇一部来玩」的语境）
  useShake(reshuffle);

  return (
    <Card className="mx-4 my-3" style={surface}>
      <Card.Body>
        {pick.data ? (
          <RandomVnRow vn={pick.data} onPress={() => router.push(`/vn/${pick.data?.id}`)} />
        ) : null}
        {pick.isError ? (
          <Muted type="body-sm">
            {t("home.randomFailed", {
              message:
                pick.error instanceof ApiError
                  ? pick.error.userMessage
                  : pick.error instanceof Error
                    ? pick.error.message
                    : t("common.unknownError"),
            })}
          </Muted>
        ) : null}
        {pick.isLoading ? (
          // 骨架屏：和卡片实际结构对齐（封面 + 两行文字）
          <View className="flex-row gap-3">
            <Skeleton variant="pulse" className="h-[93px] w-[70px] rounded-md" />
            <View className="flex-1 justify-center gap-2">
              <Skeleton variant="pulse" className="h-4 w-full rounded-md" />
              <Skeleton variant="pulse" className="h-3 w-2/5 rounded-md" />
            </View>
          </View>
        ) : null}
      </Card.Body>
    </Card>
  );
}

function RandomVnRow({ vn, onPress }: { vn: VnSummary; onPress: () => void }): JSX.Element {
  const { t } = useTranslation();
  // 封面查看器：null = 关着（这张卡只有一张图）
  const [coverOpen, setCoverOpen] = useState(false);
  // 长按整行复制「作品名 + 官网链接」；长按不会连带触发 onPress（进详情页）
  const copyable = useCopyProps(vnCopyText(vn), { preview: vn.title });
  const coverLabel = t("home.coverLabel", { title: vn.title });
  // 查看器的图组引用必须稳定（ImageViewer 的 data 引用一变就重建条目）
  const cover = useMemo(
    () =>
      vn.image?.url
        ? [
            {
              url: vn.image.url,
              thumbnail: vn.image.thumbnail,
              dims: vn.image.dims,
              sexual: vn.image.sexual,
              violence: vn.image.violence,
              label: coverLabel,
            },
          ]
        : [],
    [vn.image, coverLabel]
  );

  return (
    <>
      <Pressable
        onPress={onPress}
        onLongPress={copyable.onLongPress}
        delayLongPress={copyable.delayLongPress}
        accessibilityLabel={vn.title}
        accessibilityHint={copyable.accessibilityHint}
        className="active:opacity-60"
      >
        <View className="flex-row gap-3">
          <CoverImage
            url={coverUrl(vn.image)}
            width={70}
            height={[70, 93]}
            sexual={vn.image?.sexual}
            violence={vn.image?.violence}
            accessibilityLabel={coverLabel}
            onPress={() => setCoverOpen(true)}
          />
          <View className="flex-1 justify-center">
            {/* 整行可点：长按由行自己接管（复制作品名），标题不弹系统选区 */}
            <Paragraph className="line-clamp-2" selectable={false}>
              <VnDisplayTitle vn={vn} numberOfLines={2} />
            </Paragraph>
            <Muted type="body-xs">
              {formatReleased(vn.released)} · {languageLabel(vn.olang)} · {formatRating(vn.rating)}
            </Muted>
          </View>
        </View>
      </Pressable>

      <ImageViewer
        images={cover}
        index={coverOpen ? 0 : null}
        onClose={() => setCoverOpen(false)}
      />
    </>
  );
}
