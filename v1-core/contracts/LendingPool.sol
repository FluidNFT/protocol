// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import { IFToken } from "./interfaces/IFToken.sol";
import { IDebtToken } from "./interfaces/IDebtToken.sol";
import { ICollateralManager } from "./interfaces/ICollateralManager.sol";
import { DataTypes } from './libraries/DataTypes.sol';
import { LendingPoolLogic } from './LendingPoolLogic.sol';
import { LendingPoolEvents } from './LendingPoolEvents.sol';
import { TokenPriceConsumer } from './TokenPriceConsumer.sol';
import { DataTypes } from "./libraries/DataTypes.sol";
import { ReserveLogic } from "./libraries/ReserveLogic.sol";
import { SupplyLogic } from "./libraries/SupplyLogic.sol";
import { BorrowLogic } from "./libraries/BorrowLogic.sol";
import { LiquidateLogic } from "./libraries/LiquidateLogic.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import { SafeMath } from '@openzeppelin/contracts/utils/math/SafeMath.sol';
import "./WadRayMath.sol";
import "hardhat/console.sol";

/// @title Lending Pool contract for instant, permissionless NFT-backed loans
/// @author Niftrr
/// @notice Allows for the borrow/repay of loans and deposit/withdraw of assets.
/// @dev This is our protocol's point of access.
contract LendingPool is Context, LendingPoolLogic, LendingPoolEvents, AccessControl, Pausable, ReentrancyGuard {
    using SafeMath for uint256;  
    using WadRayMath for uint256;
    using ReserveLogic for DataTypes.Reserve;

    bytes32 internal constant CONFIGURATOR_ROLE = keccak256("CONFIGURATOR_ROLE");

    bytes32 private constant BID = keccak256("BID");
    bytes32 private constant BORROW = keccak256("BORROW");
    bytes32 private constant DEPOSIT = keccak256("DEPOSIT");
    bytes32 private constant LIQUIDATE = keccak256("LIQUIDATE");
    bytes32 private constant REDEEM = keccak256("REDEEM");
    bytes32 private constant REPAY = keccak256("REPAY");
    bytes32 private constant WITHDRAW = keccak256("WITHDRAW");
    bytes32 private constant CM = keccak256("CM");
    bytes32 private constant NFT_PRICE_ORACLE = keccak256("NFT_PRICE_ORACLE");
    bytes32 private constant TOKEN_PRICE_ORACLE = keccak256("TOKEN_PRICE_ORACLE");

    bytes32 private constant ACTIVE = keccak256("ACTIVE");
    bytes32 private constant FROZEN = keccak256("FROZEN");
    bytes32 private constant PAUSED = keccak256("PAUSED");
    bytes32 private constant PROTECTED = keccak256("PROTECTED");

    constructor(
        address configurator, 
        address treasuryAddress
        ) 
    {
        _setupRole(CONFIGURATOR_ROLE, configurator);
        _treasuryAddress = treasuryAddress;
        _interestFee = WadRayMath.ray().rayMul(5).rayDiv(100); //5%
        _liquidationFee = WadRayMath.ray().rayMul(5).rayDiv(100); //5%
        _liquidationFeeProtocolPercentage = WadRayMath.ray().rayMul(10).rayDiv(100); //10%
    }

    modifier onlyConfigurator() {
        require(hasRole(CONFIGURATOR_ROLE, _msgSender()), "C1");
        _;
    }

    modifier whenReserveActive(address collateral, address asset) {
        DataTypes.Reserve memory reserve = _reserves[keccak256(abi.encode(collateral, asset))];  
        require(reserve.status == DataTypes.ReserveStatus.Active, "R1");  
        _;
    }

    modifier whenReserveNotPaused(address collateral, address asset) {
        DataTypes.Reserve memory reserve = _reserves[keccak256(abi.encode(collateral, asset))];  
        require(reserve.status != DataTypes.ReserveStatus.Paused, "R2");  
        _;
    }

    modifier whenReserveNotProtected(address collateral, address asset) {
        DataTypes.Reserve memory reserve = _reserves[keccak256(abi.encode(collateral, asset))];  
        require(reserve.status != DataTypes.ReserveStatus.Protected, "R3");  
        _;
    }

    function updateInterestFee(uint256 interestFee) 
        public
        onlyConfigurator
    {
        _interestFee = interestFee;
    }

    function updateLiquidationFee(uint256 liquidationFee) 
        public
        onlyConfigurator
    {
        _liquidationFee = liquidationFee;
    }

    function updateLiquidationFeeProtocolPercentage(uint256 protocolPercentage) 
        public
        onlyConfigurator
    {
        _liquidationFeeProtocolPercentage = protocolPercentage;
    }

    function connectContract(
        bytes32 contractName,
        address contractAddress
    )
        public
        onlyConfigurator
    {
        if (contractName==CM) {
            _collateralManagerAddress = contractAddress;
        } else if (contractName==NFT_PRICE_ORACLE) { 
            _nftPriceConsumerAddress = contractAddress;
        } else if (contractName==TOKEN_PRICE_ORACLE) { 
            _tokenPriceConsumerAddress = contractAddress;
        } 
        emit LendingPoolConnected(contractName, contractAddress);
    }

    /// @notice Initializes a reserve.
    /// @param collateral The NFT collateral contract address.
    /// @param asset The ERC20, reserve asset token.
    /// @param fTokenAddress The derivative fToken address.
    /// @param debtTokenAddress The derivative debtToken address.
    /// @param assetName The name of the asset. E.g. WETH.
    /// @dev Calls internal `_initReserve` function if modifiers are succeeded.    
    function initReserve(
        address collateral,
        address asset,
        address fTokenAddress,
        address debtTokenAddress,
        string calldata assetName
    ) 
        external 
        onlyConfigurator 
    {
        _initReserve(collateral, asset, fTokenAddress, debtTokenAddress, assetName);
    }

    /// @notice Deposit assets into the lending pool.
    /// @param collateral The NFT collateral contract address.
    /// @param asset The ERC20 address of the asset.
    /// @param amount The amount of ERC20 tokens.
    /// @dev Calls `LendingPoolDeposit` function if modifiers are succeeded.  
    function deposit(
        address collateral,
        address asset, 
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) 
        external 
        nonReentrant
        whenNotPaused 
        whenReserveActive(collateral, asset)
    {
        SupplyLogic.executeDeposit(
            _reserves,
            DataTypes.ExecuteDepositParams({
                initiator: _msgSender(),
                collateral: collateral,
                asset: asset,
                amount: amount, 
                onBehalfOf: onBehalfOf,
                referralCode: referralCode
            })
        );
    }

    /// @notice Withdraw assets from the lending pool.
    /// @param collateral The NFT collateral contract address.
    /// @param asset The ERC20 address of the asset.
    /// @param amount The amount of ERC20 tokens.
    /// @param to The address that will receive the underlying, same as msg.sender if the user wants to receive to their wallet or different if the benefitiary is a different wallet
    /// @dev Calls `LendingPoolWithdraw` function if modifiers are succeeded. 
    function withdraw(
        address collateral,
        address asset, 
        uint256 amount,
        address to
    ) 
        external 
        nonReentrant
        whenNotPaused 
        whenReserveNotPaused(collateral, asset)
    {
        SupplyLogic.executeWithdraw(
            _reserves,
            DataTypes.ExecuteWithdrawParams({
                initiator: _msgSender(),
                collateral: collateral,
                asset: asset,
                amount: amount,
                to: to
            })
        );
    }

    /// @notice External function to bid on a defaulted borrow.
    /// @param asset The ERC20 token to be borrowed.
    /// @param amount The amount of ERC20 tokens to be borrowed.
    /// @param borrowId The unique identifier of the borrow.
    /// @dev Calls `LendingPoolBid` function if modifiers are succeeded. 
    function bid(
        address asset, 
        uint256 amount, 
        uint256 borrowId
    ) 
        external 
        nonReentrant
        whenNotPaused
    {
        LiquidateLogic.executeBid(
            _assetNames,
            _reserves,
            DataTypes.ExecuteBidParams({
                initiator: _msgSender(),
                asset: asset,
                amount: amount,
                borrowId: borrowId,
                tokenPriceConsumerAddress: _tokenPriceConsumerAddress,
                nftPriceConsumerAddress: _nftPriceConsumerAddress,
                collateralManagerAddress: _collateralManagerAddress,
                liquidationFee: _liquidationFee
            })
        );
    }

    /// @notice External function to create a borrow position.
    /// @param asset The ERC20 token to be borrowed.
    /// @param amount The amount of ERC20 tokens to be borrowed.
    /// @param collateral The ERC721 token to be used as collateral.
    /// @param tokenId The tokenId of the ERC721 token to be deposited. 
    /// @param onBehalfOf The address to receive the loan.
    /// @param referralCode Code used to register the integrator originated the operation, for potential rewards.
    /// @dev Calls `LendingPoolBorrow` function if modifiers are succeeded. 
    function borrow(
        address asset, 
        uint256 amount, 
        address collateral, 
        uint256 tokenId,
        address onBehalfOf,
        uint16 referralCode
    ) 
        external 
        nonReentrant
        whenNotPaused
        whenReserveActive(collateral, asset)
    {
        BorrowLogic.executeBorrow(
            _assetNames,
            _reserves,
            // _nfts,
            DataTypes.ExecuteBorrowParams({
                initiator: _msgSender(),
                asset: asset,
                amount: amount,
                collateral: collateral,
                tokenId: tokenId,
                onBehalfOf: onBehalfOf,
                referralCode: referralCode,
                tokenPriceConsumerAddress: _tokenPriceConsumerAddress,
                nftPriceConsumerAddress: _nftPriceConsumerAddress,
                collateralManagerAddress: _collateralManagerAddress
            })
        );
    }

    /// @notice To liquidate a borrow position.
    /// @param collateral The ERC721 token used as collateral.
    /// @param asset The ERC20 token borrowed.
    /// @param borrowId The unique identifier of the borrow.
    /// @dev Calls `LendingPoolLiquidate` function if modifiers are succeeded.   
    function liquidate(
        address collateral,
        address asset,
        uint256 borrowId
    )
        external 
        nonReentrant
        whenNotPaused
        whenReserveNotPaused(collateral, asset)
        whenReserveNotProtected(collateral, asset)
    {
        LiquidateLogic.executeLiquidate(
            _assetNames,
            _reserves,
            // _nfts,
            DataTypes.ExecuteLiquidateParams({
                initiator: _msgSender(),
                collateral: collateral,
                asset: asset,
                borrowId: borrowId,
                tokenPriceConsumerAddress: _tokenPriceConsumerAddress,
                nftPriceConsumerAddress: _nftPriceConsumerAddress,
                collateralManagerAddress: _collateralManagerAddress,
                treasuryAddress: _treasuryAddress,
                auctionDuration: _auctionDuration
            })
        );
    }

    /// @notice To redeem a borrow position.
    /// @param collateral The NFT collateral contract address.
    /// @param asset The ERC20 token borrowed.
    /// @param amount The amount of ERC20 tokens to be repaid.
    /// @param borrowId The unique identifier of the borrow.
    /// @dev Calls `LendingPoolRedeem` function if modifiers are succeeded.  
    function redeem(
        address collateral,
        address asset,
        uint256 amount,
        uint256 borrowId
    ) 
        external 
        nonReentrant
        whenNotPaused
        whenReserveNotPaused(collateral, asset)
    {
        LiquidateLogic.executeRedeem(
            _assetNames,
            _reserves,
            DataTypes.ExecuteRedeemParams({
                initiator: _msgSender(),
                collateral: collateral,
                asset: asset,
                amount: amount,
                borrowId: borrowId,
                tokenPriceConsumerAddress: _tokenPriceConsumerAddress,
                nftPriceConsumerAddress: _nftPriceConsumerAddress,
                collateralManagerAddress: _collateralManagerAddress
            })
        );
    }

    /// @notice To repay a borrow position.
    /// @param collateral The NFT collateral contract address.
    /// @param asset The ERC20 token to be borrowed.
    /// @param amount The amount of ERC20 tokens to be repaid.
    /// @param borrowId The unique identifier of the borrow.
    /// @dev Calls `LendingPoolRepay` function if modifiers are succeeded.  
    function repay(
        address collateral,
        address asset,
        uint256 amount,
        uint256 borrowId
    ) 
        external 
        nonReentrant
        whenNotPaused
        whenReserveNotPaused(collateral, asset)
    {
        BorrowLogic.executeRepay(
            _assetNames,
            _reserves,
            // _nfts,
            DataTypes.ExecuteRepayParams({
                initiator: _msgSender(),
                collateral: collateral,
                asset: asset,
                amount: amount,
                borrowId: borrowId,
                tokenPriceConsumerAddress: _tokenPriceConsumerAddress,
                nftPriceConsumerAddress: _nftPriceConsumerAddress,
                collateralManagerAddress: _collateralManagerAddress
            })
        );
    }

    /// @notice Pauses the contract `deposit`, `withdraw`, `borrow` and `repay` functions.
    /// @dev Functions paused via modifiers using Pausable contract.
    function pause() external onlyConfigurator {
        _pause();
    }

    /// @notice Unauses the contract `deposit`, `withdraw`, `borrow` and `repay` functions.
    /// @dev Functions unpaused via modifiers using Pausable contract.
    function unpause() external onlyConfigurator {
        _unpause();
    }

    function getReserveData(
        address collateral,
        address asset
    ) 
        public
        view
        returns (uint256, uint256, uint256)
    {
        DataTypes.Reserve memory reserve = _reserves[keccak256(abi.encode(collateral, asset))]; 
        
        uint256 userBalance = IFToken(reserve.fTokenAddress).balanceOf(_msgSender());
        uint256 depositBalance = IERC20(asset).balanceOf(reserve.fTokenAddress);
        uint256 borrowBalance = IDebtToken(reserve.debtTokenAddress).totalSupply();
        return (userBalance, depositBalance, borrowBalance);
    }

    /// @notice Update status of a reserve.
    /// @param collateral The NFT collateral contract address.
    /// @param asset The ERC20, reserve asset token.
    /// @param status The new status.
    /// @dev To activate all functions for a single reserve.
    function updateReserve(
        address collateral, 
        address asset,
        bytes32 status
    ) 
        external 
        onlyConfigurator 
    {
        DataTypes.Reserve storage reserve = _reserves[keccak256(abi.encode(collateral, asset))]; 
        
        if (status==ACTIVE) {
            reserve.status = DataTypes.ReserveStatus.Active;  
        } else if (status==FROZEN) {
            reserve.status = DataTypes.ReserveStatus.Frozen;
        } else if (status==PAUSED) {
            reserve.status = DataTypes.ReserveStatus.Paused;
        } else if (status==PROTECTED) {
            reserve.status = DataTypes.ReserveStatus.Protected;
        }
        
        emit ReserveStatus(collateral, asset, status);
    }

    /// @notice Private function to initialize a reserve.
    /// @param collateral The NFT collateral contract address.
    /// @param asset The ERC20, reserve asset token.
    /// @param fTokenAddress The derivative fToken address.
    /// @param debtTokenAddress The derivative debtToken address.
    /// @param assetName The name of the asset. E.g. WETH.
    /// @dev ERC20 asset address used as reserve key.    
    function _initReserve(
        address collateral,
        address asset,
        address fTokenAddress,
        address debtTokenAddress,
        string calldata assetName
    ) 
        private
    {
        DataTypes.Reserve memory reserve;
        reserve.status = DataTypes.ReserveStatus.Active;
        reserve.fTokenAddress = fTokenAddress;
        reserve.debtTokenAddress = debtTokenAddress;
        reserve.liquidityIndex = 10**27;
        _reserves[keccak256(abi.encode(collateral, asset))] = reserve;
        _underlyingAssets[fTokenAddress] = asset;
        _assetNames[asset] = assetName;

        emit InitReserve(collateral, asset, _reserves[keccak256(abi.encode(collateral, asset))].fTokenAddress, _reserves[keccak256(abi.encode(collateral, asset))].debtTokenAddress);
    }

    function getAuctionDuration() public view returns (uint40) {
        return _auctionDuration;
    }    

    function setAuctionDuration(uint40 duration) external onlyConfigurator {
        _auctionDuration = duration;
    }
}