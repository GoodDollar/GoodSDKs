import { useState } from "react"
import { useChainId } from "wagmi"
import { useWalletLink } from "@goodsdks/react-hooks"
import { Address, isAddress } from "viem"

export const WalletLinkWidget = () => {
  const [targetAddress, setTargetAddress] = useState("")
  const currentChainId = useChainId()
  const parsedAddress = isAddress(targetAddress)
    ? (targetAddress as Address)
    : undefined

  const { connectAccount, disconnectAccount, connectedStatus } = useWalletLink(
    "development",
    parsedAddress,
  )

  const currentChainStatus = connectedStatus.statuses.find(
    (status) => status.chainId === currentChainId,
  )

  const handleConnect = async () => {
    if (!parsedAddress) {
      alert("Invalid Ethereum address format.")
      return
    }

    try {
      await connectAccount.connect(parsedAddress)
      connectedStatus.refetch()
    } catch (err) {
      console.error("Connect failed", err)
    }
  }

  const handleDisconnect = async () => {
    if (!parsedAddress) {
      alert("Invalid Ethereum address format.")
      return
    }

    try {
      await disconnectAccount.disconnect(parsedAddress)
      connectedStatus.refetch()
    } catch (err) {
      console.error("Disconnect failed", err)
    }
  }

  const handleCheckStatus = () => {
    if (!parsedAddress) {
      alert("Invalid Ethereum address format.")
      return
    }

    connectedStatus.refetch()
  }

  if (
    connectAccount.pendingSecurityConfirm ||
    disconnectAccount.pendingSecurityConfirm
  ) {
    const pending =
      connectAccount.pendingSecurityConfirm ||
      disconnectAccount.pendingSecurityConfirm
    const confirmFn = connectAccount.pendingSecurityConfirm
      ? connectAccount.confirmSecurity
      : disconnectAccount.confirmSecurity

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
          {pending?.message}
        </pre>
        <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
          <button
            onClick={() => confirmFn(true)}
            style={{ background: "red", color: "white", padding: "8px" }}
          >
            I Understand, Proceed
          </button>
          <button onClick={() => confirmFn(false)} style={{ padding: "8px" }}>
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
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={handleConnect}
            disabled={connectAccount.loading || !parsedAddress}
          >
            {connectAccount.loading ? "Connecting..." : "Connect Wallet"}
          </button>
          <button
            onClick={handleDisconnect}
            disabled={disconnectAccount.loading || !parsedAddress}
          >
            {disconnectAccount.loading
              ? "Disconnecting..."
              : "Disconnect Wallet"}
          </button>
          <button onClick={handleCheckStatus} disabled={!parsedAddress}>
            Check Status
          </button>
        </div>
      </div>

      {(connectAccount.error ||
        disconnectAccount.error ||
        connectedStatus.error) && (
        <p style={{ color: "red" }}>
          Error:{" "}
          {connectAccount.error ||
            disconnectAccount.error ||
            connectedStatus.error}
        </p>
      )}

      {(connectAccount.txHash || disconnectAccount.txHash) && (
        <p style={{ color: "green" }}>
          Tx Hash: {connectAccount.txHash || disconnectAccount.txHash}
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
