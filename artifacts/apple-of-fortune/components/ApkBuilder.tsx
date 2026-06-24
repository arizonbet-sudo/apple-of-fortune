import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { PALETTE } from "@/constants/game";
import {
  ACTIONS_URL,
  RELEASES_URL,
  TOKEN_CREATE_URL,
  clearToken,
  getBuildStatus,
  getLatestApkUrl,
  loadLastBuild,
  loadToken,
  saveToken,
  triggerBuild,
  verifyToken,
} from "@/lib/apkBuilder";

type Phase =
  | "idle"
  | "submitting"
  | "building"
  | "done"
  | "error";

const POLL_MS = 15000;

export function ApkBuilder() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [savingToken, setSavingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [statusText, setStatusText] = useState("");
  const [apkUrl, setApkUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const commitShaRef = useRef<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  const clearPoll = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    const sha = commitShaRef.current;
    const tk = token;
    if (!sha || !tk) return;
    try {
      const st = await getBuildStatus(tk, sha);
      if (!mounted.current) return;
      if (!st.found) {
        setStatusText("Build queued — waiting for GitHub to start it…");
      } else if (st.status === "completed") {
        if (st.conclusion === "success") {
          const url = await getLatestApkUrl(tk);
          if (!mounted.current) return;
          setApkUrl(url);
          setPhase("done");
          setStatusText("Build finished. Your new APK is ready to download.");
          return;
        }
        setPhase("error");
        setErrorMsg(
          `Build ${st.conclusion ?? "failed"}. Open the build log on GitHub for details.`,
        );
        return;
      } else if (st.status === "in_progress") {
        setStatusText("Building your APK… (this takes ~15–20 minutes)");
      } else {
        setStatusText("Build queued on GitHub…");
      }
      pollTimer.current = setTimeout(poll, POLL_MS);
    } catch (e: any) {
      if (!mounted.current) return;
      setStatusText(
        `Couldn't check status (${e?.message ?? "network error"}). Retrying…`,
      );
      pollTimer.current = setTimeout(poll, POLL_MS);
    }
  }, [token]);

  // Load saved token + resume an in-progress build on mount.
  useEffect(() => {
    mounted.current = true;
    (async () => {
      const tk = await loadToken();
      if (!mounted.current) return;
      setToken(tk);
      setTokenLoaded(true);
      const last = await loadLastBuild();
      if (last && tk && mounted.current) {
        commitShaRef.current = last.commitSha;
        setPhase("building");
        setStatusText("Checking your most recent build…");
      }
    })();
    return () => {
      mounted.current = false;
      clearPoll();
    };
  }, [clearPoll]);

  // Kick off polling whenever we enter the building phase and have a token.
  useEffect(() => {
    if (phase === "building" && token && commitShaRef.current) {
      clearPoll();
      poll();
    }
    return clearPoll;
  }, [phase, token, poll, clearPoll]);

  const onSaveToken = async () => {
    const value = tokenInput.trim();
    if (!value) return;
    setSavingToken(true);
    setTokenError(null);
    try {
      await verifyToken(value);
      await saveToken(value);
      if (!mounted.current) return;
      setToken(value);
      setTokenInput("");
    } catch (e: any) {
      if (!mounted.current) return;
      setTokenError(
        e?.message ??
          "That token didn't work. Make sure it can access the repository.",
      );
    } finally {
      if (mounted.current) setSavingToken(false);
    }
  };

  const onClearToken = async () => {
    await clearToken();
    setToken(null);
  };

  const pickIcon = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
      base64: true,
    });
    if (!res.canceled && res.assets?.[0]) {
      setImageUri(res.assets[0].uri);
      setImageBase64(res.assets[0].base64 ?? null);
    }
  };

  const startBuild = async () => {
    if (!token) return;
    if (!name.trim() && !imageBase64) {
      setErrorMsg("Enter a new app name or choose a new icon first.");
      setPhase("error");
      return;
    }
    setPhase("submitting");
    setErrorMsg(null);
    setApkUrl(null);
    setStatusText("Sending your changes to GitHub…");
    try {
      const sha = await triggerBuild({
        token,
        appName: name,
        imageBase64,
      });
      if (!mounted.current) return;
      commitShaRef.current = sha;
      setPhase("building");
      setStatusText("Build started! GitHub is preparing your APK…");
    } catch (e: any) {
      if (!mounted.current) return;
      setErrorMsg(e?.message ?? "Something went wrong starting the build.");
      setPhase("error");
    }
  };

  const open = (url: string | null) => {
    if (url) WebBrowser.openBrowserAsync(url);
  };

  const busy = phase === "submitting" || phase === "building";

  /* ------------------------------- render ------------------------------- */

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <Ionicons name="hammer" size={16} color={PALETTE.green} />
        <Text style={styles.heading}>Build New APK</Text>
      </View>
      <Text style={styles.sub}>
        Change the name and icon shown on the phone home screen, then build a new
        installable APK. Each build takes about 15–20 minutes.
      </Text>

      {!tokenLoaded ? (
        <ActivityIndicator color={PALETTE.green} style={{ marginTop: 12 }} />
      ) : !token ? (
        /* ---------- one-time GitHub token setup ---------- */
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Connect GitHub (one time)</Text>
          <Text style={styles.cardHint}>
            Paste a GitHub access token so the app can build for you. It is
            stored only on this device.
          </Text>
          <Pressable
            style={styles.linkBtn}
            onPress={() => open(TOKEN_CREATE_URL)}
          >
            <Ionicons name="open-outline" size={15} color="#cfe0db" />
            <Text style={styles.linkBtnText}>Create a token on GitHub</Text>
          </Pressable>
          <Text style={styles.cardHintSmall}>
            Give it access to the apple-of-fortune repository, with “Contents”
            read/write and “Actions” read permission.
          </Text>
          <TextInput
            style={styles.tokenInput}
            value={tokenInput}
            onChangeText={setTokenInput}
            placeholder="github_pat_…"
            placeholderTextColor="#6b8079"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          {tokenError ? <Text style={styles.error}>{tokenError}</Text> : null}
          <Pressable
            style={[styles.primaryBtn, savingToken && styles.btnDisabled]}
            onPress={onSaveToken}
            disabled={savingToken}
          >
            {savingToken ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>Save token</Text>
            )}
          </Pressable>
        </View>
      ) : (
        /* ---------- main control panel ---------- */
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>New app name (home screen)</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Lucky Apple"
            placeholderTextColor="#6b8079"
            editable={!busy}
          />

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
            New launcher icon
          </Text>
          <View style={styles.iconRow}>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={styles.iconPreview}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.iconPreview, styles.iconEmpty]}>
                <Ionicons name="image-outline" size={22} color="#6b8079" />
              </View>
            )}
            <Pressable
              style={[styles.chooseBtn, busy && styles.btnDisabled]}
              onPress={pickIcon}
              disabled={busy}
            >
              <Text style={styles.chooseBtnText}>Choose image</Text>
            </Pressable>
            {imageUri ? (
              <Pressable
                style={styles.clearBtn}
                onPress={() => {
                  setImageUri(null);
                  setImageBase64(null);
                }}
                disabled={busy}
              >
                <Text style={styles.chooseBtnText}>Clear</Text>
              </Pressable>
            ) : null}
          </View>

          <Pressable
            style={[styles.primaryBtn, busy && styles.btnDisabled]}
            onPress={startBuild}
            disabled={busy}
          >
            {phase === "submitting" ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="rocket" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>Build new APK</Text>
              </>
            )}
          </Pressable>

          {/* status / result */}
          {phase === "building" ? (
            <View style={styles.statusBox}>
              <ActivityIndicator color={PALETTE.green} size="small" />
              <Text style={styles.statusText}>{statusText}</Text>
              <Pressable style={styles.ghostBtn} onPress={() => poll()}>
                <Ionicons name="refresh" size={14} color="#cfe0db" />
                <Text style={styles.ghostBtnText}>Check now</Text>
              </Pressable>
              <Pressable
                style={styles.ghostBtn}
                onPress={() => open(ACTIONS_URL)}
              >
                <Ionicons name="open-outline" size={14} color="#cfe0db" />
                <Text style={styles.ghostBtnText}>View build on GitHub</Text>
              </Pressable>
            </View>
          ) : null}

          {phase === "done" ? (
            <View style={styles.statusBox}>
              <View style={styles.doneRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={PALETTE.green}
                />
                <Text style={styles.doneText}>{statusText}</Text>
              </View>
              <Pressable
                style={styles.primaryBtn}
                onPress={() => open(apkUrl ?? RELEASES_URL)}
              >
                <Ionicons name="download" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>Download APK</Text>
              </Pressable>
            </View>
          ) : null}

          {phase === "error" ? (
            <View style={styles.statusBox}>
              <Text style={styles.error}>{errorMsg}</Text>
              <Pressable
                style={styles.ghostBtn}
                onPress={() => open(ACTIONS_URL)}
              >
                <Ionicons name="open-outline" size={14} color="#cfe0db" />
                <Text style={styles.ghostBtnText}>Open GitHub builds</Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable style={styles.disconnect} onPress={onClearToken}>
            <Text style={styles.disconnectText}>Disconnect GitHub token</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  headRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  heading: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  sub: {
    color: PALETTE.textMuted,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
  },
  card: {
    backgroundColor: "#06322f",
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(164,209,60,0.2)",
  },
  cardTitle: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  cardHint: {
    color: PALETTE.textMuted,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
  },
  cardHintSmall: {
    color: PALETTE.textMuted,
    fontSize: 11,
    marginTop: 8,
    lineHeight: 15,
    fontFamily: "Inter_400Regular",
  },
  fieldLabel: {
    color: "#eef4f1",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#0d2723",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  tokenInput: {
    backgroundColor: "#0d2723",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    marginTop: 10,
  },
  iconRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconPreview: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#0d2723",
  },
  iconEmpty: { alignItems: "center", justifyContent: "center" },
  chooseBtn: {
    backgroundColor: PALETTE.button,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  chooseBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  clearBtn: {
    backgroundColor: "#5a2330",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  primaryBtn: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: PALETTE.green,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  primaryBtnText: { color: "#08210b", fontSize: 15, fontFamily: "Inter_700Bold" },
  btnDisabled: { opacity: 0.5 },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0d2723",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 10,
    alignSelf: "flex-start",
  },
  linkBtnText: { color: "#cfe0db", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  statusBox: {
    marginTop: 14,
    gap: 10,
    backgroundColor: "#0d2723",
    borderRadius: 10,
    padding: 12,
  },
  statusText: {
    color: "#eef4f1",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_500Medium",
  },
  doneRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  doneText: {
    flex: 1,
    color: "#eef4f1",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_600SemiBold",
  },
  ghostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  ghostBtnText: { color: "#cfe0db", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  error: {
    color: "#ff9aa6",
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter_500Medium",
    marginTop: 8,
  },
  disconnect: { marginTop: 14, alignSelf: "center" },
  disconnectText: {
    color: "#6b8079",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textDecorationLine: "underline",
  },
});
