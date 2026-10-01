/**
 * 长按整条复制（写剪贴板 + 震动 + toast）。
 *
 * 全项目的复制分两种，**别混**：
 *   - 普通文字（标题 / 简介 / 语录 / 评论）→ 长按弹系统选区，用户自己选一段，
 *     那是 RN 的 `selectable`，默认全局开着（见 `components/typo`、`muted.tsx`）
 *   - 外面套着 `Pressable` 的一层（列表行 / 站内链接 / 外链卡片）→ JS 的 responder
 *     先拿到触摸，系统选区出不来，长按走这里：把整条（名字 + 官网链接）复制走
 *
 * ## 为什么把三件事收在一个 hook 里
 *
 * 复制必然连着震动与反馈，散开写等于每处各写一遍，迟早出现「有一处没震动 /
 * 有一处不报错」。这里调用点只负责**给什么文本**。
 *
 * ⚠️ 震动只在**成功之后**发：复制失败还震一下会让人以为成功了。
 * ⚠️ 空文本直接不复制、也不提示 —— VNDB 偶尔有没名字的条目。
 */

import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useToast } from "heroui-native";
import { useCallback } from "react";

import { copyPreview } from "@/utils/copy-text";

/** 长按阈值；与 RN Pressability 的默认值一致（`DEFAULT_LONG_PRESS_DELAY_MS`） */
const LONG_PRESS_MS = 500;

const COPY_HINT = "长按可复制";

export interface CopyOptions {
  /** toast 主文案，默认「已复制」 */
  message?: string;
  /**
   * toast 里附带的短摘要，默认取被复制文本的前若干字。
   * 复制的是「名字 + 链接」这种多行文本时要显式传名字，否则摘要会变成链接前半截。
   */
  preview?: string;
}

type CopyFn = (text: string, options?: CopyOptions) => void;

/** 可以 `{...copyable}` 展开到 `Pressable` 上的属性 */
export interface CopyProps {
  onLongPress: () => void;
  delayLongPress: number;
  accessibilityHint: string;
}

function useCopy(): CopyFn {
  const { toast } = useToast();

  return useCallback(
    (text, options) => {
      const body = text.trim();
      if (!body) return;

      void Clipboard.setStringAsync(body)
        .then(() => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          const head = options?.message ?? "已复制";
          const summary = copyPreview(options?.preview ?? body);
          toast.show(summary ? `${head}：${summary}` : head);
        })
        .catch(() => toast.show("复制失败，请重试"));
    },
    [toast]
  );
}

/**
 * 长按整条复制的 props。
 *
 * ```tsx
 * const copyable = useCopyProps(vnCopyText(vn), { preview: vn.title });
 * <Pressable onPress={open} onLongPress={copyable.onLongPress}>
 * ```
 *
 * 文本为空时 `onLongPress` 什么也不做（等价于没挂这个手势），所以调用点
 * 不用先判空 —— VNDB 的名字字段本来就可能是空的。
 */
export function useCopyProps(text: string | null | undefined, options?: CopyOptions): CopyProps {
  const copy = useCopy();
  const message = options?.message;
  const preview = options?.preview;

  return {
    onLongPress: useCallback(() => {
      copy(text ?? "", { message, preview });
    }, [copy, text, message, preview]),
    delayLongPress: LONG_PRESS_MS,
    accessibilityHint: COPY_HINT,
  };
}
