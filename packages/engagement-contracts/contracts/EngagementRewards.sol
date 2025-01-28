// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

// import "hardhat/console.sol";

interface IIdentity {
    function getWhitelistedRoot(address) external view returns (address);
}

contract EngagementRewards is
    Initializable,
    AccessControlUpgradeable,
    EIP712Upgradeable,
    UUPSUpgradeable
{
    using ECDSA for bytes32;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 private constant CLAIM_TYPEHASH =
        keccak256(
            "Claim(address app,address inviter,uint256 nonce,string description)"
        );

    IERC20 public rewardToken;
    IIdentity public identityContract;

    uint256 public constant CLAIM_COOLDOWN = 180 days;
    uint256 public constant APP_EXPIRATION = 365 days;

    uint256 public maxRewardsPerApp;
    uint256 public rewardAmount;

    struct AppInfo {
        bool isRegistered;
        bool isApproved;
        address owner;
        address rewardReceiver;
        uint256 registeredAt;
        uint256 lastResetAt;
        uint256 totalRewardsClaimed;
        uint256 userAndInviterPercentage;
        uint256 userPercentage;
        string description;
    }
    struct AppStats {
        uint256 numberOfRewards;
        uint256 totalAppRewards;
        uint256 totalUserRewards;
        uint256 totalInviterRewards;
    }
    struct UserInfo {
        bool isRegistered;
    }
    mapping(address => AppInfo) public registeredApps;
    mapping(address => mapping(address => uint256)) public lastClaimTimestamp;
    mapping(address => AppStats) public appsStats;
    mapping(address => mapping(address => UserInfo)) public userRegistrations;

    event AppApplied(
        address indexed app,
        address indexed owner,
        address rewardReceiver,
        uint256 userAndInviterPercentage,
        uint256 userPercentage
    );
    event AppApproved(address indexed app);
    event AppSettingsUpdated(
        address indexed app,
        uint256 userAndInviterPercentage,
        uint256 userPercentage
    );
    event RewardClaimed(
        address indexed app,
        address indexed user,
        address indexed inviter,
        uint256 appReward,
        uint256 userAmount,
        uint256 inviterAmount
    );
    event RewardAmountUpdated(uint256 newAmount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        IERC20 _rewardToken,
        IIdentity _identityContract,
        uint256 _maxRewardsPerApp,
        uint256 _rewardAmount
    ) public initializer {
        __AccessControl_init();
        __EIP712_init("EngagementRewards", "1.0");
        __UUPSUpgradeable_init();

        rewardToken = _rewardToken;
        identityContract = _identityContract;
        maxRewardsPerApp = _maxRewardsPerApp;
        rewardAmount = _rewardAmount;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function applyApp(
        address app,
        address rewardReceiver,
        uint256 userAndInviterPercentage,
        uint256 userPercentage,
        string memory description
    ) external {
        require(
            userAndInviterPercentage <= 100,
            "Invalid userAndInviterPercentage"
        );
        require(userPercentage <= 100, "Invalid userPercentage");
        require(!registeredApps[app].isRegistered, "App already registered");
        require(
            bytes(description).length <= 512 && bytes(description).length >= 50,
            "Invalid description"
        );

        registeredApps[app] = AppInfo({
            isRegistered: true,
            isApproved: false,
            owner: msg.sender,
            rewardReceiver: rewardReceiver,
            registeredAt: block.timestamp,
            lastResetAt: block.timestamp,
            totalRewardsClaimed: 0,
            userAndInviterPercentage: userAndInviterPercentage,
            userPercentage: userPercentage,
            description: description
        });

        emit AppApplied(
            app,
            msg.sender,
            rewardReceiver,
            userAndInviterPercentage,
            userPercentage
        );
    }

    function approve(address app) external onlyRole(ADMIN_ROLE) {
        require(registeredApps[app].isRegistered, "App not registered");
        require(!registeredApps[app].isApproved, "App already approved");

        registeredApps[app].isApproved = true;

        emit AppApproved(app);
    }

    function updateAppSettings(
        address app,
        address rewardReceiver,
        uint256 userAndInviterPercentage,
        uint256 userPercentage
    ) external {
        require(registeredApps[app].isRegistered, "App not registered");
        require(msg.sender == registeredApps[app].owner, "Not app owner");
        require(
            userAndInviterPercentage <= 100,
            "Invalid userAndInviterPercentage"
        );
        require(userPercentage <= 100, "Invalid userPercentage");

        registeredApps[app].rewardReceiver = rewardReceiver;
        registeredApps[app].userAndInviterPercentage = userAndInviterPercentage;
        registeredApps[app].userPercentage = userPercentage;

        emit AppSettingsUpdated(app, userAndInviterPercentage, userPercentage);
    }

    function claimAndRegister(
        address inviter,
        uint256 nonce,
        bytes memory signature
    ) public returns (bool) {
        if (nonce > 0 && signature.length > 0)
            return claimWithSignature(msg.sender, inviter, nonce, signature);
        else return claim(inviter);
    }

    function claim(address inviter) public returns (bool) {
        address app = msg.sender;
        address user = identityContract.getWhitelistedRoot(tx.origin);
        if (user == address(0)) return false;

        return _claim(app, user, inviter);
    }

    function claimWithSignature(
        address app,
        address inviter,
        uint256 validUntilBlock,
        bytes memory signature
    ) public returns (bool) {
        require(
            validUntilBlock <= block.number + 50,
            "ValidUntilBlock too far in future"
        );

        string memory description = registeredApps[app].description;
        bytes32 structHash = keccak256(
            abi.encode(
                CLAIM_TYPEHASH,
                app,
                inviter,
                validUntilBlock,
                keccak256(bytes(description))
            )
        );
        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = hash.recover(signature);

        require(
            identityContract.getWhitelistedRoot(signer) != address(0),
            "Signer not whitelisted"
        );

        if (!userRegistrations[app][signer].isRegistered) {
            userRegistrations[app][signer].isRegistered = true;
        }

        return _claim(app, signer, inviter);
    }

    function _claim(
        address app,
        address user,
        address inviter
    ) internal returns (bool) {
        if (!userRegistrations[app][user].isRegistered) return false;
        if (!canClaim(app, user)) return false;
        if (rewardAmount == 0) return false;

        AppInfo storage appInfo = registeredApps[app];
        if (!appInfo.isRegistered || !appInfo.isApproved) return false;
        if (appInfo.registeredAt + APP_EXPIRATION < block.timestamp)
            return false;

        bool isAppWithinLimit = updateClaimInfo(app, user);
        if (isAppWithinLimit == false) return false;

        uint256 userAndInviterAmount = (rewardAmount *
            appInfo.userAndInviterPercentage) / 100;
        uint256 userAmount = (userAndInviterAmount * appInfo.userPercentage) /
            100;
        uint256 inviterAmount = userAndInviterAmount - userAmount;

        uint256 appAmount = inviter != address(0)
            ? rewardAmount - userAndInviterAmount
            : rewardAmount - userAndInviterAmount + inviterAmount;

        AppStats storage appStat = appsStats[app];
        appStat.numberOfRewards += 1;
        appStat.totalAppRewards += appAmount;
        appStat.totalInviterRewards += inviterAmount;
        appStat.totalUserRewards += userAmount;

        if (appAmount > 0)
            rewardToken.transfer(appInfo.rewardReceiver, appAmount);
        if (userAmount > 0) rewardToken.transfer(user, userAmount);
        if (inviter != address(0) && inviterAmount > 0) {
            rewardToken.transfer(inviter, inviterAmount);
        }

        emit RewardClaimed(
            app,
            user,
            inviter,
            appAmount,
            userAmount,
            inviterAmount
        );
        return true;
    }

    function canClaim(address app, address user) internal view returns (bool) {
        uint256 lastClaim = lastClaimTimestamp[app][user];
        return block.timestamp >= lastClaim + CLAIM_COOLDOWN;
    }

    function updateClaimInfo(
        address app,
        address user
    ) internal returns (bool) {
        lastClaimTimestamp[app][user] = block.timestamp;

        AppInfo storage appInfo = registeredApps[app];

        if (block.timestamp >= appInfo.lastResetAt + CLAIM_COOLDOWN) {
            appInfo.totalRewardsClaimed = 0;
            appInfo.lastResetAt = block.timestamp;
        }

        if (appInfo.totalRewardsClaimed + rewardAmount > maxRewardsPerApp)
            return false;

        appInfo.totalRewardsClaimed += rewardAmount;
        return true;
    }

    function setMaxRewardsPerApp(
        uint256 _maxRewardsPerApp
    ) external onlyRole(ADMIN_ROLE) {
        maxRewardsPerApp = _maxRewardsPerApp;
    }

    function setRewardAmount(
        uint256 _rewardAmount
    ) external onlyRole(ADMIN_ROLE) {
        rewardAmount = _rewardAmount;
        emit RewardAmountUpdated(_rewardAmount);
    }

    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
