/**
 * 图片查看器（全屏）。
 *
 * 手势走第三方库 `react-native-zoom-toolkit` 的 `Gallery`：
 * 双指缩放 / 双击放大 / 拖动平移 / 左右滑切换 / 上下滑关闭。
 * 选它的理由：**纯 JS**（不需要 prebuild，Expo Go 直接能跑），
 * 且已按 reanimated 4 + React 19 维护（本项目正好是这套）。
 *
 * ## ⚠️ 为什么每张图都要显式算尺寸
 *
 * `GalleryItem` 的内层容器是**按内容撑开**的（`onLayout` 量出来当图片尺寸，
 * 再拿这个尺寸配缩放/平移边界）。给子元素写 `width: "100%"` 会量出 0，
 * 于是整屏空白 —— 这就是「查看器加载不出图片」的根因。
 * 所以这里用 `fitContainer(比例, 窗口)` 算出**真实像素尺寸**再渲染，
 * 比例优先取 API 给的 `dims`，拿不到才退回「整屏 contain」。
 *
 * ## 用法
 *
 * 组件本身不持状态，`index === null` 表示关闭 —— 这样封面、截图墙
 * 可以各自持有自己的 index，共用一个查看器。
 *
 * ## NSFW
 *
 * 与 `CoverImage` 同一套策略：`hide` 档不渲染敏感图，
 * `blur` 档先糊住、**点一下图**才显示（不占用双击，双击留给缩放）。
 */

import { Image } from "expo-image";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Modal, Pressable, useWindowDimensions, View } from "react-native";
import { Gallery, fitContainer } from "react-native-zoom-toolkit";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { Muted } from "@/components/Typo";
import { useImageGate } from "@/hooks/usePreferences";

export interface ViewerImage {
  /** 高清图（查看器显示的就是它） */
  url: string;
  /** 缩略图：先铺上去，高清图解码完再盖上来 */
  thumbnail?: string;
  /** `[宽, 高]`，用来算显示尺寸；缺了就只能按整屏 contain 处理 */
  dims?: [number, number] | readonly [number, number];
  /** NSFW 分级，与 `CoverImage` 的入参一致 */
  sexual?: number;
  violence?: number;
  /** 无障碍描述，如「封面」「截图 3」 */
  label?: string;
}

export interface ImageViewerProps {
  images: readonly ViewerImage[];
  /** 当前索引；`null` = 关闭 */
  index: number | null;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
}

/** 拿不到 dims 时的兜底比例（放大到整屏 contain，不裁切） */
const FALLBACK_RATIO = 1.5;

export function ImageViewer({
  images,
  index,
  onClose,
  onIndexChange,
}: ImageViewerProps): JSX.Element | null {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const background = useThemeColor("background");
  const foreground = useThemeColor("foreground");
  // 点开过的图（按 url 记）：blur 档下点一下图就放行这一张
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());

  if (images.length === 0) return null;
  const current = index == null ? null : Math.min(index, images.length - 1);

  return (
    <Modal
      visible={current !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/*
        ⚠️ Modal 的内容在原生侧是**另一棵根视图**，手势库拿不到 App 根部那个
        `GestureHandlerRootView`，里面的手势会全部失灵（缩放/滑动都动不了）。
        所以 Modal 内部必须再包一层。
      */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1" style={{ backgroundColor: background }}>
          {current !== null ? (
            <Gallery
              data={[...images]}
              keyExtractor={(item) => item.url}
              initialIndex={current}
              maxScale={6}
              onIndexChange={onIndexChange}
              // 上下滑关闭（左右滑留给「上一张 / 下一张」）
              onSwipe={(direction) => {
                if (direction === "down" || direction === "up") onClose();
              }}
              // 单击：blur 档下放行这一张（双击是缩放，两者不冲突）
              onTap={(_event, tapped) => {
                const url = images[tapped]?.url;
                if (!url) return;
                setRevealed((prev) => new Set(prev).add(url));
              }}
              renderItem={(item) => (
                <ViewerItem
                  image={item}
                  active={item.url === images[current]?.url}
                  revealed={revealed.has(item.url)}
                  window={window}
                />
              )}
            />
          ) : null}

          <View
            className="absolute left-0 right-0 flex-row items-center justify-between px-4"
            style={{ top: insets.top + 8 }}
          >
            <View className="rounded-full bg-default-soft px-2.5 py-1">
              <Muted type="body-xs">
                {String((current ?? 0) + 1)} / {String(images.length)}
              </Muted>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              className="h-9 w-9 items-center justify-center rounded-full bg-default-soft active:opacity-60"
              accessibilityRole="button"
              accessibilityLabel="关闭"
            >
              <Icon name="xmark" size={18} color={foreground} />
            </Pressable>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** 单张图。尺寸必须显式给（原因见文件头），NSFW 命中时先糊住、点一下放行 */
function ViewerItem({
  image,
  active,
  revealed,
  window,
}: {
  image: ViewerImage;
  /** 当前正在看的那张 */
  active: boolean;
  revealed: boolean;
  window: { width: number; height: number };
}): JSX.Element {
  const gate = useImageGate({ sexual: image.sexual, violence: image.violence });
  const blurred = gate.blurred && !revealed;

  const ratio =
    image.dims && image.dims[0] > 0 && image.dims[1] > 0
      ? image.dims[0] / image.dims[1]
      : FALLBACK_RATIO;
  const size = fitContainer(ratio, window);

  if (gate.hidden) {
    return (
      <View
        className="items-center justify-center"
        style={{ width: window.width, height: window.height }}
      >
        <Muted type="body-xs">已隐藏（成人内容）</Muted>
      </View>
    );
  }

  return (
    <View style={size}>
      <Image
        source={image.url}
        placeholder={image.thumbnail ? { uri: image.thumbnail } : undefined}
        placeholderContentFit="contain"
        style={size}
        contentFit="contain"
        blurRadius={blurred ? 24 : 0}
        transition={150}
        // 只有正在看的那张按原分辨率解码，左右相邻的降采样省内存
        allowDownscaling={!active}
        recyclingKey={image.url}
        priority="high"
        accessibilityLabel={image.label ?? "图片"}
        accessibilityIgnoresInvertColors
      />
      {blurred ? (
        <View className="absolute bottom-8 left-0 right-0 items-center">
          <View className="rounded-full bg-background/85 px-3 py-1.5">
            <Muted type="body-xs">敏感内容 · 点击显示</Muted>
          </View>
        </View>
      ) : null}
    </View>
  );
}
