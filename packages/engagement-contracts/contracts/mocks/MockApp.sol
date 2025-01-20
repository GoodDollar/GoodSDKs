// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IEngagementRewards {
    function claim(address inviter) external returns (bool);
}

contract MockApp {
    IEngagementRewards public engagementRewards;

    constructor(address _engagementRewards) {
        engagementRewards = IEngagementRewards(_engagementRewards);
    }

    function claimReward(address inviter) external returns (bool) {
        return engagementRewards.claim(inviter);
    }
}
