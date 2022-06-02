// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

/**
 * @title IInterestRateStrategy interface
 * @dev Interface for the calculation of the interest rates
 * @author FluidNFT
 */
interface IInterestRateStrategy {
  function variableRateSlope1() external view returns (uint256);

  function variableRateSlope2() external view returns (uint256);
  
  function baseVariableBorrowRate() external view returns (uint256);

  function getMaxVariableBorrowRate() external view returns (uint256);

  function calculateInterestRate(
    address asset,
    uint256 availableLiquidity,
    uint256 totalVariableDebt,
    uint256 reserveFactor
  ) external view returns (uint256, uint256);

  function calculateInterestRates(
    address asset,
    address fToken,
    uint256 liquidityAdded,
    uint256 liquidityTaken,
    uint256 totalVariableDebt,
    uint256 reserveFactor
  ) external view returns (uint256 liquidityRate, uint256 variableBorrowRate);
}
