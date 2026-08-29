import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { WebView, type WebViewNavigation } from "react-native-webview";

/**
 * Native Android shell: a single full-screen WebView pointing at the
 * production website. The web build (Expo Web export of this same
 * codebase) IS the app — the native side is just a cache-friendly
 * wrapper so the same UX shows up on the Boox and there's no native
 * code to maintain alongside the web.
 *
 * Offline is owned by the page's service worker (web/public/service-worker.js),
 * which precaches the app shell and content into durable Cache Storage. The
 * WebView's own HTTP cache is left at its default; it was evicted under
 * memory pressure and is not relied on. First launch needs online; after that
 * the SW serves the whole site offline.
 *
 * Android back button: navigate WebView history first, only exit the
 * app once we're at the WebView's root.
 */

const REMOTE_URL = "https://drilly-delta-brown.vercel.app";

/** Matches the dark theme's `bg` colour so the splash + safe-area flush. */
const BG = "#0b0d12";
const FG = "#e6e8ee";
const MUTED = "#8a93a6";

export function NativeWebViewShell() {
  const webRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  // Android hardware back button. Return true to consume; false lets the
  // OS handle it (which exits the app from the root screen).
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  const reload = () => webRef.current?.reload();

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <WebView
          ref={webRef}
          source={{ uri: REMOTE_URL }}
          style={styles.web}
          cacheEnabled
          cacheMode="LOAD_DEFAULT"
          javaScriptEnabled
          domStorageEnabled
          pullToRefreshEnabled
          setSupportMultipleWindows={false}
          // The site is a fixed-viewport app that scrolls internally, so
          // browser pinch-zoom only clips it. Diagrams zoom via React Flow's
          // own gesture handling, which these do not affect.
          scalesPageToFit={false}
          setBuiltInZoomControls={false}
          setDisplayZoomControls={false}
          // Never show a bare black view: a spinner while the first
          // navigation is in flight, a retry screen if it fails outright.
          startInLoadingState
          renderLoading={() => (
            <View style={styles.overlay}>
              <ActivityIndicator color={MUTED} />
            </View>
          )}
          renderError={() => (
            <View style={styles.overlay}>
              <Text style={styles.title}>Nothing cached yet</Text>
              <Text style={styles.body}>
                Connect to the internet and open the app once. After that it
                works offline.
              </Text>
              <Pressable
                onPress={reload}
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="button"
              >
                <Text style={styles.buttonText}>Retry</Text>
              </Pressable>
            </View>
          )}
          // Android kills the WebView renderer under memory pressure and the
          // view stays blank forever; reloading is the only recovery.
          onRenderProcessGone={reload}
          // Block the WebView from navigating away from our origin.
          // Anything off-host opens in the system browser instead.
          onShouldStartLoadWithRequest={(req) => {
            try {
              const u = new URL(req.url);
              const home = new URL(REMOTE_URL);
              return u.host === home.host;
            } catch {
              return true;
            }
          }}
          onNavigationStateChange={(nav: WebViewNavigation) => {
            setCanGoBack(nav.canGoBack);
          }}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1, backgroundColor: BG },
  web: { flex: 1, backgroundColor: BG },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  title: { color: FG, fontSize: 18, fontWeight: "700" },
  body: { color: MUTED, fontSize: 14, textAlign: "center", lineHeight: 20 },
  button: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: MUTED,
  },
  buttonPressed: { opacity: 0.6 },
  buttonText: { color: FG, fontSize: 14, fontWeight: "600" },
});
