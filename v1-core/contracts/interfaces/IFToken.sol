// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

// import {ILendingPoolAddressesProvider} from "./ILendingPoolAddressesProvider.sol";
import {IIncentivesController} from "./IIncentivesController.sol";
import {IScaledBalanceToken} from "./IScaledBalanceToken.sol"; 

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";


interface IFToken is IScaledBalanceToken, IERC20Upgradeable, IERC20MetadataUpgradeable {
    /**
    * @dev Emitted when an fToken is initialized
    * @param underlyingCollateral The address of the underlying collateral
    * @param underlyingAsset The address of the underlying asset
    * @param lendingPool The address of the associated lending pool
    * @param treasury The address of the treasury
    * @param incentivesController The address of the incentives controller for this fToken
    **/
    event Initialized(
        address indexed underlyingCollateral,
        address indexed underlyingAsset,
        address indexed lendingPool,
        address treasury,
        address incentivesController
    );

    /**
    * @dev Emitted after the mint action
    * @param from The address performing the mint
    * @param value The amount being
    * @param index The new liquidity index of the reserve
    **/
    event Mint(address indexed from, uint256 value, uint256 index);

    /**
    * @dev Emitted after fTokens are burned
    * @param from The owner of the fTokens, getting them burned
    * @param target The address that will receive the underlying
    * @param value The amount being burned
    * @param index The new liquidity index of the reserve
    **/
    event Burn(address indexed from, address indexed target, uint256 value, uint256 index);

    /**
    * @dev Emitted during the transfer action
    * @param from The user whose tokens are being transferred
    * @param to The recipient
    * @param value The amount being transferred
    * @param index The new liquidity index of the reserve
    **/
    event BalanceTransfer(address indexed from, address indexed to, uint256 value, uint256 index);

    function initialize(
        address addressProvider,
        address configurator,
        address lendingPool,
        address treasury,
        address underlyingCollateral,
        address underlyingAsset,
        uint8 fTokenDecimals,
        string calldata fTokenName,
        string calldata fTokenSymbol
    ) external;

    function mint(
        address user,
        uint256 amount,
        uint256 index
    ) external returns (bool);

    function burn(
        address user,
        address receiverOfUnderlying,
        uint256 amount,
        uint256 index
    ) external;

    function mintToTreasury(uint256 amount, uint256 index) external;

    function transferUnderlyingTo(address user, uint256 amount) external returns (uint256);

    function getIncentivesController() external view returns (IIncentivesController);

    function UNDERLYING_ASSET_ADDRESS() external view returns (address);
}