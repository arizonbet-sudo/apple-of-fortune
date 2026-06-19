import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLS, formatMoney, PALETTE, Settings } from "@/constants/game";

type Props = {
  visible: boolean;
  onClose: () => void;
  settings: Settings;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  balance: number;
  setBalance: (n: number) => void;
  bet: number;
  setBet: (n: number) => void;
  onReset: () => void;
};

export function AdminMenu({
  visible,
  onClose,
  settings,
  setSetting,
  balance,
  setBalance,
  bet,
  setBet,
  onReset,
}: Props) {
  const insets = useSafeAreaInsets();

  const pickImage = async (key: "appLogoUri" | "loadingLogoUri") => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });
    if (!res.canceled && res.assets?.[0]?.uri) {
      setSetting(key, res.assets[0].uri);
    }
  };

  const posLabel = (n: number) => (n < 0 ? "Off" : `${n + 1}`);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        entering={FadeIn.duration(220)}
        exiting={FadeOut.duration(200)}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          entering={FadeIn.duration(260)}
          exiting={FadeOut.duration(200)}
          style={[
            styles.sheet,
            { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 20 },
          ]}
        >
          <View style={styles.headerRow}>
            <View style={styles.bonusDot}>
              <Text style={styles.bonusDotText}>BONUS</Text>
            </View>
            <Text style={styles.title}>Admin menu</Text>
            <Pressable hitSlop={12} onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <NumberRow
              label="Change Balance"
              value={balance}
              onSubmit={(n) => setBalance(n)}
            />
            <NumberRow
              label="Change Bet Amount"
              value={bet}
              onSubmit={(n) => setBet(n)}
            />
            <TextRow
              label="Change Player Name"
              placeholder="Player"
              value={settings.playerName}
              onSubmit={(v) => setSetting("playerName", v)}
            />
            <TextRow
              label="Change App Name"
              placeholder="APPLE OF FORTUNE"
              value={settings.appName}
              onSubmit={(v) =>
                setSetting("appName", v.trim() || "APPLE OF FORTUNE")
              }
            />
            <ImageRow
              label="Change App Icon / Logo"
              uri={settings.appLogoUri}
              onPick={() => pickImage("appLogoUri")}
              onClear={() => setSetting("appLogoUri", null)}
            />
            <ImageRow
              label="Change Loading Logo"
              uri={settings.loadingLogoUri}
              onPick={() => pickImage("loadingLogoUri")}
              onClear={() => setSetting("loadingLogoUri", null)}
            />
            <SegmentRow
              label="Change Apple Position"
              value={settings.applePos}
              onChange={(n) => setSetting("applePos", n)}
              render={posLabel}
            />
            <SegmentRow
              label="Change Lose Position"
              value={settings.losePos}
              onChange={(n) => setSetting("losePos", n)}
              render={posLabel}
            />
            <ToggleRow
              label="Win Mode"
              hint="Every tap is a safe apple"
              value={settings.winMode}
              onChange={(v) => {
                setSetting("winMode", v);
                if (v) setSetting("loseMode", false);
              }}
            />
            <ToggleRow
              label="Lose Mode"
              hint="Every tap is a core"
              value={settings.loseMode}
              onChange={(v) => {
                setSetting("loseMode", v);
                if (v) setSetting("winMode", false);
              }}
            />
            <ToggleRow
              label="Auto Win"
              hint="Auto-plays to the top"
              value={settings.autoWin}
              onChange={(v) => {
                setSetting("autoWin", v);
                if (v) setSetting("autoLose", false);
              }}
            />
            <ToggleRow
              label="Auto Lose"
              hint="Auto-taps to lose"
              value={settings.autoLose}
              onChange={(v) => {
                setSetting("autoLose", v);
                if (v) setSetting("autoWin", false);
              }}
            />

            <Pressable
              style={styles.resetBtn}
              onPress={() => {
                onReset();
                onClose();
              }}
            >
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.resetText}>Reset Game</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

/* ---------------- rows ---------------- */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}

