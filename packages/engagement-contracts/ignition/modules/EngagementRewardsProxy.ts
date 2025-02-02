import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseEther } from "ethers";
import EngagementRewards from "./EngagementRewards";
import hre from "hardhat";

const deployArgs: { [key: string]: any } = {
  default: [
    "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A",
    "0xC361A6E67822a0EDc17D899227dd9FC50BD62F42",
    parseEther((100e6).toString()),
    parseEther("5000"),
  ],
  "production-celo": [
    "0xFa51eFDc0910CCdA91732e6806912Fa12e2FD475",
    "0xF25fA0D4896271228193E782831F6f3CFCcF169C",
    parseEther((100e6).toString()),
    parseEther("5000"),
  ],
};

export default buildModule("EngagementRewardsProxy", (builder) => {
  const implementation = builder.useModule(EngagementRewards).implementation;
  // Encode the initialize function call for the contract.
  //   IERC20 _rewardToken,
  //         IIdentity _identityContract,
  //         uint256 _maxRewardsPerApp,
  //         uint256 _rewardAmount
  const initialize = builder.encodeFunctionCall(
    implementation,
    "initialize",
    deployArgs[hre.network.name] || deployArgs.default,
  );

  // Deploy the ERC1967 Proxy, pointing to the implementation
  const proxy = builder.contract("ERC1967Proxy", [implementation, initialize]);
  return { proxy };
});
