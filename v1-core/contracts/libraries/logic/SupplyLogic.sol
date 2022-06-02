// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import { DataTypes } from "../types/DataTypes.sol";

import { IFToken } from "../../interfaces/IFToken.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { ReserveLogic } from "./ReserveLogic.sol";

import "hardhat/console.sol";

library SupplyLogic {
    using ReserveLogic for DataTypes.Reserve;

    /// @notice Emitted when a new reserve is initialized.
    /// @param collateral The reserve's underlying collateral contract address.
    /// @param asset The ERC20, reserve asset address.
    /// @param fTokenAddress The derivative fToken address.
    /// @param debtTokenAddress The derivative debtToken address.
    /// @param reserveFactor The reserve factor
    event InitReserve(address collateral, address asset, address fTokenAddress, address debtTokenAddress, uint256 reserveFactor);
    
    /// @notice Emitted when an asset deposit is made.
    /// @param initiator The address initiating the deposit. 
    /// @param collateral The Lending Pool underlying reserve collateral.
    /// @param asset The ERC20, reserve asset address.
    /// @param amount The amount of ERC20 tokens.
    /// @param onBehalfOf The address that will receive the fTokens, same as msg.sender if the user wants to receive them on their own wallet, different if the benefitiary is a different wallet.
    /// @param referalCode Code used to register the integrator originating the operation, for potential rewards. 0 if the action is executed directly by the user, without any middle-man
    event Deposit(
        address initiator,
        address collateral,
        address asset, 
        uint256 amount, 
        address onBehalfOf, 
        uint16 referalCode
    );

    /// @notice Emitted when an asset withdraw is made.
    /// @param initiator The address initiating the withdrawl / owner of fTokens.
    /// @param collateral The Lending Pool underlying reserve collateral.
    /// @param asset The ERC20, reserve asset address.
    /// @param amount The amount of ERC20 tokens.
    /// @param to The address that will receive the underlying
    event Withdraw(
        address initiator,
        address collateral,
        address asset, 
        uint256 amount, 
        address to
        );

    /// @notice Emitted when a bid is made against a defaulted borrow.
    /// @param asset The ERC20 address of the bid asset.
    /// @param amount The amount of ERC20 tokens bid.
    /// @param borrowId The unique identifier of the borrow.
    /// @param bidder The bidder account.
    event Bid(
        address asset, 
        uint256 amount, 
        uint256 borrowId, 
        address bidder
    );

    /// @notice Emitted when a borrow is activated.
    /// @param asset The ERC20 address of the borrowed asset.
    /// @param amount The amount of ERC20 tokens borrowed.
    /// @param collateral The ERC721 token used as collateral.
    /// @param tokenId The tokenId of the ERC721 token to be deposited in escrow.
    /// @param borrower The borrower account.
    /// @param liquidityIndex The updated liquidity index.
    event Borrow(
        address asset, 
        uint256 amount, 
        address collateral, 
        uint256 tokenId, 
        address borrower,
        uint256 liquidityIndex
    );

    /// @notice Emitted when a borrow position is redeemed.
    /// @param borrowId The unique identifier of the borrow.
    /// @param asset The ERC20 address of the borrowed asset.
    /// @param redeemAmount The amount of ERC20 tokens to be repaid.
    /// @param borrower The borrower account.
    event Redeem(
        uint256 borrowId, 
        address asset, 
        uint256 redeemAmount, 
        address borrower
    );

    /// @notice Emitted when a borrow is repaid.
    /// @param borrowId The unique identifier of the borrow.
    /// @param asset The ERC20 address of the borrowed asset.
    /// @param repaymentAmount The amount of ERC20 tokens to be repaid.
    /// @param borrower The borrower account.
    event Repay(
        uint256 borrowId, 
        address asset, 
        uint256 repaymentAmount, 
        address borrower
    );

    /// @notice Emitted when a borrow is liquidated.
    /// @param borrowId The unique identifier of the borrow.
    /// @param msgSender The msgSender account.
    event Liquidate(
        uint256 borrowId, 
        address msgSender
    );

    /// @notice Emitted when the asset reserve is updated.
    /// @param collateral The reserve collateral.
    /// @param asset The reserve asset.
    /// @param asset The reserve borrowRate.
    /// @param asset The reserve utilizationRate.
    /// @param asset The reserve liquidityIndex.
    event UpdateReserve(
        address collateral,
        address asset,
        uint256 borrowRate,
        uint256 utilizationRate,
        uint256 liquidityIndex
    );

    /// @notice Emitted when the reserve state is updated.
    /// @param collateral The reserve collateral.
    /// @param asset The reserve asset.
    /// @param status Status of the reserve.
    event ReserveStatus(
        address collateral,
        address asset,
        bytes32 status
    ); 

    /// @notice Emitted when LendingPool connects with a given contract.
    /// @param contractName The name of the contract to connect.
    /// @param contractAddress The address of the contract to connect.
    event LendingPoolConnected(
        bytes32 contractName,
        address contractAddress
    );

    function executeDeposit(
        mapping(address => mapping(address => DataTypes.Reserve)) storage reserves,
        DataTypes.ExecuteDepositParams memory params
    )  
        external
    {
        _deposit(
            reserves,
            params
        );
    }

    function executeBatchDeposit(
        mapping(address => mapping(address => DataTypes.Reserve)) storage reserves,
        DataTypes.ExecuteBatchDepositParams memory params
    )
        external 
    {
        require(params.collaterals.length == params.assets.length, "Inconsistent assets length");
        require(params.collaterals.length == params.amounts.length, "Inconsistent amounts length");
        require(params.collaterals.length == params.onBehalfOfs.length, "Inconsistent onBehalfOfs length");
        require(params.collaterals.length == params.referralCodes.length, "Inconsistent onBehalfOfs length");

        for (uint256 i = 0; i < params.collaterals.length; i++) {
            _deposit(
                reserves,
                DataTypes.ExecuteDepositParams({
                    initiator: params.initiator,
                    collateral: params.collaterals[i],
                    asset: params.assets[i],
                    amount: params.amounts[i],
                    onBehalfOf: params.onBehalfOfs[i],
                    referralCode: params.referralCodes[i]
                })
            );
        }
    }

    function _deposit(
        mapping(address => mapping(address => DataTypes.Reserve)) storage reserves,
        DataTypes.ExecuteDepositParams memory params
    )
        internal
    {
        require(params.onBehalfOf != address(0), "INVALID_ONBEHALFOF");

        DataTypes.Reserve storage reserve = reserves[params.collateral][params.asset];
        address fToken = reserve.fTokenAddress;
        require(fToken != address(0), "INVALID_RESERVE_INDEX");

        // TODO: ValidationLogic

        reserve.updateState();
        reserve.updateInterestRates(params.asset, fToken, params.amount, 0);

        IERC20(params.asset).transferFrom(params.initiator, fToken, params.amount);

        IFToken(fToken).mint(params.onBehalfOf, params.amount, reserve.liquidityIndex);

        emit Deposit(params.initiator, params.collateral, params.asset, params.amount, params.onBehalfOf, params.referralCode);
    }

    function executeWithdraw(
        mapping(address => mapping(address => DataTypes.Reserve)) storage reserves,
        DataTypes.ExecuteWithdrawParams memory params
    )  
        external
        returns (uint256)
    {
        require(params.to != address(0), "INVALID_TARGET_ADDRESS");

        DataTypes.Reserve storage reserve = reserves[params.collateral][params.asset];
        address fToken = reserve.fTokenAddress;
        require(fToken != address(0), "INVALID_RESERVE_INDEX");

        uint256 userBalance = IFToken(fToken).balanceOf(params.initiator);
        uint256 amountToWithdraw = params.amount;

        if (params.amount == type(uint256).max) {
            amountToWithdraw = userBalance;
        }

        // TODO: ValidationLogic
        //ValidationLogic.validateWithdraw(reserve, amountToWithdraw, userBalance);

        reserve.updateState();
        reserve.updateInterestRates(params.asset, fToken, 0, amountToWithdraw);
    
        IFToken(fToken).burn(params.initiator, params.to, amountToWithdraw, reserve.liquidityIndex);

        emit Withdraw(params.initiator, params.collateral, params.asset, amountToWithdraw, params.to);

        return amountToWithdraw;
    }
}