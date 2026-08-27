import { useLocalSearchParams, Stack, router } from "expo-router";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useMemo } from "react";
import ArchDiagram from "../../components/ArchDiagram";
import { getDiagram } from "../../lib/diagrams";
import { useTheme, type Palette } from "../../lib/theme";

/**
 * Full-screen interactive architecture diagram, reached from a question's
 * "Interactive diagram" section. Deliberately its own route rather than an
 * inline block: a whole-solution diagram needs the full viewport, which the
 * reader column does not have.
 */
export default function DiagramScreen() {
  const palette = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const params = useLocalSearchParams<{ id: string }>();
  const diagram = getDiagram(params.id ?? "");

  if (!diagram) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Diagram" }} />
        <Text style={styles.missing}>No diagram named “{params.id}”.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: diagram.title }} />
      <View style={styles.header}>
        <Text style={styles.subtitle}>{diagram.question}</Text>
        <Pressable
          onPress={() => router.push(`/reader/${diagram.sourceId}/${diagram.itemId}`)}
          style={styles.link}
        >
          <Text style={styles.linkText}>Read the question →</Text>
        </Pressable>
      </View>
      <View style={styles.canvas}>
        <ArchDiagram diagram={diagram} palette={palette} />
      </View>
    </View>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: p.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: p.border,
      backgroundColor: p.surface,
    },
    subtitle: { color: p.textMuted, fontSize: 13, flexShrink: 1 },
    link: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
    linkText: { color: p.accent, fontSize: 13, fontWeight: "600" },
    canvas: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: p.bg },
    missing: { color: p.textMuted, fontSize: 14 },
  });
}
