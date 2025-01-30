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
        return engagementRewards.appClaim(inviter, nonce, signature);
    }

    function claimReward(
        address inviter,
        uint256 nonce,
        bytes memory signature
    ) external returns (bool) {
        try engagementRewards.appClaim(inviter, nonce, signature) returns (
            bool success
        ) {
            return success;
        } catch {
            return false;
        }
    }

    function claimRewardWithOverride(
        address inviter,
        uint256 nonce,
        bytes memory signature,
        uint256 userAndInviterP,
        uint256 userP
    ) external returns (bool) {
        return
            engagementRewards.appClaim(
                inviter,
                nonce,
                signature,
                userAndInviterP,
                userP
            );
    }
}
