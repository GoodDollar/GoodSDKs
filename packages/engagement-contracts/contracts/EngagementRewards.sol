// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

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
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    bool public immutable IS_DEV_ENV;
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant CLAIM_TYPEHASH =
        keccak256(
            "Claim(address app,address inviter,uint256 validUntilBlock,string description)"
        );
    bytes32 public constant APP_CLAIM_TYPEHASH =
        keccak256("AppClaim(address app,address user,uint256 validUntilBlock)");

    IERC20 public rewardToken;
    IIdentity public identityContract;

    uint256 public constant CLAIM_COOLDOWN = 180 days;
    uint256 public constant APP_EXPIRATION = 365 days;
    uint8 public maxAppsPerUser;

    uint96 public maxRewardsPerApp;
    uint96 public rewardAmount;

    struct AppInfo {
        address owner; // 20 bytes
        address rewardReceiver; // 20 bytes
        uint96 totalRewardsClaimed; // 12 bytes
        uint32 registeredAt; // 4 bytes
        uint32 lastResetAt; // 4 bytes
        uint8 userAndInviterPercentage; // 1 byte
        uint8 userPercentage; // 1 byte
        bool isRegistered; // 1 byte
        bool isApproved; // 1 byte
        // Following strings each use their own slot
        string description;
        string url;
        string email;
        address app;
        address signer; // 20 bytes
    }

    struct AppStats {
        uint96 numberOfRewards; // 12 bytes
        uint96 totalAppRewards; // 12 bytes
        uint96 totalUserRewards; // 12 bytes
        uint96 totalInviterRewards; // 12 bytes
    }

    struct UserInfo {
        uint32 isRegistered; // 4 bytes
        uint32 lastClaimTimestamp; // 4 bytes
    }

    struct UserGlobalInfo {
        uint8 periodClaims; // 2 bytes
        uint32 lastClaimTimestamp; // 4 bytes
    }

    mapping(address => AppInfo) public registeredApps;
    mapping(address => AppStats) public appsStats;
    mapping(address => mapping(address => UserInfo)) public userRegistrations;
    mapping(address => UserGlobalInfo) public userPeriodClaims;
    address[] public appliedApps;

    event AppApplied(
        address indexed app,
        address indexed owner,
        address rewardReceiver,
        uint256 userAndInviterPercentage,
        uint256 userPercentage,
        string description,
        string url,
        string email
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
    event MaxAppsPerUserUpdated(uint8 newAmount); // Add new event

    modifier onlyRoleOrDev(bytes32 role) {
        if (!hasRole(role, msg.sender) && !IS_DEV_ENV) {
            revert AccessControlUnauthorizedAccount(msg.sender, role);
        }
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(bool _isDevEnv) {
        IS_DEV_ENV = _isDevEnv;
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
        maxRewardsPerApp = uint96(_maxRewardsPerApp);
        rewardAmount = uint96(_rewardAmount);
        maxAppsPerUser = 3;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function upgrade(address[] memory apps) external reinitializer(2) {
        for (uint256 i = 0; i < apps.length; i++) {
            appliedApps.push(apps[i]);
            registeredApps[apps[i]].app = apps[i];
        }
    }

    function applyApp(
        address app,
        address rewardReceiver,
        uint8 userAndInviterPercentage,
        uint8 userPercentage,
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
            existingApp.userAndInviterPercentage = uint8(
                userAndInviterPercentage
            );
            existingApp.userPercentage = uint8(userPercentage);
            existingApp.description = description;
            existingApp.url = url;
            existingApp.email = email;
            existingApp.registeredAt = uint32(block.timestamp);
        } else {
            appliedApps.push(app);
            // New registration
            appliedApps.push(app);
            registeredApps[app] = AppInfo({
                isRegistered: true,
                isApproved: false,
                owner: msg.sender,
                rewardReceiver: rewardReceiver,
                registeredAt: uint32(block.timestamp),
                lastResetAt: uint32(block.timestamp),
                totalRewardsClaimed: 0,
                userAndInviterPercentage: uint8(userAndInviterPercentage),
                userPercentage: uint8(userPercentage),
                description: description,
                url: url,
                email: email,
                app: app,
                signer: address(0)
            });
        }

        emit AppApplied(
            app,
            msg.sender,
            rewardReceiver,
            userAndInviterPercentage,
            userPercentage,
            description,
            url,
            email
        );
    }

    function approve(address app) external onlyRoleOrDev(ADMIN_ROLE) {
        require(registeredApps[app].isRegistered, "App not registered");
        require(!registeredApps[app].isApproved, "App already approved");

        if (registeredApps[app].registeredAt < 175517674) {
            appliedApps.push(app);
        }
        registeredApps[app].isApproved = true;

        emit AppApproved(app);
    }

    function setAppSigner(address app, address signer) external {
        require(msg.sender == registeredApps[app].owner, "Not app owner");
        require(signer != address(0), "Invalid signer address");
        registeredApps[app].signer = signer;
    }

    function updateAppSettings(
        address app,
        address rewardReceiver,
        uint8 userAndInviterPercentage,
        uint8 userPercentage
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
        address user,
        address inviter,
        uint256 validUntilBlock,
        bytes memory signature
    ) public returns (bool) {
        return
            _claim(
                user,
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
        address user,
        address inviter,
        uint256 validUntilBlock,
        bytes memory signature,
        uint8 userAndInviterPercentage,
        uint8 userPercentage
    ) public returns (bool) {
        require(
            userAndInviterPercentage <= 100,
            "Invalid userAndInviterPercentage"
        );
        require(userPercentage <= 100, "Invalid userPercentage");

        return
            _claim(
                user,
                msg.sender,
                inviter,
                validUntilBlock,
                signature,
                userAndInviterPercentage,
                userPercentage,
                true
            );
    }

    function nonContractAppClaim(
        address app,
        address inviter,
        uint256 validUntilBlock,
        bytes memory userSignature,
        bytes memory appSignature
    ) public returns (bool) {
        // Validate app signature first
        require(
            _validateAppSignature(
                app,
                msg.sender,
                validUntilBlock,
                appSignature
            ),
            "Invalid app signature"
        );

        return
            _claim(
                msg.sender,
                app,
                inviter,
                validUntilBlock,
                userSignature,
                0,
                0,
                false
            );
    }

    function _validateAppSignature(
        address app,
        address user,
        uint256 validUntilBlock,
        bytes memory signature
    ) internal view returns (bool) {
        bytes32 structHash = keccak256(
            abi.encode(APP_CLAIM_TYPEHASH, app, user, validUntilBlock)
        );
        bytes32 hash = _hashTypedDataV4(structHash);

        // Change ECDSA recover to SignatureChecker
        return
            SignatureChecker.isValidSignatureNow(app, hash, signature) ||
            SignatureChecker.isValidSignatureNow(
                registeredApps[app].signer,
                hash,
                signature
            ) ||
            SignatureChecker.isValidSignatureNow(
                registeredApps[app].owner,
                hash,
                signature
            );
    }

    function _validateSignature(
        address user,
        address app,
        address inviter,
        uint256 validUntilBlock,
        bytes memory signature
    ) internal view {
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

        // Change ECDSA recover to SignatureChecker
        require(
            SignatureChecker.isValidSignatureNow(user, hash, signature),
            "Invalid user signature"
        );
    }

    function _claim(
        address sender,
        address app,
        address inviter,
        uint256 validUntilBlock,
        bytes memory signature,
        uint8 userAndInviterPercentage,
        uint8 userPercentage,
        bool overridePercentages
    ) internal nonReentrant returns (bool) {
        address user = identityContract.getWhitelistedRoot(sender);
        if (validUntilBlock > 0 && signature.length > 0) {
            _validateSignature(
                sender,
                app,
                inviter,
                validUntilBlock,
                signature
            );
            userRegistrations[app][user].isRegistered = uint32(block.timestamp);
        }
        if (!canClaim(app, user)) return false;

        updateClaimInfo(app, user);

        AppInfo storage appInfo = registeredApps[app];

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
        uint8 userAndInviterPercentage,
        uint8 userPercentage
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
        appStat.totalAppRewards += uint96(appAmount);
        appStat.totalInviterRewards += uint96(inviterAmount);
        appStat.totalUserRewards += uint96(userAmount);

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
        uint32 lastClaim = userRegistrations[app][user].lastClaimTimestamp;
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
        AppInfo storage appInfo = registeredApps[app];
        UserGlobalInfo storage userGlobal = userPeriodClaims[user];

        // Check if user hasn't exceeded max apps per period
        require(
            userGlobal.periodClaims < maxAppsPerUser ||
                block.timestamp >=
                userGlobal.lastClaimTimestamp + CLAIM_COOLDOWN,
            "Max apps per period reached"
        );

        require(
            appInfo.isRegistered && appInfo.isApproved,
            "App not approved or registered"
        );

        require(
            appInfo.registeredAt + APP_EXPIRATION > block.timestamp,
            "App registration expired"
        );

        require(
            block.timestamp >= appInfo.lastResetAt + CLAIM_COOLDOWN ||
                appInfo.totalRewardsClaimed + rewardAmount <= maxRewardsPerApp,
            "App maxed rewards"
        );

        return true;
    }

    function updateClaimInfo(address app, address user) internal {
        userRegistrations[app][user].lastClaimTimestamp = uint32(
            block.timestamp
        );

        AppInfo storage appInfo = registeredApps[app];
        UserGlobalInfo storage userGlobal = userPeriodClaims[user];

        if (block.timestamp >= appInfo.lastResetAt + CLAIM_COOLDOWN) {
            appInfo.totalRewardsClaimed = 0;
            appInfo.lastResetAt = uint32(block.timestamp);
        }

        // Reset period claims if cooldown has passed
        if (block.timestamp >= userGlobal.lastClaimTimestamp + CLAIM_COOLDOWN) {
            userGlobal.periodClaims = 0;
            userGlobal.lastClaimTimestamp = uint32(block.timestamp);
        }

        userGlobal.periodClaims += 1;
        appInfo.totalRewardsClaimed += rewardAmount;
    }

    function setMaxRewardsPerApp(
        uint96 _maxRewardsPerApp
    ) external onlyRole(ADMIN_ROLE) {
        maxRewardsPerApp = _maxRewardsPerApp;
    }

    function setIdentityContract(
        address _identity
    ) external onlyRole(ADMIN_ROLE) {
        identityContract = IIdentity(_identity);
    }

    function setRewardAmount(
        uint96 _rewardAmount
    ) external onlyRole(ADMIN_ROLE) {
        rewardAmount = _rewardAmount;
        emit RewardAmountUpdated(_rewardAmount);
    }

    function setMaxAppsPerUser(
        uint8 _maxAppsPerUser
    ) external onlyRole(ADMIN_ROLE) {
        require(_maxAppsPerUser > 0, "Rewards per user must be greater than 0");
        maxAppsPerUser = _maxAppsPerUser;
        emit MaxAppsPerUserUpdated(_maxAppsPerUser);
    }

    function getUserPeriodStats(
        address user
    )
        external
        view
        returns (uint8 appsClaimedThisPeriod, uint32 periodStartTimestamp)
    {
        UserGlobalInfo storage userGlobal = userPeriodClaims[user];

        // If cooldown has passed, user is in a new period
        if (block.timestamp >= userGlobal.lastClaimTimestamp + CLAIM_COOLDOWN) {
            return (0, uint32(block.timestamp));
        }

        return (userGlobal.periodClaims, userGlobal.lastClaimTimestamp);
    }

    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function getAppliedApps() external view returns (AppInfo[] memory apps) {
        uint256 length = appliedApps.length;
        apps = new AppInfo[](length);
        for (uint256 i = 0; i < length; i++) {
            apps[i] = registeredApps[appliedApps[i]];
        }
    }

    function overwriteAppDetails(
        AppInfo memory app
    ) external onlyRole(ADMIN_ROLE) {
        registeredApps[app.app] = app;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
