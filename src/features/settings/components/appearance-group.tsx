import { Card } from "heroui-native";
import type { ReactNode } from "react";

import { useTranslucentSurface } from "@/hooks/use-translucent-surface";

export function AppearanceGroup({ title, children }: { title: string; children: ReactNode }) {
  const surface = useTranslucentSurface();
  return (
    <Card className="mx-4 my-2" style={surface}>
      <Card.Header className="border-b border-border pb-3">
        <Card.Title accessibilityRole="header" className="text-sm font-semibold">
          {title}
        </Card.Title>
      </Card.Header>
      <Card.Body className="gap-5 pt-3">{children}</Card.Body>
    </Card>
  );
}
