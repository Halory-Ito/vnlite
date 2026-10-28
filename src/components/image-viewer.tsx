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
 * ## ⚠️ 两个「切换闪帧」的坑
 *
 * 1. **`data` 引用**：`Gallery` 对 `data` 引用变化敏感。若翻页时顺着
 *    `onIndexChange` 让父组件 setState，父重渲染重建 `images`（每次 map /
 *    展开都是新数组），pager 条目会在滑动过渡中途重建 —— 切换时闪几帧别的图。
 *    所以 `index` 只在**打开那一刻**生效（初始下标），之后翻页位置由查看器
 *    自持（父组件不需要也不应该跟随更新）；`data` 直传不复制；
 *    `onIndexChange` 仅是可选通报，接收方若 setState 请保证 `images` 稳定。
 * 2. **`renderItem` 引用**：`GalleryItem` 自带 memo，但比较器包含
 *    `renderItem` —— 内联箭头函数每次渲染都是新引用，查看器任何一次
 *    setState 都会让全部条目重建；重建时动画样式（transform）有重挂空档，
 *    上一张（zIndex 更高、图已解码）会闪现在当前张上面。
 *    所以 `renderItem` 必须 `useCallback` 稳定。
 * 3. **`activeIndex` 同步导致全量重渲染**：若把 `activeIndex` 放进 React context
 *    每次翻页都会新建对象，所有 `ViewerItem` 都重渲染。`allowDownscaling` 在
 *    当前/非当前之间翻转时，expo-image（Android）会触发 `shouldRerender` 重载，
 *    瞬间闪现上一张。**解决方案**：`ViewerItem` 直接从 `GalleryContext` 读取
 *    `activeIndex`（shared value），用 `useAnimatedReaction` 将其同步到本地 React
 *    state，仅在当前张切换时才更新，避免全量重渲染。
 *
 * ## NSFW
 *
 * 与 `CoverImage` 同一套策略：`hide` 档不渲染敏感图，
 * `blur` 档先糊住、**点一下图**才显示（不占用双击，双击留给缩放）。
 */

import { Image } from "expo-image";
import { useThemeColor } from "heroui-native";
import { createContext, useCallback, useContext, useMemo, useState, type JSX } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Modal, Pressable, useWindowDimensions, View } from "react-native";
import { Gallery, fitContainer } from "react-native-zoom-toolkit";
// 从 zoom-toolkit 内部拿到 GalleryContext，避免将 activeIndex 同步到 React state 导致全量重渲染
// @ts-ignore - internal context
import { GalleryContext } from "react-native-zoom-toolkit/lib/module/components/gallery/context";
import { useAnimatedReaction } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "./icon";
import { Muted } from "./typo";
import { useImageGate } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";

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
  /** 引用请保持稳定（useMemo）—— `data` 引用一变 Gallery 就会重建条目 */
  images: readonly ViewerImage[];
  /** 当前索引；`null` = 关闭。只在打开那一刻生效（初始下标） */
  index: number | null;
  onClose: () => void;
  /** 可选通报：翻到第几张（内部状态落定时触发） */
  onIndexChange?: (index: number) => void;
}

/**
 * 查看器的实时状态：仅保留已点开放行的 NSFW 图。
 * `activeIndex` 不再走这里，直接从 GalleryContext（shared value）订阅。
 */
interface ViewerRevealedState {
  revealed: ReadonlySet<string>;
}

const ViewerRevealedContext = createContext<ViewerRevealedState>({
  revealed: new Set(),
});

/** 拿不到 dims 时的兜底比例（放大到整屏 contain，不裁切） */
const FALLBACK_RATIO = 1.5;

export function ImageViewer({
  images,
  index,
  onClose,
  onIndexChange,
}: ImageViewerProps): JSX.Element | null {
  const background = useThemeColor("background");

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
            /*
              打开期间才挂载、关闭即卸载 —— 这样「当前看到第几张」直接用
              useState 初始值接住 `current`，不需要 render 阶段的 props 同步。
            */
            <ViewerBody
              images={images}
              initialIndex={current}
              onClose={onClose}
              onIndexChange={onIndexChange}
            />
          ) : null}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/**
 * 打开期间的内容体。翻页只更新自己的下标，不回穿父组件（原因见文件头）；
 * 父组件中途因别的原因重渲染也不影响这里（`initialIndex` 挂载后即失效）。
 */
