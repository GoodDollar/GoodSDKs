// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IEngagementRewards {
    function claimAndRegister(
        address inviter,
        uint256 nonce,
        bytes memory signature
    ) external returns (bool);
}

contract MockApp {
    IEngagementRewards public engagementRewards;

    constructor(address _engagementRewards) {
        engagementRewards = IEngagementRewards(_engagementRewards);
    }

    function claimReward(
        address inviter,
        uint256 nonce,
        bytes memory signature
    ) external returns (bool) {
        return engagementRewards.claimAndRegister(inviter, nonce, signature);
    }
}
