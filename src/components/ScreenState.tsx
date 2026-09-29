/**
 * 页面状态占位：加载中 / 空 / 错误 / 离线。
 *
 * 统一处理三件事：
 *   1. 把 `ApiError` 翻译成人话
 *   2. 错误可重试时给按钮
 *   3. 保持一致的布局高度，避免切换时页面跳动
 */

import { Button, Spinner } from "heroui-native";
import type { JSX, ReactNode } from "react";
import { View } from "react-native";

import { ApiError } from "@/lib/api/errors";

import { H4, Muted, Paragraph } from "./Typo";

export function LoadingState({
  label = "加载中…",
  className = "py-16",
}: {
  label?: string;
  className?: string;
}): JSX.Element {
  return (
    <View className={`items-center justify-center gap-3 ${className}`}>
      <Spinner size="md" />
      <Muted className="text-center">{label}</Muted>
    </View>
  );
}

export interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  error,
  onRetry,
  className = "py-16 px-6",
}: ErrorStateProps): JSX.Element {
  const apiError = error instanceof ApiError ? error : null;
  const message = apiError
    ? apiError.userMessage
    : error instanceof Error
      ? error.message
      : "出错了";
  const canRetry = apiError ? apiError.isRetryable || apiError.kind === "unknown" : true;

  return (
    <View className={`items-center justify-center gap-4 ${className}`}>
      <H4 className="text-center">出错了</H4>
      <Paragraph className="text-center text-muted">{message}</Paragraph>
      {onRetry && canRetry ? (
        <Button size="sm" onPress={onRetry}>
          <Button.Label>重试</Button.Label>
        </Button>
      ) : null}
    </View>
  );
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  className = "py-16 px-6",
}: EmptyStateProps): JSX.Element {
  return (
    <View className={`items-center justify-center gap-3 ${className}`}>
      <H4 className="text-center">{title}</H4>
      {description ? <Paragraph className="text-center text-muted">{description}</Paragraph> : null}
      {action}
    </View>
  );
}
