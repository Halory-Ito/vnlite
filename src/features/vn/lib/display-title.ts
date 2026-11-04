import type { VnSummary } from "@/lib/api/types";

export function getVnDisplayTitle(
  vn: Pick<VnSummary, "title" | "titles">,
  isChinese: boolean
): string {
  if (!isChinese) return vn.title;

  const chinese = (vn.titles ?? []).filter((item) =>
    ["zh", "zh-hans", "zh-hant"].includes(item.lang.toLowerCase())
  );
  return (
    chinese.find((item) => item.lang.toLowerCase() === "zh-hans" && item.main)?.title ??
    chinese.find((item) => item.lang.toLowerCase() === "zh-hant" && item.main)?.title ??
    chinese.find((item) => item.lang.toLowerCase() === "zh" && item.main)?.title ??
    chinese.find((item) => item.lang.toLowerCase() === "zh-hans")?.title ??
    chinese.find((item) => item.lang.toLowerCase() === "zh-hant")?.title ??
    chinese[0]?.title ??
    vn.title
  );
}

export function getVnOriginalTitle(
  vn: Pick<VnSummary, "title" | "alttitle" | "titles">
): string | undefined {
  return vn.titles?.find((item) => item.main)?.title ?? vn.alttitle ?? undefined;
}
