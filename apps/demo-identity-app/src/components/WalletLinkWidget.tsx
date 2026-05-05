import { useState } from "react"
import { useChainId } from "wagmi"
import { useWalletLink } from "@goodsdks/react-hooks"
import { Address, isAddress } from "viem"
import { SDK_ENV } from "../config"

export const WalletLinkWidget = () => {
  const [targetAddress, setTargetAddress] = useState("")
  const [addressError, setAddressError] = useState<string | null>(null)
  const [activeAction, setActiveAction] = useState<
    "connect" | "disconnect" | null
  >(null)
  const currentChainId = useChainId()
  const parsedAddress = isAddress(targetAddress)
    ? (targetAddress as Address)
    : undefined

  const { actions, connectedStatus } = useWalletLink(
    SDK_ENV,
    parsedAddress,
  )

  const currentChainStatus = connectedStatus.statuses.find(
    (status) => status.chainId === currentChainId,
  )

  const getValidatedAddress = (): Address | null => {
    if (!parsedAddress) {
      setAddressError("Invalid Ethereum address format.")
      return null
    }

    setAddressError(null)
    return parsedAddress
  }

  const handleConnect = async () => {
    const address = getValidatedAddress()
    if (!address) return

    setActiveAction("connect")
    try {
      await actions.connect(address)
    } finally {
      connectedStatus.refetch()
      setActiveAction(null)
    }
  }

  const handleDisconnect = async () => {
    const address = getValidatedAddress()
    if (!address) return

    setActiveAction("disconnect")
    try {
      await actions.disconnect(address)
    } finally {
      connectedStatus.refetch()
      setActiveAction(null)
    }
  }

  const handleCheckStatus = () => {
    if (!getValidatedAddress()) return

    connectedStatus.refetch()
  }

  if (
    actions.pendingSecurityConfirm
  ) {
    const pending = actions.pendingSecurityConfirm

    return (
      <div
        style={{
          border: "2px solid red",
          padding: "1rem",
          margin: "1rem 0",
          borderRadius: "8px",
        }}
      >
        <h3>Security Notice</h3>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: "12px" }}>
          {pending.message}
        </pre>
        <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
          <button
            onClick={() => actions.confirmSecurity(true)}
            style={{ background: "red", color: "white", padding: "8px" }}
          >
            I Understand, Proceed
          </button>
          <button onClick={() => actions.confirmSecurity(false)} style={{ padding: "8px" }}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        border: "1px solid #ccc",
        padding: "1rem",
        borderRadius: "8px",
        marginTop: "2rem",
      }}
    >
      <h2>Wallet Link (Citizen SDK)</h2>

      <div style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          placeholder="0xSecondaryWalletAddress..."
          value={targetAddress}
          onChange={(e) => setTargetAddress(e.target.value)}
          style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
        />
        {addressError && (
          <p style={{ color: "red", marginTop: 0 }}>{addressError}</p>
        )}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={handleConnect}
            disabled={actions.loading || !parsedAddress}
          >
            {activeAction === "connect" && actions.loading
              ? "Connecting..."
              : "Connect Wallet"}
          </button>
          <button
            onClick={handleDisconnect}
            disabled={actions.loading || !parsedAddress}
          >
            {activeAction === "disconnect" && actions.loading
              ? "Disconnecting..."
              : "Disconnect Wallet"}
          </button>
          <button onClick={handleCheckStatus} disabled={!parsedAddress}>
            Check Status
          </button>
        </div>
      </div>

      {(actions.error || connectedStatus.error) && (
        <p style={{ color: "red" }}>
          Error:{" "}
          {actions.error || connectedStatus.error}
        </p>
      )}

      {actions.txHash && (
        <p style={{ color: "green" }}>
          Tx Hash: {actions.txHash}
        </p>
      )}

      <div
        style={{
          background: "#f5f5f5",
          padding: "10px",
          marginTop: "1rem",
          fontSize: "14px",
        }}
      >
        <h4>Status for {targetAddress || "..."}</h4>
        {connectedStatus.loading ? (
          <p>Loading status...</p>
        ) : (
          <>
            <p>
              <strong>Connected (Current Chain):</strong>{" "}
              {currentChainStatus?.isConnected ? "Yes" : "No"}
            </p>
            <p>
              <strong>Root Identity:</strong>{" "}
              {currentChainStatus?.root || "None"}
            </p>

            <details style={{ marginTop: "10px" }}>
              <summary>Multi-Chain Statuses</summary>
              <ul>
                {connectedStatus.statuses.map((chain) => (
                  <li key={chain.chainId}>
                    {chain.chainName}:{" "}
                    {chain.isConnected ? `Connected (Root: ${chain.root})` : "Not connected"}
                    {chain.error ? ` - ${chain.error}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </div>
    </div>
  )
}
