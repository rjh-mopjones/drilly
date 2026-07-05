import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { Palette } from "../lib/theme";

interface Props {
  source: string;
  scheme: "dark" | "light";
  palette: Palette;
}

/**
 * Native fallback for inline-SVG diagrams. The shipping native app is a
 * WebView shell over the web build (see NativeWebViewShell), so the real
 * renderer is `SvgDiagram.web.tsx`; this exists only so the native bundle
 * compiles. If native reader screens are ever built, swap this for a
 * react-native-svg `SvgXml`.
 */
export default function SvgDiagram({ palette }: Props) {
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={styles.box}>
      <Text style={styles.label}>Diagram</Text>
    </View>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    box: {
      backgroundColor: p.codeBg,
      borderRadius: 8,
      padding: 16,
      alignItems: "center",
    },
    label: { color: p.textMuted, fontSize: 12 },
  });
}
