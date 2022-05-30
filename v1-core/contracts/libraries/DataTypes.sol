// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.9;

library DataTypes {

    enum ReserveStatus {
        Active, // Able to perform all reserve operations.
        Frozen, // Only able to `withdraw`, `repay` and `liquidate`. Not `borrow` or `deposit`
        Paused, // Not able to perform any reserve operation.
        Protected // Only able to `withdraw` and `repay`. Not `borrow`, `deposit` or `liquidate`.
    }

    enum BorrowStatus { 
        Active, // Open
        ActiveAuction, // Open with open auction
        Repaid, // Closed, paid by borrower
        Liquidated // Closed, paid by liquidator
    }
    
    struct Reserve {
        ReserveStatus status;
        address fTokenAddress;
        address debtTokenAddress;
        uint256 liquidityIndex;
        uint256 interestRate;
        uint256 borrowAmount;
        uint256 borrowRate;
        uint256 normalizedIncome;
        uint256 latestUpdateTimestamp;
    }

    struct Collateral {
        address erc721Token;
        uint256 tokenId;
    }

    struct Auction {
        address caller;
        address bidder;
        uint256 bid;
        uint256 liquidationFee;
        uint40 timestamp;
    }

    struct Borrow {
        BorrowStatus status;
        Collateral collateral;
        Auction auction;
        address borrower;
        address erc20Token;
        uint256 borrowAmount;
        uint256 interestRate;
        uint256 liquidationPrice;
        uint40 timestamp;
    }

    struct ExecuteDepositParams {
        address initiator;
        address collateral;
        address asset;
        uint256 amount;
        address onBehalfOf;
        uint16 referralCode;
    }

    struct ExecuteWithdrawParams {
        address initiator;
        address collateral;
        address asset;
        uint256 amount;
        address to;
    }

    struct ExecuteBorrowParams {
        address initiator;
        address asset;
        uint256 amount;
        address collateral;
        uint256 tokenId;
        address onBehalfOf;
        uint16 referralCode;
        address tokenPriceConsumerAddress;
        address nftPriceConsumerAddress;
        address collateralManagerAddress;
    }

    struct ExecuteBatchBorrowParams {
        address initiator;
        address[] assets;
        uint256[] amounts;
        address[] collaterals;
        uint256[] tokenIds;
        address onBehalfOf;
        uint16 referralCode;
        address tokenPriceConsumerAddress;
        address nftPriceConsumerAddress;
        address collateralManagerAddress;
    }

    struct ExecuteRepayParams {
        address initiator;
        address collateral;
        address asset;
        uint256 amount;
        uint256 borrowId;
        address tokenPriceConsumerAddress;
        address nftPriceConsumerAddress;
        address collateralManagerAddress;
    }

    struct ExecuteLiquidateParams {
        address initiator;
        address collateral;
        address asset;
        uint256 borrowId;
        address tokenPriceConsumerAddress;
        address nftPriceConsumerAddress;
        address collateralManagerAddress;
        address treasuryAddress;
        uint40 auctionDuration;
    }

    struct ExecuteBidParams {
        address initiator;
        address asset;
        uint256 amount;
        uint256 borrowId;
        address tokenPriceConsumerAddress;
        address nftPriceConsumerAddress;
        address collateralManagerAddress;
        uint256 liquidationFee;
    }

    struct ExecuteRedeemParams {
        address initiator;
        address collateral;
        address asset;
        uint256 amount;
        uint256 borrowId;
        address tokenPriceConsumerAddress;
        address nftPriceConsumerAddress;
        address collateralManagerAddress;
    }
}