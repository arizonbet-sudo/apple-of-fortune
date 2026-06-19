import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBalance } from "@/hooks/useBalance";
import {
  CellType,
  COLS,
  DEFAULT_BET,
  formatMoney,
  generateBoard,
  MAX_BET,
  MIN_BET,
  MULTIPLIERS,
  PALETTE,
  Phase,
  ROWS,
  SPRITES,
  VISIBLE_ROWS,
} from "@/constants/game";

const AImage = Animated.createAnimatedComponent(Image);

export default function AppleOfFortune() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { balance, adjust, setBalance } = useBalance();

  const [phase, setPhase] = useState<Phase>("betting");
  const [bet, setBet] = useState(DEFAULT_BET);
  const [board, setBoard] = useState<CellType[][]>(() => generateBoard());
  const [currentRow, setCurrentRow] = useState(0);
  const [picks, setPicks] = useState<number[]>([]);
  const [lostCell, setLostCell] = useState<{ row: number; col: number } | null>(
    null,
  );
  const [winAmount, setWinAmount] = useState(0);

  // ----- layout math (mirrors the 1080px reference grid) -----
  const H_PAD = 8;
  const PILL_COL = Math.round(width * 0.135);
  const tilesArea = width - H_PAD * 2 - PILL_COL;
  const colPitch = tilesArea / COLS;
  const tile = colPitch * 0.94;
  const pitchY = tile * 0.78; // tiles overlap vertically like the original
  const boardTop = insets.top + 96;
  const boardHeight = VISIBLE_ROWS * pitchY + (tile - pitchY);

  // bottom visible row index (0..2): how far the rail has scrolled up
  const bottomVisible = Math.max(0, Math.min(currentRow - 2, ROWS - VISIBLE_ROWS));
  const railY = (bottomVisible - 2) * pitchY;
  const scroll = useSharedValue(railY);

  useEffect(() => {
    scroll.value = withTiming(railY, { duration: 280 });
  }, [railY, scroll]);

  const railStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scroll.value }],
  }));

  // subtle pulse for active sprout row
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 700 }),
        withTiming(1, { duration: 700 }),
      ),
      -1,
      true,
    );
  }, [pulse]);
  const pulseAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const revealed = phase === "won" || phase === "lost";
  const playing = phase === "playing";

  // lock that prevents a second handler from firing within the same frame /
  // before React re-renders and disables the controls. Unlocks whenever the
  // game advances to a new row or changes phase.
  const busyRef = useRef(false);
  useEffect(() => {
    busyRef.current = false;
  }, [currentRow, phase]);

  const availableWin =
    currentRow > 0 ? bet * MULTIPLIERS[currentRow - 1] : 0;

  const startGame = useCallback(() => {
    if (phase !== "betting" || busyRef.current) return;
    if (balance < bet || bet < MIN_BET) return;
    busyRef.current = true;
    adjust(-bet);
    setBoard(generateBoard());
    setPicks([]);
    setCurrentRow(0);
    setLostCell(null);
    setWinAmount(0);
    setPhase("playing");
  }, [adjust, balance, bet]);

  const pick = useCallback(
    (col: number) => {
      if (phase !== "playing" || busyRef.current) return;
      busyRef.current = true;
      const cell = board[currentRow][col];
      const nextPicks = [...picks];
      nextPicks[currentRow] = col;
      setPicks(nextPicks);

      if (cell === "core") {
        setLostCell({ row: currentRow, col });
        setPhase("lost");
        return;
      }
      const next = currentRow + 1;
      if (next >= ROWS) {
        const win = bet * MULTIPLIERS[ROWS - 1];
        setWinAmount(win);
        adjust(win);
        setCurrentRow(next);
        setPhase("won");
      } else {
        setCurrentRow(next);
      }
    },
    [adjust, bet, board, currentRow, phase, picks],
  );

  const cashOut = useCallback(() => {
    if (!playing || currentRow === 0 || busyRef.current) return;
    busyRef.current = true;
    adjust(availableWin);
    setWinAmount(availableWin);
    setPhase("won");
  }, [adjust, availableWin, currentRow, playing]);

  const playAgain = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    setCurrentRow(0);
    setPicks([]);
    setLostCell(null);
    // immediately re-bet the same amount
    if (balance >= bet && bet >= MIN_BET) {
      adjust(-bet);
      setBoard(generateBoard());
      setPhase("playing");
    } else {
      setPhase("betting");
    }
  }, [adjust, balance, bet]);

  const newBet = useCallback(() => {
    setPhase("betting");
    setCurrentRow(0);
    setPicks([]);
    setLostCell(null);
  }, []);

  const changeBet = useCallback(
    (mode: "min" | "x2" | "half" | "max") => {
      if (phase === "playing") return;
      setBet((prev) => {
        let next = prev;
        if (mode === "min") next = MIN_BET;
        else if (mode === "x2") next = prev * 2;
        else if (mode === "half") next = prev / 2;
        else if (mode === "max") next = Math.min(balance, MAX_BET);
        next = Math.max(MIN_BET, Math.min(next, MAX_BET, balance || MAX_BET));
        return Math.round(next);
      });
    },
    [balance, phase],
  );

  const tileTypeFor = (
    row: number,
    col: number,
  ): { sprite: keyof typeof SPRITES; opacity: number } => {
    if (revealed) {
      const isCore = board[row][col] === "core";
      return { sprite: isCore ? "core" : "apple", opacity: 1 };
    }
    if (row < currentRow) {
      if (picks[row] === col) return { sprite: "apple", opacity: 1 };
      return { sprite: "wood", opacity: 0.4 };
    }
    if (row === currentRow) {
      return { sprite: "sprout", opacity: 1 };
    }
    const dist = row - currentRow;
    return { sprite: "wood", opacity: dist <= 2 ? 0.92 : 0.42 };
  };

  // render rows from top (8) to bottom (0) so lower rows paint in front
  const rowIndexes = useMemo(
    () => Array.from({ length: ROWS }, (_, i) => ROWS - 1 - i),
    [],
  );

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Image source={SPRITES.bg} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View style={[StyleSheet.absoluteFill, styles.bgTint]} />

      {/* ---------- Header ---------- */}
      <View style={[styles.headerStrip, { paddingTop: insets.top + 6 }]}>
        <Pressable hitSlop={10} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </Pressable>

        <View style={styles.balancePill}>
          <PopValue
            value={balance}
            format={(n) => `${formatMoney(n, 2)} сўм`}
            style={styles.balanceText}
          />
          <View style={styles.plusBtn}>
            <Ionicons name="add" size={20} color="#fff" />
          </View>
        </View>

        <View style={styles.bonusBadge}>
          <Text style={styles.bonusText}>BONUS</Text>
        </View>
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.title}>APPLE OF FORTUNE</Text>
        <View style={styles.infoIcon}>
          <Ionicons name="information-circle-outline" size={22} color="#cfd8d6" />
        </View>
      </View>

      {/* ---------- Board ---------- */}
      <View
        style={[
          styles.board,
          { top: boardTop, height: boardHeight, paddingHorizontal: H_PAD },
        ]}
      >
        <Animated.View style={[styles.rail, railStyle]}>
          {rowIndexes.map((row) => {
            const railTop = (ROWS - 1 - row) * pitchY - (tile - pitchY) / 2;
            const isActive = row === currentRow && !revealed;
            return (
              <View
                key={row}
                style={[
                  styles.rowAbs,
                  { top: railTop + (tile - pitchY) / 2, height: pitchY },
                ]}
              >
                {/* multiplier pill */}
                <View style={[styles.pillWrap, { width: PILL_COL }]}>
                  <View
                    style={[
                      styles.pill,
                      isActive && styles.pillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        isActive && styles.pillTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {phase === "betting" ? "" : `x ${MULTIPLIERS[row].toFixed(2)}`}
                    </Text>
                  </View>
                </View>

                {/* tiles */}
                <View style={styles.tilesRow}>
                  {Array.from({ length: COLS }, (_, col) => {
                    const t = tileTypeFor(row, col);
                    const tappable = isActive && playing;
                    return (
                      <Pressable
                        key={col}
                        disabled={!tappable}
                        onPress={() => pick(col)}
                        style={[
                          styles.tileCell,
                          { width: colPitch, height: pitchY },
                        ]}
                      >
                        <AImage
                          source={SPRITES[t.sprite]}
                          contentFit="contain"
                          style={[
                            {
                              width: tile,
                              height: tile,
                              opacity: t.opacity,
                            },
                            isActive && pulseAnimStyle,
                          ]}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </Animated.View>

        {/* overlay messages */}
        {phase === "lost" && (
          <View pointerEvents="none" style={styles.overlay}>
            <Text style={styles.loseTitle}>Omadsizlik</Text>
            <Text style={styles.loseSub}>yana bir bor urinib ko`ring</Text>
          </View>
        )}
        {phase === "won" && (
          <View pointerEvents="none" style={styles.overlay}>
            <Text style={styles.winTitle}>G'alaba!</Text>
            <Text style={styles.winSub}>
              Yutug'ingiz {formatMoney(winAmount)} сўм
            </Text>
          </View>
        )}
      </View>

      {/* ---------- Footer ---------- */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        {phase === "betting" && (
          <BettingControls
            bet={bet}
            onChange={changeBet}
            onBet={startGame}
            canBet={balance >= bet && bet >= MIN_BET}
          />
        )}
        {phase === "playing" && (
          <PlayingControls
            available={availableWin}
            canCash={currentRow > 0}
            onCash={cashOut}
          />
        )}
        {(phase === "lost" || phase === "won") && (
          <EndControls bet={bet} onAgain={playAgain} onNew={newBet} />
        )}
      </View>
    </View>
  );
}

/* ---------------- Animated number ---------------- */

function PopValue({
  value,
  format,
  style,
}: {
  value: number;
  format: (n: number) => string;
  style?: any;
}) {
  const scale = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // numbers jump straight to the final value with a subtle pop, no counting
    scale.value = withSequence(
      withTiming(1.16, { duration: 110 }),
      withTiming(1, { duration: 150 }),
    );
  }, [value, scale]);
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.Text style={[style, aStyle]} numberOfLines={1}>
      {format(value)}
    </Animated.Text>
  );
}

/* ---------------- Footer variants ---------------- */

function BettingControls({
  bet,
  onChange,
  onBet,
  canBet,
}: {
  bet: number;
  onChange: (m: "min" | "x2" | "half" | "max") => void;
  onBet: () => void;
  canBet: boolean;
}) {
  return (
    <View>
      <View style={styles.adjustRow}>
        {(
          [
            ["MIN", "min"],
            ["X2", "x2"],
            ["X/2", "half"],
            ["MAX", "max"],
          ] as const
        ).map(([label, mode]) => (
          <Pressable
            key={mode}
            style={styles.adjustBtn}
            onPress={() => onChange(mode)}
          >
            <Text style={styles.adjustText}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.betRow}>
        <View style={styles.betInput}>
          <Text style={styles.betValue}>{formatMoney(bet)} сўм</Text>
        </View>
        <Pressable
          style={[styles.garovBtn, !canBet && styles.disabled]}
          disabled={!canBet}
          onPress={onBet}
        >
          <Text style={styles.garovText}>GAROV</Text>
        </Pressable>
      </View>
      <Text style={styles.limitText}>
        min {formatMoney(MIN_BET)} сўм - max {formatMoney(MAX_BET, 2)} сўм
      </Text>

      <View style={styles.tabRow}>
        <View style={styles.tab}>
          <Ionicons name="settings-sharp" size={16} color="#cfd8d6" />
          <Text style={styles.tabText}>SOZLASH</Text>
        </View>
        <View style={styles.tab}>
          <Ionicons name="flash" size={16} color="#cfd8d6" />
          <Text style={styles.tabText}>BIR BOSISHDA</Text>
        </View>
      </View>
    </View>
  );
}

function PlayingControls({
  available,
  canCash,
  onCash,
}: {
  available: number;
  canCash: boolean;
  onCash: () => void;
}) {
  return (
    <View>
      <View style={styles.winInfoRow}>
        <Text style={styles.winInfoLabel}>MAVJUD YUTUQ</Text>
        <PopValue
          value={available}
          format={(n) => `${formatMoney(n)} сўм`}
          style={styles.winInfoValue}
        />
      </View>
      <Pressable
        style={[styles.cashBtn, !canCash && styles.disabled]}
        disabled={!canCash}
        onPress={onCash}
      >
        <Text style={styles.cashText}>YUTUQNI OLISH</Text>
      </Pressable>
    </View>
  );
}

function EndControls({
  bet,
  onAgain,
  onNew,
}: {
  bet: number;
  onAgain: () => void;
  onNew: () => void;
}) {
  return (
    <View>
      <Pressable style={styles.againBtn} onPress={onAgain}>
        <Text style={styles.againText}>
          YANA BIR BOR O'YNASH ({formatMoney(bet)} сўм)
        </Text>
      </Pressable>
      <Pressable style={styles.newBtn} onPress={onNew}>
        <Text style={styles.newText}>YANGI GAROV TURI</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0c2b27" },
  bgTint: { backgroundColor: "rgba(8,30,28,0.35)" },

  headerStrip: {
    backgroundColor: PALETTE.headerStrip,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: { padding: 2 },
  balancePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    justifyContent: "center",
    backgroundColor: PALETTE.balancePill,
    borderRadius: 22,
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 4,
    maxWidth: 280,
  },
  balanceText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  plusBtn: {
    marginLeft: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: PALETTE.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  bonusBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#4a4f50",
    borderStyle: "dashed",
    backgroundColor: PALETTE.bonus,
    alignItems: "center",
    justifyContent: "center",
  },
  bonusText: { color: "#d9a441", fontSize: 7, fontFamily: "Inter_700Bold" },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  title: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    letterSpacing: 1,
  },
  infoIcon: { position: "absolute", right: 16 },

  board: { position: "absolute", left: 0, right: 0, overflow: "hidden" },
  rail: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  rowAbs: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  pillWrap: { justifyContent: "center", alignItems: "flex-start" },
  pill: {
    backgroundColor: PALETTE.pillBg,
    borderRadius: 14,
    paddingHorizontal: 8,
    height: 26,
    minWidth: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  pillActive: { backgroundColor: PALETTE.green },
  pillText: { color: "#c9d6d2", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  pillTextActive: { color: "#1c3500" },

  tilesRow: { flex: 1, flexDirection: "row", alignItems: "center" },
  tileCell: { alignItems: "center", justifyContent: "center" },

  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  loseTitle: {
    color: "#fff",
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 8,
  },
  loseSub: { color: "#e6ece9", fontSize: 14, fontFamily: "Inter_500Medium", marginTop: 4 },
  winTitle: {
    color: PALETTE.green,
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 8,
  },
  winSub: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 4 },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  adjustRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  adjustBtn: {
    flex: 1,
    backgroundColor: PALETTE.button,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  adjustText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },

  betRow: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  betInput: {
    flex: 1,
    backgroundColor: PALETTE.inputBg,
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: "center",
    paddingVertical: 12,
  },
  betValue: { color: "#fff", fontSize: 18, fontFamily: "Inter_600SemiBold" },
  garovBtn: {
    backgroundColor: PALETTE.button,
    borderRadius: 8,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  garovText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  disabled: { opacity: 0.45 },
  limitText: {
    color: PALETTE.textMuted,
    fontSize: 11,
    marginTop: 6,
    marginLeft: 4,
  },

  tabRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.12)",
    paddingTop: 10,
  },
  tab: { flexDirection: "row", alignItems: "center", gap: 6 },
  tabText: { color: "#cfd8d6", fontSize: 12, fontFamily: "Inter_600SemiBold" },

  winInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: PALETTE.inputBg,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  winInfoLabel: { color: PALETTE.textMuted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  winInfoValue: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  cashBtn: {
    backgroundColor: PALETTE.green,
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: "center",
  },
  cashText: { color: "#1c3500", fontSize: 16, fontFamily: "Inter_700Bold" },

  againBtn: {
    backgroundColor: PALETTE.button,
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 8,
  },
  againText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  newBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  newText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
