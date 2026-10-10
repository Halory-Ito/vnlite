/**
 * 简体中文 · misc 模块（API 错误文案 / 剪贴板提示等零散文案）。
 *
 * 接入点：`lib/api/errors`（`userMessage` / `apiErrorMessage`）、
 * `hooks/use-copy`（长按复制提示与 toast）。
 * 请求层内部拼的 `Error.message` 不在这里，保持原样供日志 / 断言用。
 */
export const zhMisc = {
  misc: {
    /** lib/api/errors#apiErrorMessage：错误码 → 用户可见文案 */
    apiError: {
      badRequest: "请求被 VNDB 拒绝，多半是筛选条件写错了",
      unauthorized: "Token 无效或已失效，请重新登录",
      notFound: "接口不存在或条目已删除",
      rateLimited: "请求太频繁，已自动排队，请稍候",
      serverError: "VNDB 服务器暂时不可用",
      network: "网络连接失败，请检查网络",
      parse: "响应解析失败",
      unknown: "出错了",
    },

    /** hooks/use-copy */
    copy: {
      hint: "长按可复制",
      done: "已复制",
      failed: "复制失败，请重试",
      /** 主文案 + 摘要的拼接（`已复制：名称`） */
      message: "%{head}：%{preview}",
    },

    /** 首页「随机一部」失败时的兜底（`queryRandomVn` 抛出） */
    randomUnavailable: "随机作品暂时取不到，请稍后再试",
  },
} as const;
