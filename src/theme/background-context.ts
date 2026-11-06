import { createContext } from "react";

import type { AppBackgroundProps } from "@/components/app-background";

export const BackgroundContext = createContext<AppBackgroundProps | null>(null);
