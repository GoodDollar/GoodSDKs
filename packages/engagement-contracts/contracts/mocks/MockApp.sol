// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "../EngagementRewards.sol";

contract MockApp {
    EngagementRewards public engagementRewards;

    constructor(address _engagementRewards) {
        engagementRewards = EngagementRewards(_engagementRewards);
    }

    function claimRewardWithReason(
        address inviter,
        uint256 nonce,
        bytes memory signature
    ) external returns (bool) {
        return
            engagementRewards.appClaim(msg.sender, inviter, nonce, signature);
    }

    function claimReward(
        address inviter,
        uint256 nonce,
        bytes memory signature
    ) external returns (bool) {
        try
            engagementRewards.appClaim(msg.sender, inviter, nonce, signature)
        returns (bool success) {
            return success;
        } catch {
            return false;
        }
    }

    function claimRewardWithOverride(
        address inviter,
        uint256 nonce,
        bytes memory signature,
        uint8 userInviterPercentage,
        uint8 userPercentage
    ) external returns (bool) {
        return
            engagementRewards.appClaim(
                msg.sender,
                inviter,
                nonce,
                signature,
                userInviterPercentage,
                userPercentage
            );
    }

    // Add function to generate app signatures using EIP-1271
    bytes4 internal constant MAGIC_VALUE = 0x1626ba7e;

    function isValidSignature(
        bytes32 hash,
        bytes memory
    ) external pure returns (bytes4) {
        // For testing purposes, always return valid signature
        return MAGIC_VALUE;
    }

    // Helper to generate app signature for testing
    function getAppSignature(
        address user,
        uint256 validUntilBlock
    ) external pure returns (bytes memory) {
        // Return empty bytes since we're using EIP-1271 validation
        return "";
    }
}
