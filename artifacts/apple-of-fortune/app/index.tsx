import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AdminMenu } from "@/components/AdminMenu";
import { useBalance } from "@/hooks/useBalance";
import { useSettings } from "@/hooks/useSettings";
import {
  CellType,
  COLS,
  DEFAULT_BALANCE,
  formatMoney,
  generateBoard,
  MAX_BET,
  MIN_BET,
  MULTIPLIERS,
  PALETTE,
  Phase,
  ROWS,
  Settings,
  SPRITES,
  VISIBLE_ROWS,
} from "@/constants/game";

const APP_ICON = require("../assets/images/icon.png");

// shared smooth ease-in-out curve for every timed animation
const EASE = Easing.inOut(Easing.ease);

type SpriteName = keyof typeof SPRITES;

export default function AppleOfFortune() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { balance, adjust, setBalance } = useBalance();
  const { settings, set: setSetting, reset: resetSettings } = useSettings();
  const settingsRef = useRef<Settings>(settings);
  settingsRef.current = settings;

  const [phase, setPhase] = useState<Phase>("betting");
  const [board, setBoard] = useState<CellType[][]>(() => generateBoard());
  const [currentRow, setCurrentRow] = useState(0);
  const [picks, setPicks] = useState<number[]>([]);
  const [winAmount, setWinAmount] = useState(0);
  const [adminOpen, setAdminOpen] = useState(false);
  const [showLoading, setShowLoading] = useState(true);
  // when a round ends, keep "Current win + Collect" on screen briefly, then fade
  const [endHold, setEndHold] = useState(false);

  // bet amount is persisted with the rest of the admin settings
  const bet = settings.bet;
  const updateBet = useCallback(
    (n: number) => {
      const clamped = Math.max(MIN_BET, Math.min(Math.round(n), MAX_BET));
      setSetting("bet", clamped);
    },
    [setSetting],
  );

  useEffect(() => {
    const id = setTimeout(() => setShowLoading(false), 1100);
    return () => clearTimeout(id);
  }, []);

  // ----- layout math (mirrors the 1080px reference grid) -----
  const H_PAD = 8;
  const PILL_COL = Math.round(width * 0.142);
  // breathing room between the multiplier column and the first game column
  const COL_GAP = Math.round(width * 0.022);
  const tilesArea = width - H_PAD * 2 - PILL_COL - COL_GAP;
  const colPitch = tilesArea / COLS;
  // smaller tiles with clear horizontal gaps, like the original (tiles do NOT touch)
  const tile = colPitch * 0.89;
  // vertical pitch larger than the tile so rows are separated by a small gap (no overlap)
  const pitchY = tile * 1.15;
  // nudge the whole board down a touch so high multipliers don't crowd the top
  const boardTop = insets.top + 116;
  const boardHeight = VISIBLE_ROWS * pitchY + (tile - pitchY);

  const bottomVisible = Math.max(
    0,
    Math.min(currentRow - 2, ROWS - VISIBLE_ROWS),
  );
  const railY = (bottomVisible - 2) * pitchY;
  const scroll = useSharedValue(railY);
  useEffect(() => {
    scroll.value = withTiming(railY, { duration: 360, easing: EASE });
  }, [railY, scroll]);
  const railStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scroll.value }],
  }));

  // shared pulse for the active sprout row
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 760, easing: EASE }),
        withTiming(1, { duration: 760, easing: EASE }),
      ),
      -1,
      true,
    );
  }, [pulse]);

  const revealed = phase === "won" || phase === "lost";
  const playing = phase === "playing";

  const busyRef = useRef(false);
  useEffect(() => {
    busyRef.current = false;
  }, [currentRow, phase]);

  const availableWin = currentRow > 0 ? bet * MULTIPLIERS[currentRow - 1] : 0;

  const decideSafe = useCallback(
    (col: number, row: number, b: CellType[][]) => {
      const s = settingsRef.current;
      if (s.autoLose || s.loseMode) return false;
      if (s.autoWin || s.winMode) return true;
      if (col === s.applePos) return true;
      if (col === s.losePos) return false;
      return b[row][col] === "safe";
    },
    [],
  );

  const startGame = useCallback(() => {
    if (phase === "playing" || busyRef.current) return;
    if (balance < bet || bet < MIN_BET) return;
    busyRef.current = true;
    setEndHold(false);
    adjust(-bet);
    setBoard(generateBoard());
    setPicks([]);
    setCurrentRow(0);
    setWinAmount(0);
    setPhase("playing");
  }, [adjust, balance, bet, phase]);

  const pick = useCallback(
    (col: number) => {
      if (phase !== "playing" || busyRef.current) return;
      busyRef.current = true;

      const safe = decideSafe(col, currentRow, board);
      const nextBoard = board.map((r) => [...r]);
      nextBoard[currentRow][col] = safe ? "safe" : "core";
      setBoard(nextBoard);

      const nextPicks = [...picks];
      nextPicks[currentRow] = col;
      setPicks(nextPicks);

      if (!safe) {
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
    [adjust, bet, board, currentRow, decideSafe, phase, picks],
  );

  // auto win / auto lose driver
  useEffect(() => {
    if (phase !== "playing") return;
    if (!settings.autoWin && !settings.autoLose) return;
    const id = setTimeout(() => pick(0), 600);
    return () => clearTimeout(id);
  }, [phase, currentRow, settings.autoWin, settings.autoLose, pick]);

  // on round end keep "Current win + Collect" visible ~450ms, then fade to end controls
  useEffect(() => {
    if (phase !== "won" && phase !== "lost") return;
    setEndHold(true);
    const id = setTimeout(() => setEndHold(false), 450);
    return () => clearTimeout(id);
  }, [phase]);

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
    setEndHold(false);
    setCurrentRow(0);
    setPicks([]);
    if (balance >= bet && bet >= MIN_BET) {
      adjust(-bet);
      setBoard(generateBoard());
      setPhase("playing");
    } else {
      setPhase("betting");
    }
  }, [adjust, balance, bet]);

  const newBet = useCallback(() => {
    setEndHold(false);
    setPhase("betting");
    setCurrentRow(0);
    setPicks([]);
  }, []);

  const changeBet = useCallback(
    (mode: "min" | "x2" | "half" | "max") => {
      if (phase === "playing") return;
      let next = bet;
      if (mode === "min") next = MIN_BET;
      else if (mode === "x2") next = bet * 2;
      else if (mode === "half") next = bet / 2;
      else if (mode === "max") next = Math.min(balance, MAX_BET);
      next = Math.min(next, balance || MAX_BET);
      updateBet(next);
    },
    [balance, bet, phase, updateBet],
  );

  const fullReset = useCallback(() => {
    resetSettings();
    setBalance(DEFAULT_BALANCE);
    setEndHold(false);
    setPhase("betting");
    setCurrentRow(0);
    setPicks([]);
    setWinAmount(0);
    setBoard(generateBoard());
  }, [resetSettings, setBalance]);

  const tileTypeFor = (
    row: number,
    col: number,
  ): { sprite: SpriteName; opacity: number; revealedTile: boolean } => {
    if (revealed) {
      const isCore = board[row][col] === "core";
      return {
        sprite: isCore ? "core" : "apple",
        opacity: 1,
        revealedTile: true,
      };
    }
    if (row < currentRow) {
      if (picks[row] === col)
        return { sprite: "apple", opacity: 1, revealedTile: true };
      return { sprite: "wood", opacity: 0.6, revealedTile: false };
    }
    if (row === currentRow) {
      return { sprite: "sprout", opacity: 1, revealedTile: false };
    }
    const dist = row - currentRow;
    return {
      sprite: "wood",
      opacity: dist <= 2 ? 1 : 0.9,
      revealedTile: false,
    };
  };

  // render rows from top down so lower rows paint in front
  const rowIndexes = useMemo(
    () => Array.from({ length: ROWS }, (_, i) => ROWS - 1 - i),
    [],
  );

  const cheatActive =
    settings.winMode ||
    settings.loseMode ||
    settings.autoWin ||
    settings.autoLose ||
    settings.applePos >= 0 ||
    settings.losePos >= 0;

  const canBet = balance >= bet && bet >= MIN_BET;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Image
        source={SPRITES.bg}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <BlurView
        intensity={7}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
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

        <Pressable
          hitSlop={8}
          onPress={() => setAdminOpen(true)}
          style={[styles.bonusBadge, cheatActive && styles.bonusBadgeActive]}
        >
          <Text
            style={[styles.bonusText, cheatActive && styles.bonusTextActive]}
          >
            BONUS
          </Text>
        </Pressable>
      </View>

      <View style={styles.titleRow}>
        <View style={styles.titleCenter}>
          {settings.appLogoUri ? (
            <Image
              source={{ uri: settings.appLogoUri }}
              style={styles.titleLogo}
              contentFit="contain"
            />
          ) : (
            <Text style={styles.title}>{settings.appName}</Text>
          )}
          {settings.playerName.trim().length > 0 && (
            <Text style={styles.playerName} numberOfLines={1}>
              {settings.playerName.trim()}
            </Text>
          )}
        </View>
        <View style={styles.infoIcon}>
          <Ionicons
            name="information-circle-outline"
            size={22}
            color="#cfd8d6"
          />
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
            const railTop = (ROWS - 1 - row) * pitchY;
            const isActive = row === currentRow && playing;
            const showMultiplier = phase !== "betting";
            return (
              <View
                key={row}
                style={[styles.rowAbs, { top: railTop, height: pitchY }]}
              >
                <View style={[styles.pillWrap, { width: PILL_COL }]}>
                  <View style={[styles.pill, isActive && styles.pillActive]}>
                    <Text
                      style={[
                        styles.pillText,
                        isActive && styles.pillTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {showMultiplier ? `x ${MULTIPLIERS[row].toFixed(2)}` : ""}
                    </Text>
                  </View>
                </View>

                <View style={[styles.tilesRow, { marginLeft: COL_GAP }]}>
                  {Array.from({ length: COLS }, (_, col) => {
                    const t = tileTypeFor(row, col);
                    const tappable = isActive;
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
                        <Tile
                          sprite={t.sprite}
                          opacity={t.opacity}
                          size={tile}
                          isActive={isActive}
                          pulse={pulse}
                          revealedTile={t.revealedTile}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </Animated.View>

        {phase === "lost" && (
          <Animated.View
            entering={FadeIn.duration(260)}
            exiting={FadeOut.duration(260)}
            pointerEvents="none"
            style={styles.overlay}
          >
            <Text style={styles.loseTitle}>Omadsizlik</Text>
            <Text style={styles.loseSub}>yana bir bor urinib ko`ring</Text>
          </Animated.View>
        )}
        {phase === "won" && (
          <Animated.View
            entering={FadeIn.duration(260)}
            exiting={FadeOut.duration(260)}
            pointerEvents="none"
            style={styles.overlay}
          >
            <Text style={styles.winTitle}>G'alaba!</Text>
            <Text style={styles.winSub}>
              Yutug'ingiz {formatMoney(winAmount)} сўм
            </Text>
          </Animated.View>
        )}
      </View>

      {/* ---------- Footer ---------- */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        {phase === "betting" && (
          <Animated.View
            key="betting"
            entering={FadeIn.duration(280)}
            exiting={FadeOut.duration(280)}
          >
            <BettingControls
              bet={bet}
              onChange={changeBet}
              onBet={startGame}
              onSettings={() => setAdminOpen(true)}
              onOneClick={startGame}
              canBet={canBet}
            />
          </Animated.View>
        )}
        {(phase === "playing" || endHold) && (
          <Animated.View
            key="playing"
            entering={FadeIn.duration(280)}
            exiting={FadeOut.duration(420)}
          >
            <PlayingControls
              available={phase === "won" ? winAmount : availableWin}
              canCash={playing && currentRow > 0}
              onCash={cashOut}
            />
          </Animated.View>
        )}
        {(phase === "lost" || phase === "won") && !endHold && (
          <Animated.View
            key="end"
            entering={FadeIn.duration(340)}
            exiting={FadeOut.duration(280)}
          >
            <EndControls bet={bet} onAgain={playAgain} onNew={newBet} />
          </Animated.View>
        )}
      </View>

      <AdminMenu
        visible={adminOpen}
        onClose={() => setAdminOpen(false)}
        settings={settings}
        setSetting={setSetting}
        balance={balance}
        setBalance={setBalance}
        bet={bet}
        setBet={updateBet}
        onReset={fullReset}
      />

      {showLoading && (
        <Animated.View exiting={FadeOut.duration(450)} style={styles.loading}>
          <Image
            source={settings.loadingLogoUri ? { uri: settings.loadingLogoUri } : APP_ICON}
            style={styles.loadingLogo}
            contentFit="contain"
          />
          <Text style={styles.loadingText}>{settings.appName}</Text>
        </Animated.View>
      )}
    </View>
  );
}

/* ---------------- Tile ---------------- */

function Tile({
  sprite,
  opacity,
  size,
  isActive,
  pulse,
  revealedTile,
}: {
  sprite: SpriteName;
  opacity: number;
  size: number;
  isActive: boolean;
  pulse: SharedValue<number>;
  revealedTile: boolean;
}) {
  const reveal = useSharedValue(1);
  const op = useSharedValue(opacity);
  const prevSprite = useRef(sprite);

  useEffect(() => {
    op.value = withTiming(opacity, { duration: 240, easing: EASE });
  }, [opacity, op]);

  useEffect(() => {
    if (prevSprite.current !== sprite) {
      prevSprite.current = sprite;
      if (revealedTile) {
        reveal.value = withSequence(
          withTiming(0.84, { duration: 110, easing: EASE }),
          withTiming(1.1, { duration: 150, easing: EASE }),
          withTiming(1, { duration: 140, easing: EASE }),
        );
      }
    }
  }, [sprite, revealedTile, reveal]);

  const aStyle = useAnimatedStyle(
    () => ({
      opacity: op.value,
      transform: [{ scale: isActive ? pulse.value : reveal.value }],
    }),
    [isActive],
  );

  const glossy = sprite === "apple" || sprite === "core" || sprite === "sprout";

  return (
    <Animated.View style={[styles.tileShadow, aStyle]}>
      <Image
        source={SPRITES[sprite]}
        contentFit="contain"
        transition={{ duration: 260, effect: "cross-dissolve" }}
        style={{ width: size, height: size }}
      />
      {glossy && (
        <View
          pointerEvents="none"
          style={[
            styles.gloss,
            {
              width: size * 0.46,
              height: size * 0.16,
              top: size * 0.14,
              left: size * 0.2,
              borderRadius: size * 0.1,
            },
          ]}
        />
      )}
    </Animated.View>
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
    scale.value = withSequence(
      withTiming(1.16, { duration: 130, easing: EASE }),
      withTiming(1, { duration: 170, easing: EASE }),
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
  onSettings,
  onOneClick,
  canBet,
}: {
  bet: number;
  onChange: (m: "min" | "x2" | "half" | "max") => void;
  onBet: () => void;
  onSettings: () => void;
  onOneClick: () => void;
  canBet: boolean;
}) {
  const atMin = bet <= MIN_BET;
  const atMax = bet >= MAX_BET;
  const adjustButtons = [
    ["MIN", "min", atMin],
    ["X2", "x2", atMax],
    ["X/2", "half", atMin],
    ["MAX", "max", atMax],
  ] as const;
  return (
    <View>
      <View style={styles.adjustRow}>
        {adjustButtons.map(([label, mode, disabled]) => (
          <Pressable
            key={mode}
            style={[styles.adjustBtn, disabled && styles.disabled]}
            disabled={disabled}
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
        <Pressable style={styles.tab} onPress={onSettings}>
          <Ionicons name="settings-sharp" size={16} color="#cfd8d6" />
          <Text style={styles.tabText}>SOZLASH</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, !canBet && styles.disabled]}
          disabled={!canBet}
          onPress={onOneClick}
        >
          <Ionicons name="flash" size={16} color="#cfd8d6" />
          <Text style={styles.tabText}>BIR BOSISHDA</Text>
        </Pressable>
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
      <View style={styles.winInfoBar}>
        <Text style={styles.winInfoText}>
          MAVJUD YUTUQ: {formatMoney(available)} сўм
        </Text>
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
  bgTint: { backgroundColor: "rgba(0,0,0,0.05)" },

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
  bonusBadgeActive: { borderColor: PALETTE.green, borderStyle: "solid" },
  bonusText: { color: "#d9a441", fontSize: 7, fontFamily: "Inter_700Bold" },
  bonusTextActive: { color: PALETTE.green },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  titleCenter: { alignItems: "center", justifyContent: "center" },
  title: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    letterSpacing: 1,
  },
  playerName: {
    color: PALETTE.textMuted,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    marginTop: 3,
  },
  titleLogo: { height: 30, width: 160 },
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
    borderRadius: 15,
    paddingHorizontal: 7,
    height: 28,
    minWidth: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  pillActive: { backgroundColor: PALETTE.green },
  pillText: { color: "#c9d6d2", fontSize: 10.5, fontFamily: "Inter_600SemiBold" },
  pillTextActive: { color: "#1c3500" },

  tilesRow: { flex: 1, flexDirection: "row", alignItems: "center" },
  tileCell: { alignItems: "center", justifyContent: "center" },
  tileShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  gloss: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.07)",
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  loseTitle: {
    color: "#fff",
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 8,
  },
  loseSub: {
    color: "#e6ece9",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
  },
  winTitle: {
    color: PALETTE.green,
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 8,
  },
  winSub: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },

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
  disabled: { opacity: 0.4 },
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

  winInfoBar: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,32,40,0.55)",
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 8,
  },
  winInfoText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cashBtn: {
    backgroundColor: PALETTE.button,
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: "center",
  },
  cashText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },

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

  loading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0c2b27",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  loadingLogo: { width: 120, height: 120, borderRadius: 24 },
  loadingText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
});
