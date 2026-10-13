export const RELEASE_MARKER = "chore(release): publish"

// This ordered allowlist is the complete npm release surface. Keep dependencies
// before their published consumers because verification and publication reuse it
// as their topological order.
export const packages = [
  { name: "@goodsdks/bridging-sdk", dir: "packages/bridging-sdk" },
  { name: "@goodsdks/citizen-sdk", dir: "packages/citizen-sdk" },
  { name: "@goodsdks/engagement-sdk", dir: "packages/engagement-sdk" },
  { name: "@goodsdks/good-reserve", dir: "packages/good-reserve" },
  { name: "@goodsdks/invite-sdk", dir: "packages/invite-sdk" },
  { name: "@goodsdks/savings-sdk", dir: "packages/savings-sdk" },
  { name: "@goodsdks/streaming-sdk", dir: "packages/streaming-sdk" },
  { name: "@goodsdks/react-hooks", dir: "packages/react-hooks" },
  { name: "@goodsdks/savings-widget", dir: "packages/savings-widget" },
  { name: "@goodsdks/ui-components", dir: "packages/ui-components" },
]

// A package change also releases every published consumer reachable from here,
// ensuring their manifests and lockfile resolve the newly released dependency.
export const consumers = {
  "@goodsdks/bridging-sdk": ["@goodsdks/react-hooks"],
  "@goodsdks/citizen-sdk": ["@goodsdks/react-hooks", "@goodsdks/ui-components"],
  "@goodsdks/engagement-sdk": [],
  "@goodsdks/good-reserve": ["@goodsdks/react-hooks"],
  "@goodsdks/invite-sdk": ["@goodsdks/react-hooks"],
  "@goodsdks/savings-sdk": ["@goodsdks/savings-widget"],
  "@goodsdks/streaming-sdk": ["@goodsdks/react-hooks"],
  "@goodsdks/react-hooks": [],
  "@goodsdks/savings-widget": [],
  "@goodsdks/ui-components": [],
}

export const packageByName = new Map(packages.map((pkg) => [pkg.name, pkg]))
