import { Text } from "react-native";

/**
 * Native stub. The shipping app is a WebView over the web build, so
 * ChevronsIcon.web.tsx is what renders everywhere; this only appears in
 * Expo Go / dev.
 */
export function ChevronsIcon({ size = 20, color }: { size?: number; color: string }) {
  return <Text style={{ color, fontSize: size, lineHeight: size + 2 }}>⌄</Text>;
}
