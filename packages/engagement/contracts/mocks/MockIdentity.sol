// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

contract MockIdentity {
    mapping(address => address) public whitelistedRoots;

    function setWhitelistedRoot(address user, address root) external {
        whitelistedRoots[user] = root;
    }

    function getWhitelistedRoot(address user) external view returns (address) {
        return whitelistedRoots[user];
    }
}
