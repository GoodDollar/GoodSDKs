// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

// import "hardhat/console.sol";

interface IIdentity {
    function getWhitelistedRoot(address) external view returns (address);
}

contract EngagementRewards is
    Initializable,
    AccessControlUpgradeable,
    EIP712Upgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    using ECDSA for bytes32;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 private constant CLAIM_TYPEHASH =
        keccak256(
            "Claim(address app,address inviter,uint256 validUntilBlock,string description)"
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
        string url;
        string email;
    }
    struct AppStats {
        uint256 numberOfRewards;
        uint256 totalAppRewards;
        uint256 totalUserRewards;
        uint256 totalInviterRewards;
    }
    struct UserInfo {
        uint256 isRegistered;
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
        require(
            address(_rewardToken) != address(0),
            "Zero address not allowed"
        );
        require(
            address(_identityContract) != address(0),
            "Zero address not allowed"
        );
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
        string memory description,
        string memory url,
        string memory email
    ) external {
        require(address(app) != address(0), "Zero address not allowed");
        require(
            address(rewardReceiver) != address(0),
            "Zero address not allowed"
        );
        require(
            userAndInviterPercentage <= 100,
            "Invalid userAndInviterPercentage"
        );
        require(userPercentage <= 100, "Invalid userPercentage");
        require(
            bytes(description).length <= 512 && bytes(description).length >= 50,
            "Invalid description"
        );
        require(
            bytes(url).length > 0 && bytes(url).length <= 255,
            "Invalid URL"
        );
        require(
            bytes(email).length > 0 && bytes(email).length <= 255,
            "Invalid email"
        );

        AppInfo storage existingApp = registeredApps[app];

        // If app was previously registered, ensure only owner can re-register
        if (existingApp.owner != address(0)) {
            require(msg.sender == existingApp.owner, "Not app owner");

            // Update only the fields that should be modified during re-registration
            existingApp.isApproved = false; // Reset approval on re-registration
            existingApp.rewardReceiver = rewardReceiver;
            existingApp.userAndInviterPercentage = userAndInviterPercentage;
            existingApp.userPercentage = userPercentage;
            existingApp.description = description;
            existingApp.url = url;
            existingApp.email = email;
            existingApp.registeredAt = block.timestamp;
        } else {
            // New registration
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
                description: description,
                url: url,
                email: email
            });
        }

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
        require(
            address(rewardReceiver) != address(0),
            "Zero address not allowed"
        );
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

    function appClaim(
        address inviter,
        uint256 validUntilBlock,
        bytes memory signature
    ) public returns (bool) {
        return
            _claim(
                msg.sender,
                inviter,
                validUntilBlock,
                signature,
                0,
                0,
                false
            );
    }

    function appClaim(
        address inviter,
        uint256 validUntilBlock,
        bytes memory signature,
        uint256 userAndInviterPercentage,
        uint256 userPercentage
    ) public returns (bool) {
        require(
            userAndInviterPercentage <= 100,
            "Invalid userAndInviterPercentage"
        );
        require(userPercentage <= 100, "Invalid userPercentage");

        return
            _claim(
                msg.sender,
                inviter,
                validUntilBlock,
                signature,
                userAndInviterPercentage,
                userPercentage,
                true
            );
    }

    function eoaClaim(
        address app,
        address inviter,
        uint256 validUntilBlock,
        bytes memory signature
    ) public returns (bool) {
        return _claim(app, inviter, validUntilBlock, signature, 0, 0, false);
    }

    function _validateSignature(
        address app,
        address inviter,
        uint256 validUntilBlock,
        bytes memory signature
    ) internal returns (address) {
        require(
            validUntilBlock <= block.number + 50,
            "ValidUntilBlock too far in future"
        );
        require(validUntilBlock >= block.number, "Signature expired");

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
        userRegistrations[app][signer].isRegistered = block.timestamp;

        return signer;
    }

    function _claim(
        address app,
        address inviter,
        uint256 validUntilBlock,
        bytes memory signature,
        uint256 userAndInviterPercentage,
        uint256 userPercentage,
        bool overridePercentages
    ) internal nonReentrant returns (bool) {
        address sender = tx.origin;
        if (validUntilBlock > 0 && signature.length > 0) {
            sender = _validateSignature(
                app,
                inviter,
                validUntilBlock,
                signature
            );
        }
        address user = identityContract.getWhitelistedRoot(sender);
        if (!canClaim(app, user)) return false;

        AppInfo storage appInfo = registeredApps[app];
        if (!appInfo.isRegistered || !appInfo.isApproved) return false;
        if (appInfo.registeredAt + APP_EXPIRATION < block.timestamp)
            return false;

        if (updateClaimInfo(app, user) == false) return false;

        _sendReward(
            app,
            appInfo.rewardReceiver,
            sender,
            inviter,
            overridePercentages
                ? userAndInviterPercentage
                : appInfo.userAndInviterPercentage,
            overridePercentages ? userPercentage : appInfo.userPercentage
        );

        return true;
    }

    function _sendReward(
        address app,
        address rewardReceiver,
        address user,
        address inviter,
        uint256 userAndInviterPercentage,
        uint256 userPercentage
    ) internal {
        uint256 userAndInviterAmount = (rewardAmount *
            (userAndInviterPercentage)) / 100;
        uint256 userAmount = (userAndInviterAmount * userPercentage) / 100;
        uint256 inviterAmount = userAndInviterAmount - userAmount;

        uint256 appAmount = rewardAmount - userAndInviterAmount;
        if (inviter == address(0)) {
            appAmount += inviterAmount; // Re-allocate inviter's share to the app
        }

        AppStats storage appStat = appsStats[app];
        appStat.numberOfRewards += 1;
        appStat.totalAppRewards += appAmount;
        appStat.totalInviterRewards += inviterAmount;
        appStat.totalUserRewards += userAmount;

        if (appAmount > 0) rewardToken.transfer(rewardReceiver, appAmount);
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
    }

    function canClaim(address app, address user) public view returns (bool) {
        uint256 lastClaim = lastClaimTimestamp[app][user];
        require(
            block.timestamp >= lastClaim + CLAIM_COOLDOWN,
            "Claim cooldown not reached"
        );
        require(user != address(0), "Invalid user address");
        require(
            userRegistrations[app][user].isRegistered >=
                registeredApps[app].registeredAt,
            "User not registered for app"
        );
        require(rewardAmount > 0, "Reward amount must be greater than zero");
        require(
            rewardToken.balanceOf(address(this)) >= rewardAmount,
            "Insufficient reward token balance"
        );
        return true;
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
