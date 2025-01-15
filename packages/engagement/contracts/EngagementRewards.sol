// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

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
        keccak256("Claim(address app,uint256 nonce)");

    IERC20 public rewardToken;
    IIdentity public identityContract;

    uint256 public constant CLAIM_COOLDOWN = 180 days;
    uint256 public constant APP_EXPIRATION = 365 days;

    uint256 public maxRewardsPerApp;
    uint256 public rewardAmount;

    struct AppInfo {
        bool isRegistered;
        uint256 registeredAt;
        uint256 lastResetAt;
        uint256 totalRewardsClaimed;
    }

    mapping(address => AppInfo) public registeredApps;
    mapping(address => mapping(address => uint256)) public lastClaimTimestamp;
    mapping(bytes32 => bool) public usedSignatures;

    event AppRegistered(address indexed app);
    event RewardClaimed(
        address indexed app,
        address indexed user,
        uint256 amount
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

    function register(address app) external onlyRole(ADMIN_ROLE) {
        registeredApps[app] = AppInfo({
            isRegistered: true,
            registeredAt: block.timestamp,
            lastResetAt: block.timestamp,
            totalRewardsClaimed: 0
        });

        emit AppRegistered(app);
    }

    function claim() external returns (bool) {
        address app = msg.sender;
        address user = identityContract.getWhitelistedRoot(tx.origin);
        if (user == address(0)) return false;

        return _claim(app, user);
    }

    function claimWithSignature(
        address app,
        uint256 nonce,
        bytes memory signature
    ) external returns (bool) {
        bytes32 structHash = keccak256(abi.encode(CLAIM_TYPEHASH, app, nonce));
        bytes32 hash = _hashTypedDataV4(structHash);

        require(!usedSignatures[hash], "Signature already used");
        usedSignatures[hash] = true;

        address signer = hash.recover(signature);
        require(
            identityContract.getWhitelistedRoot(signer) != address(0),
            "Signer not whitelisted"
        );

        return _claim(app, signer);
    }

    function _claim(address app, address user) internal returns (bool) {
        if (
            registeredApps[app].registeredAt + APP_EXPIRATION <= block.timestamp
        ) return false;
        if (registeredApps[app].isRegistered == false) return false;
        if (canClaim(app, user) == false) return false;
        if (rewardAmount == 0) return false;

        updateClaimInfo(app, user);

        rewardToken.transfer(app, rewardAmount);

        emit RewardClaimed(app, user, rewardAmount);
        return true;
    }

    function canClaim(address app, address user) internal view returns (bool) {
        uint256 lastClaim = lastClaimTimestamp[app][user];
        return block.timestamp >= lastClaim + CLAIM_COOLDOWN;
    }

    function updateClaimInfo(address app, address user) internal {
        lastClaimTimestamp[app][user] = block.timestamp;

        AppInfo storage appInfo = registeredApps[app];

        if (block.timestamp >= appInfo.lastResetAt + CLAIM_COOLDOWN) {
            appInfo.totalRewardsClaimed = 0;
            appInfo.lastResetAt = block.timestamp;
        }

        appInfo.totalRewardsClaimed += rewardAmount;
        require(
            appInfo.totalRewardsClaimed <= maxRewardsPerApp,
            "Max rewards per app exceeded"
        );
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
