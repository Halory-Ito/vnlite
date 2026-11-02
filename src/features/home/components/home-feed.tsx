import { View } from "react-native";
import { H5 } from "@/components/typo";
import { ReviewList } from "@/features/review/components/review-list";
import { useTranslation } from "@/hooks/use-translation";
import { FEED_COUNT, FEED_TAB_LABEL_KEY, type FeedTab } from "@/features/home/lib/feed-config";
import { JustReleasedCarousel, UpcomingCarousel } from "./releases-feed";

export function HomeFeed({ section }: { section: FeedTab }) {
  const { t } = useTranslation();
  return (
    <View className="my-3 gap-2">
      <H5 className="px-4">{t(FEED_TAB_LABEL_KEY[section])}</H5>
      {section === "reviews" ? <ReviewList limit={FEED_COUNT} /> : null}
      {section === "upcoming" ? <UpcomingCarousel /> : null}
      {section === "released" ? <JustReleasedCarousel /> : null}
    </View>
  );
}
