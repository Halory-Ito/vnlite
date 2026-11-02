import { ScrollView } from "react-native";

import { DiscoverRow } from "@/features/home/components/discover-row";
import { ReleaseCalendar } from "@/features/calendar/components/release-calendar";
import { HomeFeed } from "@/features/home/components/home-feed";
import { HomePlayStats } from "@/features/home/components/home-play-stats";
import { QuoteCard } from "@/features/home/components/quote-card";
import { RandomVnCard } from "@/features/home/components/random-vn-card";
import { homeSectionRows } from "@/features/home/lib/home-layout";
import { usePreferences } from "@/hooks/use-preferences";

export default function HomeScreen() {
  const { homeLayout } = usePreferences();
  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
      {homeSectionRows(homeLayout).map((row) => {
        const id = row[0]!;
        const key = row.join(":");
        if (id === "today" || id === "annual" || id === "heatmap") {
          return <HomePlayStats key={key} sections={row as ("today" | "annual" | "heatmap")[]} />;
        }
        if (id === "quote") return <QuoteCard key={key} />;
        if (id === "random") return <RandomVnCard key={key} />;
        if (id === "calendar") return <ReleaseCalendar key={key} />;
        if (id === "discover") return <DiscoverRow key={key} />;
        return <HomeFeed key={key} section={id} />;
      })}
    </ScrollView>
  );
}
