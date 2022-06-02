// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "../helpers/Errors.sol";

contract FluidUpgradeableProxy is TransparentUpgradeableProxy {
  constructor(
    address _logic,
    address admin_,
    bytes memory _data
  ) payable TransparentUpgradeableProxy(_logic, admin_, _data) {}

  modifier OnlyAdmin() {
    require(msg.sender == _getAdmin(), Errors.CALLER_NOT_POOL_ADMIN);
    _;
  }

  function getImplementation() external view OnlyAdmin returns (address) {
    return _getImplementation();
  }
}
