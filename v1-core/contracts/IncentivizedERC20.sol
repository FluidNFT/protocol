// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import {IIncentivesController} from "./interfaces/IIncentivesController.sol";

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";

import "hardhat/console.sol";

/**
 * @title IncentivizedERC20
 * @notice Add Incentivized Logic to ERC20 implementation
 * @author FluidNFT
 **/
abstract contract IncentivizedERC20 is Initializable, IERC20MetadataUpgradeable, ERC20Upgradeable {
  uint8 private _customDecimals;

  function __IncentivizedERC20_init(
    string memory _name,
    string memory _symbol,
    uint8 _decimals
  ) internal initializer {
    __ERC20_init(_name, _symbol);

    _customDecimals = _decimals;
  }

  /**
   * @dev Returns the decimals of the token.
   */
  function decimals() public view virtual override(ERC20Upgradeable, IERC20MetadataUpgradeable) returns (uint8) {
    return _customDecimals;
  }

  /**
   * @return Abstract function implemented by the child fToken/debtToken.
   * Done this way in order to not break compatibility with previous versions of fTokens/debtTokens
   **/
  function _getIncentivesController() internal view virtual returns (IIncentivesController);

  function _getUnderlyingAssetAddress() internal view virtual returns (address);

  function _transfer(
    address sender,
    address recipient,
    uint256 amount
  ) internal virtual override {
    uint256 oldSenderBalance = super.balanceOf(sender);
    uint256 oldRecipientBalance = super.balanceOf(recipient);

    super._transfer(sender, recipient, amount);

    if (address(_getIncentivesController()) != address(0)) {
      uint256 currentTotalSupply = super.totalSupply();
      _getIncentivesController().handleAction(sender, currentTotalSupply, oldSenderBalance);
      if (sender != recipient) {
        _getIncentivesController().handleAction(recipient, currentTotalSupply, oldRecipientBalance);
      }
    }
  }

  function _mint(address account, uint256 amount) internal virtual override {
    uint256 oldTotalSupply = super.totalSupply();
    uint256 oldAccountBalance = super.balanceOf(account);

    super._mint(account, amount);

    if (address(_getIncentivesController()) != address(0)) {
      _getIncentivesController().handleAction(account, oldTotalSupply, oldAccountBalance);
    }
  }

  function _burn(address account, uint256 amount) internal virtual override {
    uint256 oldTotalSupply = super.totalSupply();
    uint256 oldAccountBalance = super.balanceOf(account);

    super._burn(account, amount);

    if (address(_getIncentivesController()) != address(0)) {
      _getIncentivesController().handleAction(account, oldTotalSupply, oldAccountBalance);
    }
  }
}
