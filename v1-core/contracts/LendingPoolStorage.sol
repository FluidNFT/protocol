// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import { DataTypes } from './libraries/types/DataTypes.sol';
import { ReserveLogic } from './libraries/logic/ReserveLogic.sol';

/// @title Lending Pool Storage contract.
/// @author Niftrr
/// @notice Separates storage from the Lending Pool contract.
/// @dev To maintain storage and help limit size of Lending Pool contract.
contract LendingPoolStorage {
    using ReserveLogic for DataTypes.Reserve;

    address internal _treasuryAddress;
    address internal _lendingPoolBidAddress;
    address internal _lendingPoolBorrowAddress;
    address internal _lendingPoolDepositAddress;
    address internal _lendingPoolLiquidateAddress;
    address internal _lendingPoolRedeemAddress;
    address internal _lendingPoolRepayAddress;
    address internal _lendingPoolWithdrawAddress;

    // collateral + asset => reserve
    mapping(address =>  mapping(address => DataTypes.Reserve)) internal _reserves;
    mapping(address => address) internal _underlyingAssets;
    mapping(address => string) internal _pricePairs;
    mapping(address => string) internal _assetNames;

    mapping(uint256 => DataTypes.ReserveConfig) internal _reservesList;
    uint256 internal _reservesCount;

    uint256 internal _maxNumberOfReserves;

    // mapping(address => mapping(address => uint256)) userScaledBalances;
    // mapping(address => mapping(address => uint256)) userFTokenBalances;

    address internal _collateralManagerAddress;
    address internal _tokenPriceConsumerAddress;
    address internal _nftPriceConsumerAddress;

    bool internal _isCollateralManagerConnected = false;

    uint256 internal _interestFee;
    uint256 internal _liquidationFee;
    uint256 internal _liquidationFeeProtocolPercentage;

    uint40 internal _auctionDuration = 24 hours;
}