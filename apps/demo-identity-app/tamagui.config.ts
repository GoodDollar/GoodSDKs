import { createTamagui } from "tamagui";

import { tokens } from "./src/styles/tokens";
import { themes } from "./src/styles/themes";
import { shorthands } from "./src/styles/shorthands";

export const config = createTamagui({
  tokens,
  themes,
  shorthands,
});
