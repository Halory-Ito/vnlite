import { Image as ExpoImage } from "expo-image";
import type { ComponentProps, JSX } from "react";
import { useEffect, useState } from "react";

import { cacheImage, type ImageCacheCategory } from "@/features/settings/lib/image-cache";

type ImageProps = Omit<ComponentProps<typeof ExpoImage>, "source" | "placeholder" | "cachePolicy">;

interface ManagedImageProps extends ImageProps {
  url: string;
  category: ImageCacheCategory;
  placeholderUrl?: string;
}

interface ResolvedImages {
  key: string;
  imageUri?: string;
  placeholderUri?: string;
  failed?: boolean;
}

export function ManagedImage({
  url,
  category,
  placeholderUrl,
  onError,
  ...props
}: ManagedImageProps): JSX.Element {
  const key = `${category}:${url}:${placeholderUrl ?? ""}`;
  const [resolved, setResolved] = useState<ResolvedImages>({ key: "" });
  const current = resolved.key === key ? resolved : undefined;

  useEffect(() => {
    let active = true;
    void cacheImage(url, category).then(
      (imageUri) =>
        active &&
        setResolved((previous) => ({
          key,
          imageUri,
          placeholderUri: previous.key === key ? previous.placeholderUri : undefined,
        })),
      () =>
        active &&
        setResolved((previous) => ({
          key,
          placeholderUri: previous.key === key ? previous.placeholderUri : undefined,
          failed: true,
        }))
    );
    if (placeholderUrl) {
      void cacheImage(placeholderUrl, category)
        .then((placeholderUri) => {
          if (active)
            setResolved((previous) => ({
              key,
              imageUri: previous.key === key ? previous.imageUri : undefined,
              placeholderUri,
            }));
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [category, key, placeholderUrl, url]);

  const sourceUri = current?.imageUri ?? (current?.failed ? url : undefined);
  return (
    <ExpoImage
      {...props}
      source={sourceUri ? { uri: sourceUri } : undefined}
      placeholder={current?.placeholderUri ? { uri: current.placeholderUri } : undefined}
      cachePolicy="memory"
      onError={onError}
    />
  );
}
