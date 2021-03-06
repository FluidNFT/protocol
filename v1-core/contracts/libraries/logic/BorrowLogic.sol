// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import { DataTypes } from "../types/DataTypes.sol";

import { IFToken } from "../../interfaces/IFToken.sol";
import { IDebtToken } from "../../interfaces/IDebtToken.sol";
import { ICollateralManager } from "../../interfaces/ICollateralManager.sol";
import { ITokenPriceConsumer } from "../../interfaces/ITokenPriceConsumer.sol";
import { INFTPriceConsumer } from "../../interfaces/INFTPriceConsumer.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import { ReserveLogic } from "./ReserveLogic.sol";
import { InterestLogic } from "./InterestLogic.sol";
import { SafeMath } from '@openzeppelin/contracts/utils/math/SafeMath.sol';
import "../math/WadRayMath.sol";

library BorrowLogic {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;  
    using WadRayMath for uint256;
    using ReserveLogic for DataTypes.Reserve;

    struct BorrowVars {
        bool success;
        uint256 borrowId;
        uint256 borrowAmount;
        uint256 interestRate;
        uint256 floorPrice;
        DataTypes.Borrow borrowItem;
    }

    /// @notice Emitted when a borrow is activated.
    /// @param initiator The address initiating the deposit. 
    /// @param asset The ERC20, reserve asset address.
    /// @param amount The amount of ERC20 tokens.
    /// @param collateral The NFT contract address of the collateral.
    /// @param tokenId The specific NFT tokenId.
    /// @param onBehalfOf The address that will receive the funds, same as msg.sender if the user wants to receive them on their own wallet, different if the benefitiary is a different wallet.
    /// @param referralCode Code used to register the integrator originating the operation, for potential rewards. 0 if the action is executed directly by the user, without any middle-man
    event Borrow(
        address initiator, 
        address asset,
        uint256 amount, 
        address collateral, 
        uint256 tokenId, 
        address onBehalfOf,
        uint16 referralCode
    );  

    /// @notice Private function to calculate borrow variables.
    /// @param asset The ERC20 token to be borrowed.
    /// @param collateral The ERC721 token to be used as collateral.
    /// @param collateralManagerAddress The Collateral Manager contract address.
    /// @dev Returns items in a fixed array and split from _borrow to save on space.
    /// @return InterestRate and collateralFloorPrice.
    function getBorrowVariables(
        address asset,
        address collateral,
        address collateralManagerAddress,
        address nftPriceConsumerAddress,
        address tokenPriceConsumerAddress,
        mapping(address => string) storage assetNames
    )
        internal
        returns (uint256, uint256)
    {
        uint256 interestRate = ICollateralManager(
            collateralManagerAddress
        ).getInterestRate(
            collateral,
            asset
        );

        uint256 collateralFloorPrice = INFTPriceConsumer(nftPriceConsumerAddress).getFloorPrice(collateral);
        if (keccak256(abi.encodePacked(assetNames[asset])) != keccak256(abi.encodePacked("WETH"))) {
            collateralFloorPrice = collateralFloorPrice.mul(ITokenPriceConsumer(tokenPriceConsumerAddress).getEthPrice(asset));
        }
        return (interestRate, collateralFloorPrice);
    }

    function executeBorrow(
        mapping(address => string) storage assetNames,
        mapping(address => mapping(address => DataTypes.Reserve)) storage reserves,
        DataTypes.ExecuteBorrowParams memory params
    )
        external 
    {
        _borrow(
            assetNames,
            reserves, 
            params
        );
    }

    function executeBatchBorrow(
        mapping(address => string) storage assetNames,
        mapping(address => mapping(address => DataTypes.Reserve)) storage reserves,
        DataTypes.ExecuteBatchBorrowParams memory params  
    )
        external
    {
        require(params.collaterals.length == params.assets.length, "Inconsistent assets length");
        require(params.collaterals.length == params.amounts.length, "Inconsistent amounts length");
        require(params.collaterals.length == params.tokenIds.length, "Inconsistent tokenIds length");

        for (uint256 i = 0; i < params.collaterals.length; i++) {
            _borrow(
                assetNames,
                reserves,
                DataTypes.ExecuteBorrowParams({
                    initiator: params.initiator,
                    asset: params.assets[i],
                    amount: params.amounts[i],
                    collateral: params.collaterals[i],
                    tokenId: params.tokenIds[i],
                    onBehalfOf: params.onBehalfOf,
                    referralCode: params.referralCode,
                    tokenPriceConsumerAddress: params.tokenPriceConsumerAddress,
                    nftPriceConsumerAddress: params.nftPriceConsumerAddress,
                    collateralManagerAddress: params.collateralManagerAddress
                })
            );
        }
    }

    function _borrow(
        mapping(address => string) storage assetNames,
        mapping(address => mapping(address => DataTypes.Reserve)) storage reserves,
        DataTypes.ExecuteBorrowParams memory params
    )
        internal
    {        
        BorrowVars memory vars;
        DataTypes.Reserve storage reserve = reserves[params.collateral][params.asset];
        
        // update state MUST BEFORE get borrow amount which is depent on latest borrow index
        reserve.updateState();

        (vars.interestRate, vars.floorPrice) = getBorrowVariables(
            params.asset, 
            params.collateral,
            params.collateralManagerAddress,
            params.nftPriceConsumerAddress,
            params.tokenPriceConsumerAddress,
            assetNames
        );

        vars.borrowId = ICollateralManager(params.collateralManagerAddress).getBorrowId(params.collateral, params.tokenId);
        
        // TODO: ValidationLogic.validateBorrow();
        
        if (vars.borrowId == 0) {
            // create borrow
            vars.success = ICollateralManager(params.collateralManagerAddress).deposit(
                params.onBehalfOf, 
                params.asset, 
                params.collateral, 
                params.tokenId, 
                params.amount,
                vars.interestRate,
                vars.floorPrice,
                reserve.variableBorrowIndex,
                uint40(block.timestamp)
            ); 
            require(vars.success, "UNSUCCESSFUL_DEPOSIT");
        } else {
            // update borrow
            vars.borrowItem = ICollateralManager(params.collateralManagerAddress).getBorrow(vars.borrowId);
            if (keccak256(abi.encodePacked(assetNames[params.asset])) != keccak256(abi.encodePacked("WETH"))) {
                vars.floorPrice = vars.floorPrice.mul(ITokenPriceConsumer(params.tokenPriceConsumerAddress).getEthPrice(params.asset));
            }
            (vars.success, vars.borrowAmount, vars.interestRate) = ICollateralManager(params.collateralManagerAddress).updateBorrow(
                vars.borrowId,
                params.asset,
                params.amount,
                vars.floorPrice,
                vars.borrowItem.status,
                false, // isRepayment
                params.onBehalfOf,
                reserve.variableBorrowIndex
            );
            require(vars.success, "UNSUCCESSFUL_BORROW");
        }

        IDebtToken(reserve.debtTokenAddress).mint(
            params.initiator, 
            params.onBehalfOf, 
            params.amount, 
            reserve.variableBorrowIndex
        );

        // update interest rate according latest borrow amount (utilizaton)
        reserve.updateInterestRates(params.asset, reserve.fTokenAddress, 0, params.amount);

        IFToken(reserve.fTokenAddress).transferUnderlyingTo(params.onBehalfOf, params.amount);
    }

    struct RepayVars {
        bool success;
        bool partialRepayment;
        uint256 borrowAmount;
        uint256 repaymentAmount;
        uint256 accruedBorrowAmount;
        uint256 interestRate;
        uint256 floorPrice;
        DataTypes.Borrow borrowItem;
    }

    function executeRepay(
        mapping(address => string) storage assetNames,
        mapping(address => mapping(address => DataTypes.Reserve)) storage reserves,
        DataTypes.ExecuteRepayParams memory params
    )
        external
    {
        _repay(assetNames, reserves, params);
    }

    function _repay(
        mapping(address => string) storage assetNames,
        mapping(address => mapping(address => DataTypes.Reserve)) storage reserves,
        DataTypes.ExecuteRepayParams memory params
    )
        internal
        returns (bool, uint256)
    {
        RepayVars memory vars;
        vars.borrowItem = ICollateralManager(params.collateralManagerAddress).getBorrow(params.borrowId);
        DataTypes.Reserve storage reserve = reserves[params.collateral][params.asset]; 

        // update state MUST BEFORE get borrow amount which is depent on latest borrow index
        reserve.updateState();

        (,,vars.accruedBorrowAmount) = ICollateralManager(params.collateralManagerAddress).getBorrowAmount(params.borrowId);

        vars.partialRepayment = params.amount < vars.accruedBorrowAmount;
        vars.repaymentAmount = vars.partialRepayment ? params.amount : vars.accruedBorrowAmount;
 
        IERC20(vars.borrowItem.erc20Token).safeTransferFrom(
            params.initiator,
            reserve.fTokenAddress,
            vars.repaymentAmount
        );

        if (vars.partialRepayment) {
            vars.floorPrice = INFTPriceConsumer(params.nftPriceConsumerAddress).getFloorPrice(vars.borrowItem.collateral.erc721Token);
            if (keccak256(abi.encodePacked(assetNames[params.asset])) != keccak256(abi.encodePacked("WETH"))) {
                vars.floorPrice = vars.floorPrice.mul(ITokenPriceConsumer(params.tokenPriceConsumerAddress).getEthPrice(params.asset));
            }
            (vars.success, vars.borrowAmount, vars.interestRate) = ICollateralManager(params.collateralManagerAddress).updateBorrow(
                params.borrowId,
                params.asset,
                vars.repaymentAmount, 
                vars.floorPrice,
                DataTypes.BorrowStatus.Active,
                true, // isRepayment
                vars.borrowItem.borrower,
                reserve.variableBorrowIndex
            );
            require(vars.success, "UNSUCCESSFUL_PARTIAL_REPAY");           
        } else {
            (vars.success, vars.borrowAmount, vars.interestRate) = ICollateralManager(params.collateralManagerAddress).withdraw(
                params.borrowId, 
                params.asset, 
                vars.repaymentAmount, //repaymentAmount
                reserve.variableBorrowIndex
            );
            require(vars.success, "UNSUCCESSFUL_WITHDRAW");   
        }

        vars.success = IDebtToken(reserve.debtTokenAddress).burn(vars.borrowItem.borrower, vars.repaymentAmount, reserve.variableBorrowIndex); 
        require(vars.success, "UNSUCCESSFUL_BURN");

        // update interest rate according latest borrow amount (utilizaton)
        reserve.updateInterestRates(params.asset, reserve.fTokenAddress, vars.repaymentAmount, 0);
        
        return (vars.success, vars.repaymentAmount);
    }
}