function ViewerBody({
  images,
  initialIndex,
  onClose,
  onIndexChange,
}: {
  images: readonly ViewerImage[];
  initialIndex: number;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
}): JSX.Element {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const foreground = useThemeColor("foreground");
  const { t } = useTranslation();
  // 点开过的图（按 url 记）：blur 档下点一下图就放行这一张
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());
  /** 当前看到第几张（仅用于顶部计数，订阅 GalleryContext 避免全量重渲染） */
  const [active, setActive] = useState(initialIndex);

  const viewerRevealed = useMemo<ViewerRevealedState>(() => ({ revealed }), [revealed]);
  // 窗口尺寸对象按值记忆化：`useWindowDimensions` 每次渲染返回新对象，
  // 直接传会让 renderItem 的 useCallback 每次都失效
  const viewport = useMemo(
    () => ({ width: window.width, height: window.height }),
    [window.width, window.height]
  );
  // renderItem 的引用必须稳定（见文件头），依赖越少越好
  const renderItem = useCallback(
    (item: ViewerImage, itemIndex: number) => (
      <ViewerItem image={item} itemIndex={itemIndex} window={viewport} />
    ),
    [viewport]
  );

  return (
    <View className="flex-1">
      <ViewerRevealedContext.Provider value={viewerRevealed}>
        <Gallery
          /*
            Gallery 的 data 类型是可变数组，但它只读不写，readonly 断言安全；
            引用必须稳定（见文件头），不要在这里复制数组。
          */
          data={images as ViewerImage[]}
          keyExtractor={(item) => item.url}
          initialIndex={initialIndex}
          maxScale={6}
          onIndexChange={(next) => {
            setActive(next);
            onIndexChange?.(next);
          }}
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
          renderItem={renderItem}
        />
      </ViewerRevealedContext.Provider>

      <View
        className="absolute left-0 right-0 flex-row items-center justify-between px-4"
        style={{ top: insets.top + 8 }}
      >
        <View className="rounded-full bg-default-soft px-2.5 py-1">
          <Muted type="body-xs">
            {String(active + 1)} / {String(images.length)}
          </Muted>
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          className="h-9 w-9 items-center justify-center rounded-full bg-default-soft active:opacity-60"
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
        >
          <Icon name="xmark" size={18} color={foreground} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * 单张图。尺寸必须显式给（原因见文件头），NSFW 命中时先糊住、点一下放行。
 * 从 GalleryContext 的 shared value 订阅 activeIndex，仅在当前/非当前切换时重渲染，
 * 避免翻页时全量重渲染触发 expo-image allowDownscaling 翻转导致闪帧。
 */
function ViewerItem({
  image,
  itemIndex,
  window,
}: {
  image: ViewerImage;
  /** 在图组里的下标，与 GalleryContext 的 activeIndex 比对得出是否当前张 */
  itemIndex: number;
  window: { width: number; height: number };
}): JSX.Element {
  const { t } = useTranslation();
  const { revealed } = useContext(ViewerRevealedContext);
  const galleryContext = useContext(GalleryContext) as {
    activeIndex: { value: number };
  };
  const [active, setActive] = useState(false);

  useAnimatedReaction(
    () => galleryContext.activeIndex.value,
    (value, previous) => {
      if (previous === null) {
        scheduleOnRN(setActive, value === itemIndex);
        return;
      }
      if (previous === itemIndex && value !== itemIndex) {
        scheduleOnRN(setActive, false);
      } else if (value === itemIndex && previous !== itemIndex) {
        scheduleOnRN(setActive, true);
      }
    },
    [itemIndex]
  );

  const gate = useImageGate({ sexual: image.sexual, violence: image.violence });
  const blurred = gate.blurred && !revealed.has(image.url);

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
        <Muted type="body-xs">{t("common.hiddenAdult")}</Muted>
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
        // 保持允许降采样，避免切换时 allowDownscaling 翻转触发重载闪帧
        allowDownscaling
        recyclingKey={image.url}
        priority={active ? "high" : "normal"}
        accessibilityLabel={image.label ?? t("common.image")}
        accessibilityIgnoresInvertColors
      />
      {blurred ? (
        <View className="absolute bottom-8 left-0 right-0 items-center">
          <View className="rounded-full bg-background/85 px-3 py-1.5">
            <Muted type="body-xs">{t("common.sensitiveTapReveal")}</Muted>
          </View>
        </View>
      ) : null}
    </View>
  );
}
