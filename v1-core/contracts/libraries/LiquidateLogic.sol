// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.9;

import { DataTypes } from "./DataTypes.sol";

import { IFToken } from "../interfaces/IFToken.sol";
import { IDebtToken } from "../interfaces/IDebtToken.sol";
import { ICollateralManager } from "../interfaces/ICollateralManager.sol";
import { ITokenPriceConsumer } from "../interfaces/ITokenPriceConsumer.sol";
import { INFTPriceConsumer } from "../interfaces/INFTPriceConsumer.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ReserveLogic } from "./ReserveLogic.sol";
import { InterestLogic } from "./InterestLogic.sol";
import { SafeMath } from '@openzeppelin/contracts/utils/math/SafeMath.sol';
import "../WadRayMath.sol";

library LiquidateLogic {
    using SafeMath for uint256;  
    using WadRayMath for uint256;
    using ReserveLogic for DataTypes.Reserve;

    struct LiquidateVars {
        bool success;
        uint256 repaymentAmount;
        uint256 remainderAmount;
        uint256 reimbursementAmount;
    }

    function executeLiquidate(
        mapping(address => string) storage assetNames,
        mapping(bytes32 => DataTypes.Reserve) storage reserves,
        DataTypes.ExecuteLiquidateParams memory params
    ) 
        external
    {
        _liquidate(assetNames, reserves, params);
    }

    function _liquidate(
        mapping(address => string) storage assetNames,
        mapping(bytes32 => DataTypes.Reserve) storage reserves,
        DataTypes.ExecuteLiquidateParams memory params
    )
        internal
    {
        LiquidateVars memory vars;
        DataTypes.Borrow memory borrowItem = ICollateralManager(
            params.collateralManagerAddress
        ).getBorrow(params.borrowId);
        DataTypes.Reserve storage reserve = reserves[keccak256(abi.encode(borrowItem.collateral.erc721Token, borrowItem.erc20Token))]; 
        
        require(borrowItem.status == DataTypes.BorrowStatus.ActiveAuction, "AUCTION_NOT_TRIGGERED");
        require(uint40(block.timestamp) - borrowItem.auction.timestamp > params.auctionDuration, "AUCTION_STILL_ACTIVE"); 
        require(borrowItem.erc20Token == params.asset, "INCORRECT_ASSET");
        require(borrowItem.collateral.erc721Token == params.collateral, "INCORRECT_COLLATERAL");

        vars.repaymentAmount = borrowItem.borrowAmount.rayMul(
            InterestLogic.calculateLinearInterest(borrowItem.interestRate, borrowItem.timestamp)
        );

        vars.remainderAmount = borrowItem.auction.bid.sub(vars.repaymentAmount);
        vars.reimbursementAmount = vars.remainderAmount.sub(borrowItem.auction.liquidationFee);

        uint256 liquidationFeeToCaller = borrowItem.auction.liquidationFee.mul(90).div(100); // TODO: make this updatable. E.g. this split is 4.5% to Caller and 0.5% to Protocol to cover dust
        uint256 liquidationFeeToProtocol = borrowItem.auction.liquidationFee - liquidationFeeToCaller;

        IFToken(reserve.fTokenAddress).reserveTransfer(borrowItem.auction.caller, liquidationFeeToCaller);
    
        IFToken(reserve.fTokenAddress).reserveTransfer(params.treasuryAddress, liquidationFeeToProtocol);

        IFToken(reserve.fTokenAddress).reserveTransfer(borrowItem.borrower, vars.reimbursementAmount);
        
        IDebtToken(reserve.debtTokenAddress).burnFrom(borrowItem.borrower, vars.repaymentAmount);
        
        vars.success = ICollateralManager(params.collateralManagerAddress).retrieve(
            params.borrowId, 
            borrowItem.erc20Token, 
            vars.repaymentAmount,
            borrowItem.auction.bidder
        );
        require(vars.success, "UNSUCCESSFUL_RETRIEVE");

    }
}