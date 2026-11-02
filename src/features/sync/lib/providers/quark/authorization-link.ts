import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { startActivityAsync } from "expo-intent-launcher";

/** The Quark browser app also hosts Drive; target it explicitly on Android. */
export async function openQuarkAuthorization(url: string): Promise<void> {
  if (Platform.OS === "android") {
    await startActivityAsync("android.intent.action.VIEW", {
      data: url,
      packageName: "com.quark.browser",
      // Expo only uses packageName when className is also supplied.
      className: "com.ucpro.MainActivity",
    });
    return;
  }
  await Linking.openURL(url);
}
