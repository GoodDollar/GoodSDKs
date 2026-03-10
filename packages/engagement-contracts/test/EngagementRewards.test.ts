import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { MockERC20, MockIdentity, EngagementRewards } from "../typechain-types";
import { parseEther, ZeroAddress } from "ethers";

const { deployContract } = ethers;

async function getValidBlockNumber(provider: any) {
  const currentBlock = await provider.getBlockNumber();
  return currentBlock + 5; // Valid for 5 blocks in the future
}

describe("EngagementRewards", function () {
  const ADMIN_ROLE =
    "0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775";
  const MAX_REWARDS_PER_APP = parseEther("1000");
  const REWARD_AMOUNT = parseEther("10");
  const CLAIM_COOLDOWN = BigInt(180 * 24 * 60 * 60); // 180 days in seconds
  const APP_EXPIRATION = BigInt(365 * 24 * 60 * 60); // 365 days in seconds
  const VALID_DESCRIPTION =
    "Valid Description for an app is longer than 50 chars";
  async function deployFixture() {
    const [
      owner,
      admin,
      appOwner,
      user,
      nonAdmin,
      inviter,
      rewardReceiver,
      nonContractApp,
    ] = await ethers.getSigners();

    const rewardToken = (await deployContract("MockERC20", [
      "RewardToken",
      "RWT",
    ])) as MockERC20;
    const identityContract = (await ethers.deployContract(
      "MockIdentity",
    )) as MockIdentity;
    const engagementRewards = (await upgrades.deployProxy(
      await ethers.getContractFactory("EngagementRewards"),
      [
        await rewardToken.getAddress(),
        await identityContract.getAddress(),
        MAX_REWARDS_PER_APP,
        REWARD_AMOUNT,
      ],
      { constructorArgs: [false] },
    )) as EngagementRewards;

    await engagementRewards.grantRole(ADMIN_ROLE, admin.address);

    const mockApp = await deployContract("MockApp", [
      await engagementRewards.getAddress(),
    ]);

    // Apply for app registration with rewardReceiver and description
    await engagementRewards
      .connect(appOwner)
      .applyApp(
        await mockApp.getAddress(),
        rewardReceiver.address,
        80,
        75,
        VALID_DESCRIPTION,
        "https://example.com",
        "contact@example.com",
      );

    // Apply for app registration with rewardReceiver and description
    await engagementRewards
      .connect(appOwner)
      .applyApp(
        nonContractApp.address,
        rewardReceiver.address,
        80,
        75,
        VALID_DESCRIPTION,
        "https://example.com",
        "contact@example.com",
      );

    // Admin approves the app
    await engagementRewards.connect(admin).approve(await mockApp.getAddress());
    await engagementRewards.connect(admin).approve(nonContractApp.address);

    await identityContract.setWhitelistedRoot(user.address, user.address);
    await rewardToken.transfer(
      await engagementRewards.getAddress(),
      parseEther("10000"),
    );

    return {
      engagementRewards,
      rewardToken,
      identityContract,
      mockApp,
      owner,
      admin,
      appOwner,
      user,
      nonAdmin,
      inviter,
      rewardReceiver,
      nonContractApp,
    };
  }

  describe("Initialization", function () {
    it("Should initialize with correct values", async function () {
      const { engagementRewards, rewardToken, identityContract } =
        await loadFixture(deployFixture);

      expect(await engagementRewards.rewardToken()).to.equal(
        await rewardToken.getAddress(),
      );
      expect(await engagementRewards.identityContract()).to.equal(
        await identityContract.getAddress(),
      );
      expect(await engagementRewards.maxRewardsPerApp()).to.equal(
        MAX_REWARDS_PER_APP,
      );
      expect(await engagementRewards.rewardAmount()).to.equal(REWARD_AMOUNT);
    });
  });

  describe("App Registration", function () {
    it("Should allow app owner to apply for registration with reward receiver and description", async function () {
      const { engagementRewards, appOwner, rewardReceiver } =
        await loadFixture(deployFixture);

      const newMockApp = await (
        await deployContract("MockApp", [await engagementRewards.getAddress()])
      ).waitForDeployment();

      const appInfo = {
        rewardReceiver: rewardReceiver.address,
        userInviterPercentage: 80,
        userPercentage: 75,
        description: VALID_DESCRIPTION,
        url: "https://example.com",
        email: "contact@example.com",
      };

      await expect(
        engagementRewards
          .connect(appOwner)
          .applyApp(
            await newMockApp.getAddress(),
            appInfo.rewardReceiver,
            appInfo.userInviterPercentage,
            appInfo.userPercentage,
            appInfo.description,
            appInfo.url,
            appInfo.email,
          ),
      )
        .to.emit(engagementRewards, "AppApplied")
        .withArgs(
          await newMockApp.getAddress(),
          appOwner.address,
          appInfo.rewardReceiver,
          appInfo.userInviterPercentage,
          appInfo.userPercentage,
          appInfo.description,
          appInfo.url,
          appInfo.email,
        );

      const info = await engagementRewards.registeredApps(
        await newMockApp.getAddress(),
      );
      expect(info.isRegistered).to.be.true;
      expect(info.isApproved).to.be.false;
      expect(info.owner).to.equal(appOwner.address);
      expect(info.rewardReceiver).to.equal(appInfo.rewardReceiver);
      expect(info.description).to.equal(appInfo.description);
      expect(info.url).to.equal(appInfo.url);
      expect(info.email).to.equal(appInfo.email);
    });

    it("Should allow admin to approve an app", async function () {
      const { engagementRewards, admin, mockApp, appOwner, rewardReceiver } =
        await loadFixture(deployFixture);

      const newMockApp = await (
        await deployContract("MockApp", [await engagementRewards.getAddress()])
      ).waitForDeployment();

      const appInfo = {
        rewardReceiver: rewardReceiver.address,
        userInviterPercentage: 80,
        userPercentage: 75,
        description: VALID_DESCRIPTION,
        url: "https://example.com",
        email: "contact@example.com",
      };

      await expect(
        engagementRewards
          .connect(appOwner)
          .applyApp(
            await newMockApp.getAddress(),
            appInfo.rewardReceiver,
            appInfo.userInviterPercentage,
            appInfo.userPercentage,
            appInfo.description,
            appInfo.url,
            appInfo.email,
          ),
      )
        .to.emit(engagementRewards, "AppApplied")
        .withArgs(
          await newMockApp.getAddress(),
          appOwner.address,
          appInfo.rewardReceiver,
          appInfo.userInviterPercentage,
          appInfo.userPercentage,
          appInfo.description,
          appInfo.url,
          appInfo.email,
        );

      await expect(
        engagementRewards.connect(admin).approve(await newMockApp.getAddress()),
      )
        .to.emit(engagementRewards, "AppApproved")
        .withArgs(await newMockApp.getAddress());

      const info = await engagementRewards.registeredApps(
        await newMockApp.getAddress(),
      );
      expect(info.isApproved).to.be.true;
    });

    it("Should not allow non-admin to approve an app", async function () {
      const { engagementRewards, nonAdmin, appOwner, rewardReceiver } =
        await loadFixture(deployFixture);

      const newMockApp = await (
        await deployContract("MockApp", [await engagementRewards.getAddress()])
      ).waitForDeployment();

      const appInfo = {
        rewardReceiver: rewardReceiver.address,
        userInviterPercentage: 80,
        userPercentage: 75,
        description: VALID_DESCRIPTION,
        url: "https://example.com",
        email: "contact@example.com",
      };

      await expect(
        engagementRewards
          .connect(appOwner)
          .applyApp(
            await newMockApp.getAddress(),
            appInfo.rewardReceiver,
            appInfo.userInviterPercentage,
            appInfo.userPercentage,
            appInfo.description,
            appInfo.url,
            appInfo.email,
          ),
      )
        .to.emit(engagementRewards, "AppApplied")
        .withArgs(
          await newMockApp.getAddress(),
          appOwner.address,
          appInfo.rewardReceiver,
          appInfo.userInviterPercentage,
          appInfo.userPercentage,
          appInfo.description,
          appInfo.url,
          appInfo.email,
        );

      await expect(
        engagementRewards
          .connect(nonAdmin)
          .approve(await newMockApp.getAddress()),
      ).to.be.revertedWithCustomError(
        engagementRewards,
        "AccessControlUnauthorizedAccount",
      );
    });

    it("Should not allow app registration with description shorter than 50 characters", async function () {
      const { engagementRewards, appOwner, rewardReceiver } =
        await loadFixture(deployFixture);

      const newMockApp = await (
        await deployContract("MockApp", [await engagementRewards.getAddress()])
      ).waitForDeployment();

      const shortDescription = "Too short";

      await expect(
        engagementRewards
          .connect(appOwner)
          .applyApp(
            await newMockApp.getAddress(),
            rewardReceiver.address,
            80,
            75,
            shortDescription,
            "https://example.com",
            "contact@example.com",
          ),
      ).to.be.revertedWith("Invalid description");
    });

    it("Should not allow app registration with description longer than 512 characters", async function () {
      const { engagementRewards, appOwner, rewardReceiver } =
        await loadFixture(deployFixture);

      const newMockApp = await (
        await deployContract("MockApp", [await engagementRewards.getAddress()])
      ).waitForDeployment();

      const longDescription = "a".repeat(513);

      await expect(
        engagementRewards
          .connect(appOwner)
          .applyApp(
            await newMockApp.getAddress(),
            rewardReceiver.address,
            80,
            75,
            longDescription,
            "https://example.com",
            "contact@example.com",
          ),
      ).to.be.revertedWith("Invalid description");
    });
  });

  describe("Claim", function () {
    it("Should allow registered app to claim rewards with inviter and send app reward to rewardReceiver", async function () {
      const {
        mockApp,
        user,
        inviter,
        engagementRewards,
        rewardToken,
        rewardReceiver,
      } = await loadFixture(deployFixture);

      const initialRewardReceiverBalance = await rewardToken.balanceOf(
        rewardReceiver.address,
      );
      const initialUserBalance = await rewardToken.balanceOf(user.address);
      const initialInviterBalance = await rewardToken.balanceOf(
        inviter.address,
      );

      const appReward = (REWARD_AMOUNT * BigInt(20)) / BigInt(100); // 20% goes to app
      const userInviterReward = (REWARD_AMOUNT * BigInt(80)) / BigInt(100); // 80% goes to user+inviter
      const userReward = (userInviterReward * BigInt(75)) / BigInt(100); // 75% of user+inviter reward goes to user
      const inviterReward = userInviterReward - userReward; // Remaining goes to inviter

      const validUntilBlock = await getValidBlockNumber(ethers.provider);
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const domain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const types = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      };

      const message = {
        app: await mockApp.getAddress(),
        inviter: inviter.address,
        validUntilBlock: validUntilBlock,
        description: VALID_DESCRIPTION,
      };

      const signature = await user.signTypedData(domain, types, message);

      expect(
        await mockApp
          .connect(user)
          .claimReward.staticCall(inviter.address, validUntilBlock, signature),
      ).to.be.true;

      await expect(
        mockApp
          .connect(user)
          .claimReward(inviter.address, validUntilBlock, signature),
      )
        .to.emit(engagementRewards, "RewardClaimed")
        .withArgs(
          await mockApp.getAddress(),
          user.address,
          inviter.address,
          appReward,
          userReward,
          inviterReward,
        );

      expect(await rewardToken.balanceOf(rewardReceiver.address)).to.equal(
        initialRewardReceiverBalance + appReward,
      );
      expect(await rewardToken.balanceOf(user.address)).to.equal(
        initialUserBalance + userReward,
      );
      expect(await rewardToken.balanceOf(inviter.address)).to.equal(
        initialInviterBalance + inviterReward,
      );
    });

    it("Should not allow claiming twice within cooldown period", async function () {
      const { mockApp, user, inviter, engagementRewards } =
        await loadFixture(deployFixture);

      const validUntilBlock = await getValidBlockNumber(ethers.provider);
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const domain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const types = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      };

      const message = {
        app: await mockApp.getAddress(),
        inviter: inviter.address,
        validUntilBlock: validUntilBlock,
        description: VALID_DESCRIPTION,
      };

      const signature = await user.signTypedData(domain, types, message);

      await mockApp
        .connect(user)
        .claimReward(inviter.address, validUntilBlock, signature);

      const newValidUntilBlock = await getValidBlockNumber(ethers.provider);
      message.validUntilBlock = newValidUntilBlock;
      const signature2 = await user.signTypedData(domain, types, message);

      await expect(
        mockApp
          .connect(user)
          .claimRewardWithReason(
            inviter.address,
            newValidUntilBlock,
            signature2,
          ),
      ).to.be.revertedWith("Claim cooldown not reached");
    });

    it("Should allow claiming after cooldown period", async function () {
      const { mockApp, user, inviter, engagementRewards } =
        await loadFixture(deployFixture);

      const validUntilBlock = await getValidBlockNumber(ethers.provider);
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const domain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const types = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      };

      const message = {
        app: await mockApp.getAddress(),
        inviter: inviter.address,
        validUntilBlock: validUntilBlock,
        description: VALID_DESCRIPTION,
      };

      const signature = await user.signTypedData(domain, types, message);

      await mockApp
        .connect(user)
        .claimReward(inviter.address, validUntilBlock, signature);
      await time.increase(CLAIM_COOLDOWN);

      const newValidUntilBlock = await getValidBlockNumber(ethers.provider);
      expect(
        await mockApp
          .connect(user)
          .claimReward.staticCall(inviter.address, newValidUntilBlock, "0x"),
      ).to.be.true;

      await expect(
        mockApp
          .connect(user)
          .claimReward(inviter.address, newValidUntilBlock, "0x"),
      ).to.emit(engagementRewards, "RewardClaimed");
    });

    it("Should not allow claiming for expired app", async function () {
      const { mockApp, user, inviter, engagementRewards } =
        await loadFixture(deployFixture);

      const validUntilBlock = await getValidBlockNumber(ethers.provider);
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const domain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const types = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      };

      const message = {
        app: await mockApp.getAddress(),
        inviter: inviter.address,
        validUntilBlock: validUntilBlock,
        description: VALID_DESCRIPTION,
      };

      const signature = await user.signTypedData(domain, types, message);

      await time.increase(APP_EXPIRATION + BigInt(1));

      expect(
        await mockApp
          .connect(user)
          .claimReward.staticCall(inviter.address, validUntilBlock, signature),
      ).to.be.false;

      await expect(
        mockApp
          .connect(user)
          .claimReward(inviter.address, validUntilBlock, signature),
      ).to.not.emit(engagementRewards, "RewardClaimed");
    });

    it("Should update AppStats correctly when rewards are claimed", async function () {
      const { mockApp, user, inviter, engagementRewards } =
        await loadFixture(deployFixture);

      const appReward = (REWARD_AMOUNT * BigInt(20)) / BigInt(100); // 20% goes to app
      const userInviterReward = (REWARD_AMOUNT * BigInt(80)) / BigInt(100); // 80% goes to user+inviter
      const userReward = (userInviterReward * BigInt(75)) / BigInt(100); // 75% of user+inviter reward goes to user
      const inviterReward = userInviterReward - userReward; // Remaining goes to inviter

      const validUntilBlock = await getValidBlockNumber(ethers.provider);
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const domain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const types = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      };

      const message = {
        app: await mockApp.getAddress(),
        inviter: inviter.address,
        validUntilBlock: validUntilBlock,
        description: VALID_DESCRIPTION,
      };

      const signature = await user.signTypedData(domain, types, message);

      await mockApp
        .connect(user)
        .claimReward(inviter.address, validUntilBlock, signature);

      const appStats = await engagementRewards.appsStats(
        await mockApp.getAddress(),
      );
      expect(appStats.numberOfRewards).to.equal(1);
      expect(appStats.totalAppRewards).to.equal(appReward);
      expect(appStats.totalUserRewards).to.equal(userReward);
      expect(appStats.totalInviterRewards).to.equal(inviterReward);
    });

    it("Should not allow claiming if user is not registered", async function () {
      const { mockApp, user, inviter, engagementRewards } =
        await loadFixture(deployFixture);

      const validUntilBlock = await getValidBlockNumber(ethers.provider);

      expect(
        await mockApp
          .connect(user)
          .claimReward.staticCall(inviter.address, validUntilBlock, "0x"),
      ).to.be.false;
    });

    it("Should allow claiming with signature and register user", async function () {
      const { engagementRewards, mockApp, user, inviter, appOwner } =
        await loadFixture(deployFixture);

      const validUntilBlock = await getValidBlockNumber(ethers.provider);
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const domain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const types = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      };

      const message = {
        app: await mockApp.getAddress(),
        inviter: inviter.address,
        validUntilBlock: validUntilBlock,
        description: VALID_DESCRIPTION,
      };

      const signature = await user.signTypedData(domain, types, message);
      const appReward = (REWARD_AMOUNT * BigInt(20)) / BigInt(100); // 20% goes to app

      // Get app signature
      const appDomain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const appTypes = {
        AppClaim: [
          { name: "app", type: "address" },
          { name: "user", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
        ],
      };

      const appMessage = {
        app: await mockApp.getAddress(),
        user: user.address,
        validUntilBlock: validUntilBlock,
      };

      const appSignature = await appOwner.signTypedData(
        appDomain,
        appTypes,
        appMessage,
      );

      await expect(
        engagementRewards
          .connect(user)
          .nonContractAppClaim(
            await mockApp.getAddress(),
            inviter.address,
            validUntilBlock,
            signature,
            appSignature,
          ),
      )
        .to.emit(engagementRewards, "RewardClaimed")
        .withArgs(
          await mockApp.getAddress(),
          user.address,
          inviter.address,
          appReward,
          (REWARD_AMOUNT * BigInt(60)) / BigInt(100),
          (REWARD_AMOUNT * BigInt(20)) / BigInt(100),
        );

      const userInfo = await engagementRewards.userRegistrations(
        await mockApp.getAddress(),
        user.address,
      );
      expect(userInfo.isRegistered).to.be.gt(0);
    });

    it("Should not allow claiming from more than REWARDS_PER_USER apps in a period", async function () {
      const {
        engagementRewards,
        mockApp,
        user,
        inviter,
        rewardReceiver,
        admin,
      } = await loadFixture(deployFixture);

      // Deploy additional test apps
      const additionalApps = await Promise.all(
        Array(5)
          .fill(0)
          .map(async () => {
            const app = await deployContract("MockApp", [
              await engagementRewards.getAddress(),
            ]);
            await engagementRewards.applyApp(
              await app.getAddress(),
              rewardReceiver.address,
              80,
              75,
              VALID_DESCRIPTION,
              "https://example.com",
              "contact@example.com",
            );
            await engagementRewards
              .connect(admin)
              .approve(await app.getAddress());
            return app;
          }),
      );

      const validUntilBlock = (await getValidBlockNumber(ethers.provider)) + 10;
      const chainId = (await ethers.provider.getNetwork()).chainId;

      // Setup signature params
      const domain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const types = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      };

      // Successfully claim from REWARDS_PER_USER apps
      for (let i = 0; i < 3; i++) {
        const app = additionalApps[i];
        const message = {
          app: await app.getAddress(),
          inviter: inviter.address,
          validUntilBlock: validUntilBlock,
          description: VALID_DESCRIPTION,
        };
        const signature = await user.signTypedData(domain, types, message);

        await expect(
          app
            .connect(user)
            .claimRewardWithReason(inviter.address, validUntilBlock, signature),
        ).to.emit(engagementRewards, "RewardClaimed");
      }

      // Try to claim from one more app - should fail
      const message = {
        app: await mockApp.getAddress(),
        inviter: inviter.address,
        validUntilBlock: validUntilBlock,
        description: VALID_DESCRIPTION,
      };
      const signature = await user.signTypedData(domain, types, message);

      await expect(
        mockApp
          .connect(user)
          .claimRewardWithReason(inviter.address, validUntilBlock, signature),
      ).to.be.revertedWith("Max apps per period reached");
    });

    it("Should reset apps per period count after cooldown", async function () {
      const { engagementRewards, mockApp, user, inviter } =
        await loadFixture(deployFixture);

      // First claim
      const validUntilBlock = await getValidBlockNumber(ethers.provider);
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const domain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const types = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      };

      const message = {
        app: await mockApp.getAddress(),
        inviter: inviter.address,
        validUntilBlock: validUntilBlock,
        description: VALID_DESCRIPTION,
      };

      const signature = await user.signTypedData(domain, types, message);

      await mockApp
        .connect(user)
        .claimRewardWithReason(inviter.address, validUntilBlock, signature);

      // Check period stats
      let stats = await engagementRewards.getUserPeriodStats(user.address);
      expect(stats.appsClaimedThisPeriod).to.equal(1);

      // Advance time past cooldown
      await time.increase(CLAIM_COOLDOWN);

      // Check period stats are reset
      stats = await engagementRewards.getUserPeriodStats(user.address);
      expect(stats.appsClaimedThisPeriod).to.equal(0);

      // Should be able to claim again
      const newValidUntilBlock = await getValidBlockNumber(ethers.provider);
      const newMessage = { ...message, validUntilBlock: newValidUntilBlock };
      const newSignature = await user.signTypedData(domain, types, newMessage);

      await expect(
        mockApp
          .connect(user)
          .claimReward(inviter.address, newValidUntilBlock, newSignature),
      ).to.emit(engagementRewards, "RewardClaimed");

      // Check period stats updated
      stats = await engagementRewards.getUserPeriodStats(user.address);
      expect(stats.appsClaimedThisPeriod).to.equal(1);
    });

    it("Should return correct period stats through getUserPeriodStats", async function () {
      const { engagementRewards, mockApp, user, inviter } =
        await loadFixture(deployFixture);

      // Initial stats should be zero
      let stats = await engagementRewards.getUserPeriodStats(user.address);
      expect(stats.appsClaimedThisPeriod).to.equal(0);
      expect(stats.periodStartTimestamp).to.be.gt(0);

      // Make a claim
      const validUntilBlock = await getValidBlockNumber(ethers.provider);
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const domain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const types = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      };

      const message = {
        app: await mockApp.getAddress(),
        inviter: inviter.address,
        validUntilBlock: validUntilBlock,
        description: VALID_DESCRIPTION,
      };

      const signature = await user.signTypedData(domain, types, message);
      const tx = await mockApp
        .connect(user)
        .claimReward(inviter.address, validUntilBlock, signature);

      // Check updated stats
      stats = await engagementRewards.getUserPeriodStats(user.address);
      expect(stats.appsClaimedThisPeriod).to.equal(1);
      expect(stats.periodStartTimestamp).to.gt(0);

      // Advance time past cooldown and check reset
      await time.increase(CLAIM_COOLDOWN);
      stats = await engagementRewards.getUserPeriodStats(user.address);
      expect(stats.appsClaimedThisPeriod).to.equal(0);
    });

    it("Should not allow claiming from unapproved app", async function () {
      const {
        engagementRewards,
        mockApp,
        user,
        inviter,
        appOwner,
        rewardReceiver,
      } = await loadFixture(deployFixture);

      // Deploy new app but don't approve it
      const unapprovedApp = await deployContract("MockApp", [
        await engagementRewards.getAddress(),
      ]);
      await engagementRewards
        .connect(appOwner)
        .applyApp(
          await unapprovedApp.getAddress(),
          rewardReceiver.address,
          80,
          75,
          VALID_DESCRIPTION,
          "https://example.com",
          "contact@example.com",
        );

      const validUntilBlock = await getValidBlockNumber(ethers.provider);
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const domain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const types = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      };

      const message = {
        app: await unapprovedApp.getAddress(),
        inviter: inviter.address,
        validUntilBlock: validUntilBlock,
        description: VALID_DESCRIPTION,
      };

      const signature = await user.signTypedData(domain, types, message);

      await expect(
        unapprovedApp
          .connect(user)
          .claimRewardWithReason(inviter.address, validUntilBlock, signature),
      ).to.be.revertedWith("App not approved or registered");
    });

    it("Should not allow claiming from unregistered app", async function () {
      const { engagementRewards, user, inviter } =
        await loadFixture(deployFixture);

      // Deploy new app but don't register it
      const unregisteredApp = await deployContract("MockApp", [
        await engagementRewards.getAddress(),
      ]);

      const validUntilBlock = await getValidBlockNumber(ethers.provider);
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const domain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const types = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      };

      const message = {
        app: await unregisteredApp.getAddress(),
        inviter: inviter.address,
        validUntilBlock: validUntilBlock,
        description: "",
      };

      const signature = await user.signTypedData(domain, types, message);

      await expect(
        unregisteredApp
          .connect(user)
          .claimRewardWithReason(inviter.address, validUntilBlock, signature),
      ).to.be.revertedWith("App not approved or registered");
    });

    it("Should not allow claiming if app registration has expired", async function () {
      const { engagementRewards, mockApp, user, inviter } =
        await loadFixture(deployFixture);

      const validUntilBlock = await getValidBlockNumber(ethers.provider);
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const domain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const types = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      };

      const message = {
        app: await mockApp.getAddress(),
        inviter: inviter.address,
        validUntilBlock: validUntilBlock,
        description: VALID_DESCRIPTION,
      };

      const signature = await user.signTypedData(domain, types, message);

      // Advance time past APP_EXPIRATION
      await time.increase(APP_EXPIRATION + BigInt(1));

      await expect(
        mockApp
          .connect(user)
          .claimRewardWithReason(inviter.address, validUntilBlock, signature),
      ).to.be.revertedWith("App registration expired");
    });

    it("Should not allow claiming when app has reached max rewards", async function () {
      const {
        engagementRewards,
        mockApp,
        user,
        inviter,
        admin,
        nonAdmin,
        identityContract,
      } = await loadFixture(deployFixture);

      // Set low max rewards to test the limit
      const lowMaxRewards = REWARD_AMOUNT;
      await engagementRewards.connect(admin).setMaxRewardsPerApp(lowMaxRewards);

      await identityContract.setWhitelistedRoot(
        nonAdmin.address,
        nonAdmin.address,
      );
      const validUntilBlock = await getValidBlockNumber(ethers.provider);
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const domain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const types = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      };

      const message = {
        app: await mockApp.getAddress(),
        inviter: inviter.address,
        validUntilBlock: validUntilBlock,
        description: VALID_DESCRIPTION,
      };

      const signature = await user.signTypedData(domain, types, message);

      const signature2 = await nonAdmin.signTypedData(domain, types, message);

      // First claim should succeed
      await mockApp
        .connect(user)
        .claimReward(inviter.address, validUntilBlock, signature);

      // Second claim should fail due to max rewards reached
      await expect(
        mockApp
          .connect(nonAdmin)
          .claimRewardWithReason(inviter.address, validUntilBlock, signature2),
      ).to.be.revertedWith("App maxed rewards");

      // After cooldown period, should be able to claim again
      await time.increase(CLAIM_COOLDOWN);
      await expect(
        mockApp
          .connect(nonAdmin)
          .claimRewardWithReason(inviter.address, validUntilBlock, signature2),
      ).to.emit(engagementRewards, "RewardClaimed");
    });

    it("Should allow claiming with both user and app signatures", async function () {
      const { engagementRewards, user, inviter, nonContractApp } =
        await loadFixture(deployFixture);

      const validUntilBlock = await getValidBlockNumber(ethers.provider);
      const chainId = (await ethers.provider.getNetwork()).chainId;

      // Get user signature
      const userDomain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const userTypes = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      };

      const userMessage = {
        app: nonContractApp.address,
        inviter: inviter.address,
        validUntilBlock: validUntilBlock,
        description: VALID_DESCRIPTION,
      };

      const userSignature = await user.signTypedData(
        userDomain,
        userTypes,
        userMessage,
      );

      // Get app signature
      const appDomain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const appTypes = {
        AppClaim: [
          { name: "app", type: "address" },
          { name: "user", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
        ],
      };

      const appMessage = {
        app: nonContractApp.address,
        user: user.address,
        validUntilBlock: validUntilBlock,
      };

      const appSignature = await nonContractApp.signTypedData(
        appDomain,
        appTypes,
        appMessage,
      );

      await expect(
        engagementRewards
          .connect(user)
          .nonContractAppClaim(
            nonContractApp.address,
            inviter.address,
            validUntilBlock,
            userSignature,
            appSignature,
          ),
      ).to.emit(engagementRewards, "RewardClaimed");
    });

    it("Should not allow claiming with invalid app signature", async function () {
      const {
        engagementRewards,
        user,
        inviter,
        nonAdmin,
        nonContractApp: mockApp,
      } = await loadFixture(deployFixture);

      const validUntilBlock = await getValidBlockNumber(ethers.provider);
      const chainId = (await ethers.provider.getNetwork()).chainId;

      // Get user signature
      const userDomain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const userTypes = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      };

      const userMessage = {
        app: mockApp.address,
        inviter: inviter.address,
        validUntilBlock: validUntilBlock,
        description: VALID_DESCRIPTION,
      };

      const userSignature = await user.signTypedData(
        userDomain,
        userTypes,
        userMessage,
      );

      // Get invalid app signature from non-owner
      const appDomain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const appTypes = {
        AppClaim: [
          { name: "app", type: "address" },
          { name: "user", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
        ],
      };

      const appMessage = {
        app: mockApp.address,
        user: user.address,
        validUntilBlock: validUntilBlock,
      };

      const invalidAppSignature = await nonAdmin.signTypedData(
        appDomain,
        appTypes,
        appMessage,
      );

      await expect(
        engagementRewards
          .connect(user)
          .nonContractAppClaim(
            mockApp.address,
            inviter.address,
            validUntilBlock,
            userSignature,
            invalidAppSignature,
          ),
      ).to.be.revertedWith("Invalid app signature");
    });
  });

  describe("Claim with Signature", function () {
    it("Should allow claiming with valid signature", async function () {
      const { engagementRewards, mockApp, user, inviter } =
        await loadFixture(deployFixture);

      const validUntilBlock = await getValidBlockNumber(ethers.provider);
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const domain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const types = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      };

      const message = {
        app: await mockApp.getAddress(),
        inviter: inviter.address,
        validUntilBlock: validUntilBlock,
        description: VALID_DESCRIPTION,
      };
      const signature = await user.signTypedData(domain, types, message);
      const appReward = (REWARD_AMOUNT * BigInt(20)) / BigInt(100); // 20% goes to app

      await expect(
        engagementRewards
          .connect(user)
          .nonContractAppClaim(
            await mockApp.getAddress(),
            inviter.address,
            validUntilBlock,
            signature,
            "0x",
          ),
      )
        .to.emit(engagementRewards, "RewardClaimed")
        .withArgs(
          await mockApp.getAddress(),
          user.address,
          inviter.address,
          appReward,
          (REWARD_AMOUNT * BigInt(60)) / BigInt(100),
          (REWARD_AMOUNT * BigInt(20)) / BigInt(100),
        );
    });

    it("Should update AppStats correctly when rewards are claimed with signature", async function () {
      const { engagementRewards, mockApp, user, inviter } =
        await loadFixture(deployFixture);

      const validUntilBlock = await getValidBlockNumber(ethers.provider);
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const domain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const types = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      };

      const message = {
        app: await mockApp.getAddress(),
        inviter: inviter.address,
        validUntilBlock: validUntilBlock,
        description: VALID_DESCRIPTION,
      };

      const signature = await user.signTypedData(domain, types, message);
      const appReward = (REWARD_AMOUNT * BigInt(20)) / BigInt(100); // 20% goes to app

      await engagementRewards
        .connect(user)
        .nonContractAppClaim(
          await mockApp.getAddress(),
          inviter.address,
          validUntilBlock,
          signature,
          "0x",
        );

      const appStats = await engagementRewards.appsStats(
        await mockApp.getAddress(),
      );
      expect(appStats.numberOfRewards).to.equal(1);
      expect(appStats.totalAppRewards).to.equal(appReward);
      expect(appStats.totalUserRewards).to.equal(
        (REWARD_AMOUNT * BigInt(60)) / BigInt(100),
      );
      expect(appStats.totalInviterRewards).to.equal(
        (REWARD_AMOUNT * BigInt(20)) / BigInt(100),
      );
    });

    it("Should not allow claiming with expired block number", async function () {
      const { engagementRewards, mockApp, user, inviter } =
        await loadFixture(deployFixture);
      const currentBlock = (await ethers.provider.getBlockNumber()) - 1;

      const domain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const types = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      };

      const message = {
        app: await mockApp.getAddress(),
        inviter: inviter.address,
        validUntilBlock: currentBlock,
        description: VALID_DESCRIPTION,
      };

      const signature = await user.signTypedData(domain, types, message);

      await expect(
        engagementRewards.nonContractAppClaim(
          await mockApp.getAddress(),
          inviter.address,
          currentBlock,
          signature,
          "0x",
        ),
      ).to.be.revertedWith("Signature expired");
    });

    it("Should not allow claiming with block number too far in future", async function () {
      const { engagementRewards, mockApp, user, inviter } =
        await loadFixture(deployFixture);
      const currentBlock = await ethers.provider.getBlockNumber();
      const farFutureBlock = currentBlock + 55;

      const domain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const types = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      };

      const message = {
        app: await mockApp.getAddress(),
        inviter: inviter.address,
        validUntilBlock: farFutureBlock,
        description: VALID_DESCRIPTION,
      };

      const signature = await user.signTypedData(domain, types, message);

      await expect(
        engagementRewards.nonContractAppClaim(
          await mockApp.getAddress(),
          inviter.address,
          farFutureBlock,
          signature,
          "0x",
        ),
      ).to.be.revertedWith("ValidUntilBlock too far in future");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow admin to set max rewards per app", async function () {
      const { engagementRewards, admin } = await loadFixture(deployFixture);

      const newMaxRewards = parseEther("2000");
      await engagementRewards.connect(admin).setMaxRewardsPerApp(newMaxRewards);
      expect(await engagementRewards.maxRewardsPerApp()).to.equal(
        newMaxRewards,
      );
    });

    it("Should allow admin to set reward amount", async function () {
      const { engagementRewards, admin } = await loadFixture(deployFixture);

      const newRewardAmount = parseEther("20");
      await expect(
        engagementRewards.connect(admin).setRewardAmount(newRewardAmount),
      )
        .to.emit(engagementRewards, "RewardAmountUpdated")
        .withArgs(newRewardAmount);
      expect(await engagementRewards.rewardAmount()).to.equal(newRewardAmount);
    });

    it("Should not allow non-admin to set max rewards per app", async function () {
      const { engagementRewards, nonAdmin } = await loadFixture(deployFixture);

      await expect(
        engagementRewards
          .connect(nonAdmin)
          .setMaxRewardsPerApp(parseEther("2000")),
      ).to.be.revertedWithCustomError(
        engagementRewards,
        "AccessControlUnauthorizedAccount",
      );
    });

    it("Should not allow non-admin to set reward amount", async function () {
      const { engagementRewards, nonAdmin } = await loadFixture(deployFixture);

      await expect(
        engagementRewards.connect(nonAdmin).setRewardAmount(parseEther("20")),
      ).to.be.revertedWithCustomError(
        engagementRewards,
        "AccessControlUnauthorizedAccount",
      );
    });

    it("Should allow admin to set rewards per user", async function () {
      const { engagementRewards, admin } = await loadFixture(deployFixture);

      const newmaxAppsPerUser = 5;
      await expect(
        engagementRewards.connect(admin).setMaxAppsPerUser(newmaxAppsPerUser),
      )
        .to.emit(engagementRewards, "MaxAppsPerUserUpdated")
        .withArgs(newmaxAppsPerUser);
      expect(await engagementRewards.maxAppsPerUser()).to.equal(
        newmaxAppsPerUser,
      );
    });

    it("Should not allow setting rewards per user to zero", async function () {
      const { engagementRewards, admin } = await loadFixture(deployFixture);

      await expect(
        engagementRewards.connect(admin).setMaxAppsPerUser(0),
      ).to.be.revertedWith("Rewards per user must be greater than 0");
    });

    it("Should not allow non-admin to set rewards per user", async function () {
      const { engagementRewards, nonAdmin } = await loadFixture(deployFixture);

      await expect(
        engagementRewards.connect(nonAdmin).setMaxAppsPerUser(5),
      ).to.be.revertedWithCustomError(
        engagementRewards,
        "AccessControlUnauthorizedAccount",
      );
    });

    it("Should allow more claims after increasing rewards per user limit", async function () {
      const {
        engagementRewards,
        mockApp,
        user,
        inviter,
        admin,
        rewardReceiver,
      } = await loadFixture(deployFixture);

      // Deploy additional test apps
      const additionalApps = await Promise.all(
        Array(6)
          .fill(0)
          .map(async () => {
            const app = await deployContract("MockApp", [
              await engagementRewards.getAddress(),
            ]);
            await engagementRewards.applyApp(
              await app.getAddress(),
              rewardReceiver.address,
              80,
              75,
              VALID_DESCRIPTION,
              "https://example.com",
              "contact@example.com",
            );
            await engagementRewards
              .connect(admin)
              .approve(await app.getAddress());
            return app;
          }),
      );

      const validUntilBlock = (await getValidBlockNumber(ethers.provider)) + 10;
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const domain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const types = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      };

      // Claim from default max number of apps (3)
      for (let i = 0; i < 3; i++) {
        const app = additionalApps[i];
        const message = {
          app: await app.getAddress(),
          inviter: inviter.address,
          validUntilBlock: validUntilBlock,
          description: VALID_DESCRIPTION,
        };
        const signature = await user.signTypedData(domain, types, message);
        await app
          .connect(user)
          .claimReward(inviter.address, validUntilBlock, signature);
      }

      // Try to claim from one more app - should fail
      const message = {
        app: await additionalApps[3].getAddress(),
        inviter: inviter.address,
        validUntilBlock: validUntilBlock,
        description: VALID_DESCRIPTION,
      };
      let signature = await user.signTypedData(domain, types, message);

      await expect(
        additionalApps[3]
          .connect(user)
          .claimRewardWithReason(inviter.address, validUntilBlock, signature),
      ).to.be.revertedWith("Max apps per period reached");

      // Increase rewards per user limit
      await engagementRewards.connect(admin).setMaxAppsPerUser(5);

      message.app = await additionalApps[3].getAddress();
      signature = await user.signTypedData(domain, types, message);

      // Should now be able to claim from more apps
      await additionalApps[3]
        .connect(user)
        .claimRewardWithReason(inviter.address, validUntilBlock, signature);

      message.app = await additionalApps[4].getAddress();
      signature = await user.signTypedData(domain, types, message);

      await additionalApps[4]
        .connect(user)
        .claimRewardWithReason(inviter.address, validUntilBlock, signature);

      // Should still fail on 6th app
      const message6 = {
        app: await additionalApps[5].getAddress(),
        inviter: inviter.address,
        validUntilBlock: validUntilBlock,
        description: VALID_DESCRIPTION,
      };
      const signature6 = await user.signTypedData(domain, types, message6);

      await expect(
        additionalApps[5]
          .connect(user)
          .claimRewardWithReason(inviter.address, validUntilBlock, signature6),
      ).to.be.revertedWith("Max apps per period reached");
    });
  });

  describe("App Settings", function () {
    it("Should allow app owner to update app settings including reward receiver", async function () {
      const { engagementRewards, appOwner, mockApp, nonAdmin } =
        await loadFixture(deployFixture);

      const newRewardReceiver = nonAdmin.address; // Using nonAdmin as the new reward receiver for this test

      await expect(
        engagementRewards
          .connect(appOwner)
          .updateAppSettings(
            await mockApp.getAddress(),
            newRewardReceiver,
            90,
            80,
          ),
      )
        .to.emit(engagementRewards, "AppSettingsUpdated")
        .withArgs(await mockApp.getAddress(), 90, 80);

      const appInfo = await engagementRewards.registeredApps(
        await mockApp.getAddress(),
      );
      expect(appInfo.rewardReceiver).to.equal(newRewardReceiver);
      expect(appInfo.userAndInviterPercentage).to.equal(90);
      expect(appInfo.userPercentage).to.equal(80);
    });

    it("Should not allow non-owner to update app settings", async function () {
      const { engagementRewards, nonAdmin, mockApp, rewardReceiver } =
        await loadFixture(deployFixture);

      await expect(
        engagementRewards
          .connect(nonAdmin)
          .updateAppSettings(
            await mockApp.getAddress(),
            rewardReceiver.address,
            90,
            80,
          ),
      ).to.be.revertedWith("Not app owner");
    });
  });

  describe("Edge Cases", function () {
    it("Should not allow claiming when reward amount is zero", async function () {
      const { engagementRewards, admin, mockApp, user, inviter } =
        await loadFixture(deployFixture);

      const validUntilBlock = await getValidBlockNumber(ethers.provider);
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const domain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const types = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      };

      const message = {
        app: await mockApp.getAddress(),
        inviter: inviter.address,
        validUntilBlock: validUntilBlock,
        description: VALID_DESCRIPTION,
      };

      const signature = await user.signTypedData(domain, types, message);
      await engagementRewards.connect(admin).setRewardAmount(0);
      expect(
        await mockApp
          .connect(user)
          .claimReward.staticCall(inviter.address, validUntilBlock, signature),
      ).to.be.false;
      await expect(
        mockApp
          .connect(user)
          .claimReward(inviter.address, validUntilBlock, signature),
      ).to.not.emit(engagementRewards, "RewardClaimed");
    });

    it("Should reset total rewards claimed after cooldown period", async function () {
      const { engagementRewards, mockApp, user, inviter } =
        await loadFixture(deployFixture);

      const validUntilBlock = await getValidBlockNumber(ethers.provider);
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const domain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const types = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      };

      const message = {
        app: await mockApp.getAddress(),
        inviter: inviter.address,
        validUntilBlock: validUntilBlock,
        description: VALID_DESCRIPTION,
      };

      const signature = await user.signTypedData(domain, types, message);
      await mockApp
        .connect(user)
        .claimReward(inviter.address, validUntilBlock, signature);

      const claimCount = 5;
      for (let i = 0; i < claimCount; i++) {
        await mockApp
          .connect(user)
          .claimReward(inviter.address, validUntilBlock, "0x");
        await time.increase(CLAIM_COOLDOWN);
      }

      const appInfo = await engagementRewards.registeredApps(
        await mockApp.getAddress(),
      );
      expect(appInfo.totalRewardsClaimed).to.equal(REWARD_AMOUNT);
    });

    it("Should not allow claiming more than max rewards per app", async function () {
      const {
        engagementRewards,
        admin,
        mockApp,
        user,
        inviter,
        identityContract,
      } = await loadFixture(deployFixture);

      const lowMaxRewards = REWARD_AMOUNT * 2n;
      await engagementRewards.connect(admin).setMaxRewardsPerApp(lowMaxRewards);
      identityContract.setWhitelistedRoot(inviter.address, inviter.address);
      identityContract.setWhitelistedRoot(admin.address, admin.address);
      //because we do multiple txs add some more blocks so signatures stay valid
      const validUntilBlock = (await getValidBlockNumber(ethers.provider)) + 5;
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const domain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const types = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      };

      const message = {
        app: await mockApp.getAddress(),
        inviter: inviter.address,
        validUntilBlock: validUntilBlock,
        description: VALID_DESCRIPTION,
      };

      const signature = await user.signTypedData(domain, types, message);

      await expect(
        mockApp
          .connect(user)
          .claimReward(inviter.address, validUntilBlock, signature),
      ).to.emit(engagementRewards, "RewardClaimed");

      message.inviter = ZeroAddress;
      const inviterSignature = await inviter.signTypedData(
        domain,
        types,
        message,
      );

      await expect(
        mockApp
          .connect(inviter)
          .claimReward(ZeroAddress, validUntilBlock, inviterSignature),
      ).to.emit(engagementRewards, "RewardClaimed");

      const adminSignature = await admin.signTypedData(domain, types, message);
      expect(
        await mockApp
          .connect(admin)
          .claimReward.staticCall(ZeroAddress, validUntilBlock, adminSignature),
      ).to.be.false;
      await expect(
        mockApp
          .connect(admin)
          .claimReward(ZeroAddress, validUntilBlock, adminSignature),
      ).to.not.emit(engagementRewards, "RewardClaimed");
    });
  });

  describe("App Claims", function () {
    it("Should allow app to claim with custom percentages", async function () {
      const { mockApp, user, inviter, engagementRewards, rewardToken } =
        await loadFixture(deployFixture);

      const customUserAndInviterPercentage = 90;
      const customUserPercentage = 80;

      const validUntilBlock = (await getValidBlockNumber(ethers.provider)) + 5;
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const domain = {
        name: "EngagementRewards",
        version: "1.0",
        chainId: chainId,
        verifyingContract: await engagementRewards.getAddress(),
      };

      const types = {
        Claim: [
          { name: "app", type: "address" },
          { name: "inviter", type: "address" },
          { name: "validUntilBlock", type: "uint256" },
          { name: "description", type: "string" },
        ],
      };

      const message = {
        app: await mockApp.getAddress(),
        inviter: inviter.address,
        validUntilBlock: validUntilBlock,
        description: VALID_DESCRIPTION,
      };

      const signature = await user.signTypedData(domain, types, message);

      await mockApp
        .connect(user)
        .claimRewardWithOverride(
          inviter.address,
          validUntilBlock,
          signature,
          customUserAndInviterPercentage,
          customUserPercentage,
        );

      const appStats = await engagementRewards.appsStats(
        await mockApp.getAddress(),
      );
      const expectedUserInviterAmount =
        (REWARD_AMOUNT * BigInt(customUserAndInviterPercentage)) / 100n;
      const expectedUserAmount =
        (expectedUserInviterAmount * BigInt(customUserPercentage)) / 100n;
      const expectedInviterAmount =
        expectedUserInviterAmount - expectedUserAmount;

      expect(appStats.totalUserRewards).to.equal(expectedUserAmount);
      expect(appStats.totalInviterRewards).to.equal(expectedInviterAmount);
    });

    it("Should not allow invalid custom percentages", async function () {
      const { mockApp, user, inviter } = await loadFixture(deployFixture);

      const validUntilBlock = await getValidBlockNumber(ethers.provider);

      await expect(
        mockApp
          .connect(user)
          .claimRewardWithOverride(
            inviter.address,
            validUntilBlock,
            "0x",
            101,
            80,
          ),
      ).to.be.revertedWith("Invalid userAndInviterPercentage");

      await expect(
        mockApp
          .connect(user)
          .claimRewardWithOverride(
            inviter.address,
            validUntilBlock,
            "0x",
            90,
            101,
          ),
      ).to.be.revertedWith("Invalid userPercentage");
    });
  });
});
