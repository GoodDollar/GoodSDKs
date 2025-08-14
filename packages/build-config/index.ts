import { builtinModules } from "module"

/**
 * Generate list of Node.js built-in modules for external configuration
 * Includes both standard names and node: prefixed versions
 */
export function getNodeBuiltins(): string[] {
  return [
    ...builtinModules,
    ...builtinModules.map((m) => `node:${m}`)
  ]
}

/**
 * Generate globals mapping for Node.js built-ins
 * Maps both `foo` and `node:foo` to global `foo`
 */
export function getNodeBuiltinGlobals(): Record<string, string> {
  const builtins = getNodeBuiltins()
  return builtins.reduce((acc, name) => {
    // Strip the `node:` prefix for the global key if present
    const key = name.startsWith('node:') ? name.slice(5) : name
    // Map both `foo` and `node:foo` → global `foo`
    acc[name] = key
    return acc
  }, {} as Record<string, string>)
}

/**
 * Common external dependencies for browser builds
 */
export const COMMON_EXTERNALS = [
  "@goodsdks/citizen-sdk",
  "viem",
  ...getNodeBuiltins()
]

/**
 * Regex pattern to match all node: imports
 */
export const NODE_MODULES_REGEX = /^node:/
