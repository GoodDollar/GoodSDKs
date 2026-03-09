import { normalizeAmount, denormalizeAmount } from "./packages/bridging-sdk/src/utils/decimals.ts"
import { SUPPORTED_CHAINS } from "./packages/bridging-sdk/src/constants.ts"

function test() {
  const ETH_ID = 1
  const FUSE_ID = 122
  const CELO_ID = 42220

  console.log("Testing Decimals Normalization...")

  // Fuse/ETH has 2 decimals, Celo has 18
  // 1.15 G$ on Fuse = 115 units
  const amountFuse = 115n
  const normalizedFuse = normalizeAmount(amountFuse, FUSE_ID)
  console.log(`Fuse: 115 units (2 dec) -> Normalized: ${normalizedFuse} (18 dec)`)
  if (normalizedFuse === 1150000000000000000n) {
    console.log("✅ Fuse normalization passed")
  } else {
    console.error("❌ Fuse normalization failed")
  }

  // 1.15 G$ on Celo = 1150000000000000000 units
  const amountCelo = 1150000000000000000n
  const normalizedCelo = normalizeAmount(amountCelo, CELO_ID)
  console.log(`Celo: 1.15e18 units (18 dec) -> Normalized: ${normalizedCelo} (18 dec)`)
  if (normalizedCelo === 1150000000000000000n) {
    console.log("✅ Celo normalization passed")
  } else {
    console.error("❌ Celo normalization failed")
  }

  // Denormalization
  const denormalizedFuse = denormalizeAmount(normalizedFuse, FUSE_ID)
  console.log(`Normalized: 1.15e18 -> Fuse Denormalized: ${denormalizedFuse} (2 dec)`)
  if (denormalizedFuse === 115n) {
    console.log("✅ Fuse denormalization passed")
  } else {
    console.error("❌ Fuse denormalization failed")
  }
}

test()
