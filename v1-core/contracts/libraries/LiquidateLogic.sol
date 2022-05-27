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

    struct BidVars {
        bool success;
        uint256 floorPrice;
        uint256 liquidationFee;
        uint256 borrowBalanceAmount;
    }

    function executeBid(
        mapping(address => string) storage assetNames,
        mapping(bytes32 => DataTypes.Reserve) storage reserves,
        DataTypes.ExecuteBidParams memory params
    ) 
        external
    {
        _bid(assetNames, reserves, params);
    }

    function _bid(
        mapping(address => string) storage assetNames,
        mapping(bytes32 => DataTypes.Reserve) storage reserves,
        DataTypes.ExecuteBidParams memory params
    )
        internal
    {
        BidVars memory vars;
        DataTypes.Borrow memory borrowItem = ICollateralManager(
            params.collateralManagerAddress
        ).getBorrow(params.borrowId);
        DataTypes.Reserve storage reserve = reserves[keccak256(abi.encode(borrowItem.collateral.erc721Token, borrowItem.erc20Token))];  
    
        require(params.asset == borrowItem.erc20Token, "INCORRECT_ASSET");
        require(reserve.status == DataTypes.ReserveStatus.Active, "Reserve is not active."); 

        vars.floorPrice = INFTPriceConsumer(params.nftPriceConsumerAddress).getFloorPrice(borrowItem.collateral.erc721Token);
        if (keccak256(abi.encodePacked(assetNames[params.asset])) != keccak256(abi.encodePacked("WETH"))) {
            vars.floorPrice = vars.floorPrice.mul(ITokenPriceConsumer(params.tokenPriceConsumerAddress).getEthPrice(params.asset));
        }
        require(vars.floorPrice <= borrowItem.liquidationPrice, "BORROW_NOT_IN_DEFAULT");

        vars.liquidationFee = borrowItem.borrowAmount.rayMul(params.liquidationFee);
        vars.borrowBalanceAmount = borrowItem.borrowAmount // TODO: update to use Interest Rate logic
            .add(
                (borrowItem.borrowAmount)
                .rayMul(borrowItem.interestRate)
                .mul(block.timestamp.sub(borrowItem.timestamp))
                .div(365 days)
            );

        if (borrowItem.status == DataTypes.BorrowStatus.Active) {
            require(params.amount >= vars.borrowBalanceAmount, "INSUFFICIENT_BID");
        } else if (borrowItem.status == DataTypes.BorrowStatus.ActiveAuction) {
            require(uint40(block.timestamp) - borrowItem.auction.timestamp < 1 days, "AUCTION_ENDED"); // TODO: use configuratble global variable for auction time, currently 24 hours
            require(params.amount > borrowItem.auction.bid, "INSUFFICIENT_BID");
        } else {
            revert("INACTIVE_BORROW");
        }
        
        IERC20(params.asset).transferFrom(params.initiator, reserve.fTokenAddress, params.amount);

        if (vars.success && borrowItem.status == DataTypes.BorrowStatus.ActiveAuction) {
            IFToken(reserve.fTokenAddress).reserveTransfer(borrowItem.auction.bidder, borrowItem.auction.bid);
        }

        if (borrowItem.status == DataTypes.BorrowStatus.Active) {
            ICollateralManager(params.collateralManagerAddress).setBorrowAuctionCall(
                params.borrowId, 
                params.amount, 
                vars.liquidationFee,
                uint40(block.timestamp),
                params.initiator
            );
        } else {
            ICollateralManager(params.collateralManagerAddress).setBorrowAuctionBid(
                params.borrowId, 
                params.amount, 
                params.initiator
            );
        }
    }

    struct RedeemVars {
        bool success;
        uint256 borrowAmount;
        uint256 borrowBalanceAmount;
        uint256 interestRate;
        uint256 floorPrice;
        uint256 repaymentAmount;
        uint256 overpaymentAmount;
        uint256 liquidationThreshold;
        DataTypes.Borrow borrowItem;
    }

    function executeRedeem(
        mapping(address => string) storage assetNames,
        mapping(bytes32 => DataTypes.Reserve) storage reserves,
        DataTypes.ExecuteRedeemParams memory params
    ) 
        external
    {
        _redeem(assetNames, reserves, params);
    }

    function _redeem(
        mapping(address => string) storage assetNames,
        mapping(bytes32 => DataTypes.Reserve) storage reserves,
        DataTypes.ExecuteRedeemParams memory params
    )
        internal
    {
        RedeemVars memory vars;
        vars.borrowItem = ICollateralManager(
            params.collateralManagerAddress
        ).getBorrow(params.borrowId);
        DataTypes.Reserve storage reserve = reserves[keccak256(abi.encode(vars.borrowItem.collateral.erc721Token, vars.borrowItem.erc20Token))];  
        
        require(vars.borrowItem.erc20Token == params.asset, "INCORRECT_ASSET");
        require(vars.borrowItem.collateral.erc721Token == params.collateral, "INCORRECT_COLLATERAL");
        require(vars.borrowItem.status == DataTypes.BorrowStatus.ActiveAuction, "INACTIVE_AUCTION");

        vars.borrowBalanceAmount = vars.borrowItem.borrowAmount.rayMul(
            InterestLogic.calculateLinearInterest(vars.borrowItem.interestRate, vars.borrowItem.timestamp)
        );
        require(params.amount > vars.borrowItem.auction.liquidationFee, "INSUFFICIENT_AMOUNT"); 
        vars.repaymentAmount = params.amount - vars.borrowItem.auction.liquidationFee;
        require(vars.repaymentAmount <= vars.borrowBalanceAmount , "OVERPAYMENT"); 

        vars.floorPrice = INFTPriceConsumer(params.nftPriceConsumerAddress).getFloorPrice(vars.borrowItem.collateral.erc721Token);
        if (keccak256(abi.encodePacked(assetNames[params.asset])) != keccak256(abi.encodePacked("WETH"))) {
            vars.floorPrice = vars.floorPrice.mul(ITokenPriceConsumer(params.tokenPriceConsumerAddress).getEthPrice(params.asset));
        }
        vars.liquidationThreshold = vars.borrowItem.liquidationPrice.mul(100).div(vars.borrowItem.borrowAmount);
        require(vars.borrowBalanceAmount - vars.repaymentAmount < vars.floorPrice.mul(100).div(vars.liquidationThreshold), "INSUFFICIENT_AMOUNT");
        
        vars.success = IERC20(params.asset).transferFrom(params.initiator, reserve.fTokenAddress, vars.repaymentAmount);
        require(vars.success, "UNSUCCESSFUL_TRANSFER_TO_RESERVE");
        
        vars.success = IDebtToken(reserve.debtTokenAddress).burnFrom(vars.borrowItem.borrower, vars.repaymentAmount);
        require(vars.success, "UNSUCCESSFUL_BURN");
       
        vars.success = IERC20(params.asset).transferFrom(params.initiator, vars.borrowItem.auction.caller, vars.borrowItem.auction.liquidationFee);
        require(vars.success, "UNSUCCESSFUL_TRANSFER_TO_AUCTION_CALLER");

        if (params.amount < vars.borrowBalanceAmount + vars.borrowItem.auction.liquidationFee) {
            (vars.success, vars.borrowAmount, vars.interestRate) = ICollateralManager(params.collateralManagerAddress).updateBorrow(
                params.borrowId, 
                params.asset,
                vars.repaymentAmount,
                vars.floorPrice,
                DataTypes.BorrowStatus.Active,
                true, // isRepayment
                vars.borrowItem.borrower
            );
            require(vars.success, "UNSUCCESSFUL_PARTIAL_REDEEM");
        } else {
            (vars.success,,) = ICollateralManager(params.collateralManagerAddress).withdraw(
                params.borrowId, 
                params.asset, 
                vars.borrowBalanceAmount
            );
            require(vars.success, "UNSUCCESSFUL_WITHDRAW");
            (vars.success, vars.borrowAmount, vars.interestRate) = ICollateralManager(params.collateralManagerAddress).updateBorrow(
                params.borrowId, 
                params.asset,
                vars.repaymentAmount,
                vars.floorPrice,
                DataTypes.BorrowStatus.Repaid,
                true, // isRepayment
                vars.borrowItem.borrower
            );
            require(vars.success, "UNSUCCESSFUL_FULL_REDEEM");
        } 
    }
}