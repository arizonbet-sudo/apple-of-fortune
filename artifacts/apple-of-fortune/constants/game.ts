export const COLS = 5;
export const VISIBLE_ROWS = 7;

// Multipliers from bottom (index 0) to top (index 8).
export const MULTIPLIERS = [
  1.54, 1.93, 2.41, 4.02, 6.71, 11.18, 27.97, 69.93, 349.68,
];

// Number of safe (apple) cells per row, bottom -> top. The rest are cores.
export const SAFE_COUNTS = [4, 4, 4, 3, 3, 3, 2, 2, 1];

export const ROWS = MULTIPLIERS.length;

export const MIN_BET = 3000;
export const MAX_BET = 1649196.27;
export const DEFAULT_BET = 10000;
export const DEFAULT_BALANCE = 1000000;

export const STORAGE_KEY = "apple-of-fortune:balance:v1";

export const SPRITES = {
  wood: require("../assets/images/wood.png"),
  sprout: require("../assets/images/sprout.png"),
  apple: require("../assets/images/apple.png"),
  core: require("../assets/images/core.png"),
  bg: require("../assets/images/bg.png"),
};

export const PALETTE = {
  headerStrip: "#2d3132",
  balancePill: "#212425",
  orange: "#ef861f",
  button: "#22647a",
  buttonDark: "#0a3744",
  inputBg: "#093846",
  cashout: "#22647a",
  green: "#9ec256",
  greenDark: "#7aa23a",
  text: "#f3f7f5",
  textMuted: "#9fb2ae",
  pillBg: "#11302e",
  bonus: "#212425",
};

// ---- Admin / debug settings ----
export const SETTINGS_KEY = "apple-of-fortune:settings:v1";

export type Settings = {
  bet: number;
  playerName: string;
  appName: string;
  appLogoUri: string | null;
  loadingLogoUri: string | null;
  applePos: number; // -1 = off, else forced apple column (0..4) for active row
  losePos: number; // -1 = off, else forced core column (0..4) for active row
  winMode: boolean; // tapped tile is always safe
  loseMode: boolean; // tapped tile is always a core
  autoWin: boolean; // auto-play every round to the top (win)
  autoLose: boolean; // auto-tap to lose immediately
};

export const DEFAULT_SETTINGS: Settings = {
  bet: DEFAULT_BET,
  playerName: "",
  appName: "APPLE OF FORTUNE",
  appLogoUri: null,
  loadingLogoUri: null,
  applePos: -1,
  losePos: -1,
  winMode: false,
  loseMode: false,
  autoWin: false,
  autoLose: false,
};

export type CellType = "safe" | "core";
export type Phase = "betting" | "playing" | "won" | "lost";

export function generateBoard(): CellType[][] {
  return SAFE_COUNTS.map((safe) => {
    const cells: CellType[] = [];
    for (let i = 0; i < COLS; i++) cells.push(i < safe ? "safe" : "core");
    // Fisher-Yates shuffle
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    return cells;
  });
}

export function formatMoney(n: number, decimals = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: false,
  });
}
