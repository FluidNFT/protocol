// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import {ILendingPoolAddressesProvider} from "../interfaces/ILendingPoolAddressesProvider.sol";
import {IIncentivesController} from "./IIncentivesController.sol";
import {IScaledBalanceToken} from "./IScaledBalanceToken.sol";

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";


interface IDebtToken is IScaledBalanceToken, IERC20Upgradeable, IERC20MetadataUpgradeable {
    /**
    * @dev Emitted when a debt token is initialized
    * @param underlyingCollateral The address of the underlying collateral
    * @param underlyingAsset The address of the underlying asset
    * @param pool The address of the associated lend pool
    * @param incentivesController The address of the incentives controller
    * @param debtTokenDecimals the decimals of the debt token
    * @param debtTokenName the name of the debt token
    * @param debtTokenSymbol the symbol of the debt token
    **/
    event Initialized(
        address indexed underlyingCollateral,
        address indexed underlyingAsset,
        address indexed pool,
        address incentivesController,
        uint8 debtTokenDecimals,
        string debtTokenName,
        string debtTokenSymbol
    );

    /**
    * @dev Emitted after the mint action
    * @param from The address performing the mint
    * @param value The amount to be minted
    * @param index The last index of the reserve
    **/
    event Mint(address indexed from, uint256 value, uint256 index);

    /**
    * @dev Emitted when variable debt is burnt
    * @param user The user which debt has been burned
    * @param amount The amount of debt being burned
    * @param index The index of the user
    **/
    event Burn(address indexed user, uint256 amount, uint256 index);

    function initialize(
        address addressProvider,
        address underlyingCollateral,
        address underlyingAsset,
        uint8 debtTokenDecimals,
        string memory debtTokenName,
        string memory debtTokenSymbol
    ) external;
    
    function mint(
        address user,
        address onBehalfOf,
        uint256 amount,
        uint256 index
    ) external returns (bool);

    function burn(
        address user,
        uint256 amount,
        uint256 index
    ) external returns (bool);

    function getIncentivesController() external view returns (IIncentivesController);

    function approveDelegation(address delegatee, uint256 amount) external;

    function borrowAllowance(address fromUser, address toUser) external view returns (uint256);

}