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
    const [owner, admin, appOwner, user, nonAdmin, inviter, rewardReceiver] =
      await ethers.getSigners();

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
      );
    // Admin approves the app
    await engagementRewards.connect(admin).approve(await mockApp.getAddress());

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

      await expect(
        engagementRewards
          .connect(appOwner)
          .applyApp(
            await newMockApp.getAddress(),
            rewardReceiver.address,
            80,
            75,
            VALID_DESCRIPTION,
          ),
      )
        .to.emit(engagementRewards, "AppApplied")
        .withArgs(
          await newMockApp.getAddress(),
          appOwner.address,
          rewardReceiver.address,
          80,
          75,
        );

      const appInfo = await engagementRewards.registeredApps(
        await newMockApp.getAddress(),
      );
      expect(appInfo.isRegistered).to.be.true;
      expect(appInfo.isApproved).to.be.false;
      expect(appInfo.owner).to.equal(appOwner.address);
      expect(appInfo.rewardReceiver).to.equal(rewardReceiver.address);
      expect(appInfo.description).to.equal(VALID_DESCRIPTION);
    });

    it("Should allow admin to approve an app", async function () {
      const { engagementRewards, admin, mockApp, appOwner, rewardReceiver } =
        await loadFixture(deployFixture);

      const newMockApp = await (
        await deployContract("MockApp", [await engagementRewards.getAddress()])
      ).waitForDeployment();

      await expect(
        engagementRewards
          .connect(appOwner)
          .applyApp(
            await newMockApp.getAddress(),
            rewardReceiver,
            80,
            75,
            VALID_DESCRIPTION,
          ),
      )
        .to.emit(engagementRewards, "AppApplied")
        .withArgs(
          await newMockApp.getAddress(),
          appOwner.address,
          rewardReceiver.address,
          80,
          75,
        );

      await expect(
        engagementRewards.connect(admin).approve(await newMockApp.getAddress()),
      )
        .to.emit(engagementRewards, "AppApproved")
        .withArgs(await newMockApp.getAddress());

      const appInfo = await engagementRewards.registeredApps(
        await newMockApp.getAddress(),
      );
      expect(appInfo.isApproved).to.be.true;
    });

    it("Should not allow non-admin to approve an app", async function () {
      const { engagementRewards, nonAdmin, appOwner, rewardReceiver } =
        await loadFixture(deployFixture);

      const newMockApp = await (
        await deployContract("MockApp", [await engagementRewards.getAddress()])
      ).waitForDeployment();

      await expect(
        engagementRewards
          .connect(appOwner)
          .applyApp(
            await newMockApp.getAddress(),
            rewardReceiver,
            80,
            75,
            VALID_DESCRIPTION,
          ),
      )
        .to.emit(engagementRewards, "AppApplied")
        .withArgs(
          await newMockApp.getAddress(),
          appOwner.address,
          rewardReceiver.address,
          80,
          75,
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

      expect(
        await mockApp
          .connect(user)
          .claimReward.staticCall(
            inviter.address,
            newValidUntilBlock,
            signature2,
          ),
      ).to.be.false;
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
        engagementRewards.claimWithSignature(
          await mockApp.getAddress(),
          inviter.address,
          validUntilBlock,
          signature,
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
      expect(userInfo).to.be.true;
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
        engagementRewards.claimWithSignature(
          await mockApp.getAddress(),
          inviter.address,
          validUntilBlock,
          signature,
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

      await engagementRewards.claimWithSignature(
        await mockApp.getAddress(),
        inviter.address,
        validUntilBlock,
        signature,
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
      const currentBlock = await ethers.provider.getBlockNumber();

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
        engagementRewards.claimWithSignature(
          await mockApp.getAddress(),
          inviter.address,
          currentBlock,
          signature,
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
        engagementRewards.claimWithSignature(
          await mockApp.getAddress(),
          inviter.address,
          farFutureBlock,
          signature,
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
});
