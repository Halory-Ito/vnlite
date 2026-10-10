import type { CatalogOf } from "../catalog-types";

import type { zhDiscussion } from "../zh/discussion";

/**
 * English catalog · discussion namespace（VNDB thread list / thread page）.
 *
 * 用词对齐 vndb.org 讨论板表头：Topic / Replies / Starter / Last post。
 */
export const enDiscussion: CatalogOf<typeof zhDiscussion> = {
  discussion: {
    openUser: "Open user profile: %{name}",

    list: {
      loading: "Fetching threads…",
      emptyTitle: "No discussions yet",
      emptyDescription: "No related topics on the VNDB discussion boards yet",
      openThread: "Open thread: %{title}",
      starter: "Starter",
      lastPost: "Last post",
      replies: "Replies",
    },

    thread: {
      title: "Thread",
      loading: "Fetching posts…",
      emptyTitle: "This thread has no content",
      emptyDescription: "VNDB may have changed its markup and parsing failed",
      postCount: "%{count} posts",
      anonymous: "anonymous",
      edited: "Last modified on %{date}",
    },
  },
};
