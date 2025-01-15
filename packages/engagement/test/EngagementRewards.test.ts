import { expect } from "chai";
import hre, { ethers, upgrades } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import {
  MockERC20,
  MockIdentity,
  EngagementRewards,
  MockApp,
} from "../typechain-types";
import { parseEther } from "ethers";

const { deployContract } = ethers;

describe("EngagementRewards", function () {
  const ADMIN_ROLE =
    "0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775";
  const MAX_REWARDS_PER_APP = parseEther("1000");
  const REWARD_AMOUNT = parseEther("10");
  const CLAIM_COOLDOWN = BigInt(180 * 24 * 60 * 60); // 180 days in seconds
  const APP_EXPIRATION = BigInt(365 * 24 * 60 * 60); // 365 days in seconds

  async function deployFixture() {
    const [owner, admin, app, user, nonAdmin] = await ethers.getSigners();

    const rewardToken = (await ethers.deployContract("MockERC20", [
      "RewardToken",
      "RWT",
    ])) as MockERC20;
    console.log("deployed erc");
    const identityContract = (await ethers.deployContract(
      "MockIdentity",
    )) as MockIdentity;
    console.log("deployed id");
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
    await engagementRewards.connect(admin).register(app.address);
    await identityContract.setWhitelistedRoot(user.address, user.address);
    await rewardToken.transfer(
      await engagementRewards.getAddress(),
      parseEther("10000"),
    );

    const mockApp = (await deployContract("MockApp", [
      await engagementRewards.getAddress(),
    ])) as MockApp;
    await engagementRewards.connect(admin).register(mockApp.address);

    return {
      engagementRewards,
      rewardToken,
      identityContract,
      owner,
      admin,
      app,
      user,
      nonAdmin,
      mockApp,
    };
  }

  async function registeredFixture() {
    await deployFixture();
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
    it("Should allow admin to register an app", async function () {
      const { engagementRewards, admin, nonAdmin } =
        await loadFixture(deployFixture);

      const newMockApp = await (
        await deployContract("MockApp", [await engagementRewards.getAddress()])
      ).waitForDeployment();

      await expect(
        engagementRewards
          .connect(admin)
          .register(await newMockApp.getAddress()),
      )
        .to.emit(engagementRewards, "AppRegistered")
        .withArgs(newMockApp.getAddress());

      const appInfo = await engagementRewards.registeredApps(
        await newMockApp.getAddress(),
      );
      expect(appInfo.isRegistered).to.be.true;
    });

    it("Should not allow non-admin to register an app", async function () {
      const { engagementRewards, nonAdmin } = await loadFixture(deployFixture);

      const newMockApp = (await deployContract("MockApp", [
        engagementRewards.address,
      ])) as MockApp;
      await expect(
        engagementRewards.connect(nonAdmin).register(nonAdmin.address),
      ).to.be.revertedWithCustomError(
        engagementRewards,
        "AccessControlUnauthorizedAccount",
      );
    });
  });

  describe("Claim", function () {
    it.only("Should allow registered app to claim rewards", async function () {
      const { engagementRewards, app, user } = await loadFixture(deployFixture);
      await expect(engagementRewards.connect(app).claim())
        .to.emit(engagementRewards, "RewardClaimed")
        .withArgs(app.address, user.address, REWARD_AMOUNT);
    });

    it("Should not allow claiming twice within cooldown period", async function () {
      const { engagementRewards, app } = await loadFixture(deployFixture);

      await engagementRewards.connect(app).claim();
      await expect(engagementRewards.connect(app).claim()).to.be.reverted;
    });

    it("Should allow claiming after cooldown period", async function () {
      const { engagementRewards, app } = await loadFixture(deployFixture);

      await engagementRewards.connect(app).claim();
      await time.increase(CLAIM_COOLDOWN);
      await expect(engagementRewards.connect(app).claim()).to.not.be.reverted;
    });

    it("Should not allow claiming for expired app", async function () {
      const { engagementRewards, app } = await loadFixture(deployFixture);

      await time.increase(APP_EXPIRATION + BigInt(1));
      await expect(engagementRewards.connect(app).claim()).to.be.reverted;
    });
  });

  describe("Claim with Signature", function () {
    it("Should allow claiming with valid signature", async function () {
      const { engagementRewards, app, user } = await loadFixture(deployFixture);

      const nonce = 1n;
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
          { name: "nonce", type: "uint256" },
        ],
      };

      const message = {
        app: app.address,
        nonce: nonce,
      };

      const signature = await user.signTypedData(domain, types, message);

      await expect(
        engagementRewards.claimWithSignature(app.address, nonce, signature),
      )
        .to.emit(engagementRewards, "RewardClaimed")
        .withArgs(app.address, user.address, REWARD_AMOUNT);
    });

    it("Should not allow using the same signature twice", async function () {
      const { engagementRewards, app, user } = await loadFixture(deployFixture);

      const nonce = 1n;
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
          { name: "nonce", type: "uint256" },
        ],
      };

      const message = {
        app: app.address,
        nonce: nonce,
      };

      const signature = await user.signTypedData(domain, types, message);

      await engagementRewards.claimWithSignature(app.address, nonce, signature);
      await expect(
        engagementRewards.claimWithSignature(app.address, nonce, signature),
      ).to.be.revertedWith("Signature already used");
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
      ).to.be.revertedWith(/AccessControl: account .* is missing role .*/);
    });

    it("Should not allow non-admin to set reward amount", async function () {
      const { engagementRewards, nonAdmin } = await loadFixture(deployFixture);

      await expect(
        engagementRewards.connect(nonAdmin).setRewardAmount(parseEther("20")),
      ).to.be.revertedWith(/AccessControl: account .* is missing role .*/);
    });
  });

  describe("Edge Cases", function () {
    it("Should not allow claiming when reward amount is zero", async function () {
      const { engagementRewards, admin, app } =
        await loadFixture(deployFixture);

      await engagementRewards.connect(admin).setRewardAmount(0);
      await expect(engagementRewards.connect(app).claim()).to.be.reverted;
    });

    it("Should reset total rewards claimed after cooldown period", async function () {
      const { engagementRewards, app } = await loadFixture(deployFixture);

      const claimCount = 5;
      for (let i = 0; i < claimCount; i++) {
        await engagementRewards.connect(app).claim();
        await time.increase(CLAIM_COOLDOWN);
      }

      const appInfo = await engagementRewards.registeredApps(app.address);
      expect(appInfo.totalRewardsClaimed).to.equal(REWARD_AMOUNT);
    });

    it("Should not allow claiming more than max rewards per app", async function () {
      const { engagementRewards, admin, app } =
        await loadFixture(deployFixture);

      const lowMaxRewards = REWARD_AMOUNT * 2n;
      await engagementRewards.connect(admin).setMaxRewardsPerApp(lowMaxRewards);

      await engagementRewards.connect(app).claim();
      await time.increase(CLAIM_COOLDOWN);
      await engagementRewards.connect(app).claim();
      await time.increase(CLAIM_COOLDOWN);

      await expect(engagementRewards.connect(app).claim()).to.be.revertedWith(
        "Max rewards per app exceeded",
      );
    });
  });
});
