import { builtinModules } from "module";

/**
 * Generate Node.js built-ins dynamically for build configurations
 * This utility provides consistent Node.js built-ins handling across Vite and tsup configs
 */

// Generate Node.js built-ins array with both regular and node: prefixed variants
export const nodeBuiltins = [
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`)
];

// Generate globals mapping for Node.js built-ins
export const nodeBuiltinGlobals = nodeBuiltins.reduce((acc, name) => {
  const key = name.startsWith('node:') ? name.slice(5) : name;
  acc[name] = key;
  return acc;
}, {} as Record<string, string>);

/**
 * Get external dependencies configuration for build tools
 * @param additionalExternals - Additional external dependencies to include
 * @returns Array of external dependencies
 */
export function getExternalDependencies(additionalExternals: string[] = []): string[] {
  return [
    ...additionalExternals,
    ...nodeBuiltins
  ];
}

/**
 * Get globals configuration for build tools
 * @param additionalGlobals - Additional globals to include
 * @returns Object mapping module names to global variable names
 */
export function getGlobalsConfig(additionalGlobals: Record<string, string> = {}): Record<string, string> {
  return {
    ...additionalGlobals,
    ...nodeBuiltinGlobals
  };
}
