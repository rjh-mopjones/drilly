import { useMemo, useState } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { GLOSSARY } from "../lib/diagrams/glossary";

/** term → one-line definition; component labels from a diagram are added per item. */
export type Terms = Record<string, string>;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cache = new Map<string, RegExp>();

/** Words match case-insensitively; acronyms and product names only as written. */
function lookup(terms: Terms, raw: string): string | undefined {
  if (terms[raw] !== undefined) return terms[raw];
  const lower = raw.toLowerCase();
  return raw === lower ? terms[lower] : undefined;
}

function regexFor(terms: Terms): RegExp {
  const keys = Object.keys(terms).sort((a, b) => b.length - a.length);
  const id = keys.length + ":" + keys.slice(0, 40).join("|");
  let re = cache.get(id);
  if (!re) {
    re = new RegExp(`(?<![\\w-])(${keys.map(escape).join("|")})(?![\\w-])`, "gi");
    cache.set(id, re);
  }
  return re;
}

/**
 * Reader text with the glossary applied: every known term is underlined and a
 * tap opens its one-line definition inline, the same way the diagram panels
 * do. `extra` carries the current diagram's box labels, defined by their own
 * "what it is", so a write-up can say "the Sketch workers" and the reader can
 * tap it.
 */
export function GlossedText({
  text,
  extra,
  style,
  accent,
  muted,
}: {
  text: string;
  extra?: Terms;
  style?: StyleProp<TextStyle>;
  accent: string;
  muted: string;
}) {
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const terms = useMemo(() => (extra ? { ...GLOSSARY, ...extra } : GLOSSARY), [extra]);
  const parts = useMemo(() => {
    const out: { text: string; def?: string }[] = [];
    const re = regexFor(terms);
    let last = 0;
    for (const m of text.matchAll(re)) {
      const def = lookup(terms, m[0]);
      if (!def) continue;
      if (m.index! > last) out.push({ text: text.slice(last, m.index) });
      out.push({ text: m[0], def });
      last = m.index! + m[0].length;
    }
    if (last < text.length) out.push({ text: text.slice(last) });
    return out;
  }, [text, terms]);
  if (parts.length === 1 && !parts[0].def) return <Text style={style}>{text}</Text>;
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        part.def ? (
          <Text key={i}>
            <Text
              onPress={() =>
                setOpen((s) => {
                  const n = new Set(s);
                  if (n.has(i)) n.delete(i);
                  else n.add(i);
                  return n;
                })
              }
              style={{
                textDecorationLine: "underline",
                textDecorationStyle: "dotted",
                textDecorationColor: accent,
                color: open.has(i) ? accent : undefined,
              }}
            >
              {part.text}
            </Text>
            {open.has(i) ? <Text style={{ color: muted, fontStyle: "italic" }}> ({part.def})</Text> : null}
          </Text>
        ) : (
          <Text key={i}>{part.text}</Text>
        ),
      )}
    </Text>
  );
}
