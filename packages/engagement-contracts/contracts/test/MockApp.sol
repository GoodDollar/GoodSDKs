// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IEngagementRewards {
    function claim(
        address inviter,
        uint256 userPercentage,
        uint256 inviterPercentage
    ) external returns (bool);

    function claimWithSignature(
        address app,
        address inviter,
        uint256 validUntilBlock,
        bytes memory signature
    ) external returns (bool);
}

contract MockApp {
    IEngagementRewards public immutable rewards;

    constructor(address _rewards) {
        rewards = IEngagementRewards(_rewards);
    }

    function claimReward(
        address inviter,
        uint256 userPercentage,
        uint256 inviterPercentage
    ) external returns (bool) {
        return rewards.claim(inviter, userPercentage, inviterPercentage);
    }

    // Overload for backward compatibility
    function claimReward(address inviter) external returns (bool) {
        return rewards.claim(inviter, 0, 0);
    }

    function claimReward(
        address inviter,
        uint256 validUntilBlock,
        bytes memory signature
    ) external returns (bool) {
        return
            rewards.claimWithSignature(
                address(this),
                inviter,
                validUntilBlock,
                signature
            );
    }
}