function NumberRow({
  label,
  value,
  onSubmit,
}: {
  label: string;
  value: number;
  onSubmit: (n: number) => void;
}) {
  const [text, setText] = useState(String(Math.round(value)));
  useEffect(() => {
    setText(String(Math.round(value)));
  }, [value]);
  return (
    <Row label={label}>
      <View style={styles.inlineRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor="#6b8079"
        />
        <Pressable
          style={styles.setBtn}
          onPress={() => {
            const n = Number(text.replace(/[^0-9.]/g, ""));
            if (Number.isFinite(n)) onSubmit(n);
          }}
        >
          <Text style={styles.setText}>Set</Text>
        </Pressable>
      </View>
      <Text style={styles.helper}>{formatMoney(value)} сўм</Text>
    </Row>
  );
}

function TextRow({
  label,
  value,
  placeholder,
  onSubmit,
}: {
  label: string;
  value: string;
  placeholder: string;
  onSubmit: (v: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => {
    setText(value);
  }, [value]);
  return (
    <Row label={label}>
      <View style={styles.inlineRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor="#6b8079"
        />
        <Pressable style={styles.setBtn} onPress={() => onSubmit(text)}>
          <Text style={styles.setText}>Set</Text>
        </Pressable>
      </View>
    </Row>
  );
}

function ImageRow({
  label,
  uri,
  onPick,
  onClear,
}: {
  label: string;
  uri: string | null;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <Row label={label}>
      <View style={styles.inlineRow}>
        {uri ? (
          <Image source={{ uri }} style={styles.preview} contentFit="cover" />
        ) : (
          <View style={[styles.preview, styles.previewEmpty]}>
            <Ionicons name="image-outline" size={20} color="#6b8079" />
          </View>
        )}
        <Pressable style={styles.setBtn} onPress={onPick}>
          <Text style={styles.setText}>Choose</Text>
        </Pressable>
        {uri ? (
          <Pressable style={styles.clearBtn} onPress={onClear}>
            <Text style={styles.setText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
    </Row>
  );
}

function SegmentRow({
  label,
  value,
  onChange,
  render,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  render: (n: number) => string;
}) {
  const options = [-1, ...Array.from({ length: COLS }, (_, i) => i)];
  return (
    <Row label={label}>
      <View style={styles.segment}>
        {options.map((opt) => {
          const active = opt === value;
          return (
            <Pressable
              key={opt}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
              onPress={() => onChange(opt)}
            >
              <Text
                style={[
                  styles.segmentText,
                  active && styles.segmentTextActive,
                ]}
              >
                {render(opt)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Row>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={[styles.row, styles.toggleRow]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.helper}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#143b35", true: PALETTE.green }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2,12,11,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "92%",
    backgroundColor: "#0d2723",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderColor: "rgba(164,209,60,0.25)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  bonusDot: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#4a4f50",
    borderStyle: "dashed",
    backgroundColor: PALETTE.bonus,
    alignItems: "center",
    justifyContent: "center",
  },
  bonusDotText: { color: "#d9a441", fontSize: 8, fontFamily: "Inter_700Bold" },
  title: { flex: 1, color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  closeBtn: { padding: 4 },

  scroll: { marginTop: 4 },
  scrollContent: { paddingBottom: 8 },

  row: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.08)" },
  rowLabel: { color: "#eef4f1", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  helper: { color: PALETTE.textMuted, fontSize: 11, marginTop: 4, fontFamily: "Inter_400Regular" },

  inlineRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  input: {
    flex: 1,
    backgroundColor: "#06322f",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  setBtn: {
    backgroundColor: PALETTE.button,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  clearBtn: {
    backgroundColor: "#5a2330",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  setText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },

  preview: { width: 42, height: 42, borderRadius: 8, backgroundColor: "#06322f" },
  previewEmpty: { alignItems: "center", justifyContent: "center" },

  segment: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  segmentItem: {
    flex: 1,
    backgroundColor: "#06322f",
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
  },
  segmentItemActive: { backgroundColor: PALETTE.green },
  segmentText: { color: "#cfe0db", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  segmentTextActive: { color: "#16320a", fontFamily: "Inter_700Bold" },

  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },

  resetBtn: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#7a2230",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  resetText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
