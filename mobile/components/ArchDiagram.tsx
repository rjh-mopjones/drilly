import { View, Text, StyleSheet } from "react-native";
import type { Diagram } from "../lib/diagrams";
import type { Palette } from "../lib/theme";

/**
 * Native stub. The shipping native app is a WebView shell over the web build
 * (see NativeWebViewShell), so ArchDiagram.web.tsx is the real renderer and
 * this exists only so the native bundle compiles without pulling in the
 * DOM-only React Flow dependency.
 */
export default function ArchDiagram({
  palette,
}: {
  diagram: Diagram;
  palette: Palette;
  onDeepDive?: () => void;
  focus?: string[];
  embedded?: boolean;
}) {
  return (
    <View style={[styles.box, { backgroundColor: palette.codeBg }]}>
      <Text style={{ color: palette.textMuted, fontSize: 12 }}>Interactive diagram</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 8 },
});
