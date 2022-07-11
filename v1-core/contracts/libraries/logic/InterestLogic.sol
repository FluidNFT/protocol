// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import { SafeMath } from '@openzeppelin/contracts/utils/math/SafeMath.sol';
import "../math/WadRayMath.sol";


import "hardhat/console.sol";

library InterestLogic {
    using SafeMath for uint256;
    using WadRayMath for uint256;

    /// @dev Ignoring leap years
    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    ///@dev Function to calculate the interest accumulated using a linear interest rate formula
    ///@param rate The interest rate, in ray
    ///@param lastUpdateTimestamp The timestamp of the last update of the interest
    ///@return The interest rate linearly accumulated during the timeDelta, in ray
    function calculateLinearInterest(uint256 rate, uint40 lastUpdateTimestamp)
        internal
        view
        returns (uint256)
    {
        //solium-disable-next-line
        uint256 timeDifference = block.timestamp.sub(uint256(lastUpdateTimestamp));
        return (rate.mul(timeDifference) / SECONDS_PER_YEAR).add(WadRayMath.ray());
    }

   ///@dev Function to calculate the interest using a compounded interest rate formula
   ///To avoid expensive exponentiation, the calculation is performed using a binomial approximation:
   ///
   /// (1+x)^n = 1+n*x+[n/2*(n-1)]*x^2+[n/6*(n-1)*(n-2)*x^3...
   ///
   ///The approximation slightly underpays liquidity providers and undercharges borrowers, with the advantage of great gas cost reductions
   ///
   ///@param rate The interest rate, in ray
   ///@param lastUpdateTimestamp The timestamp of the last update of the interest
   ///@return The interest rate compounded during the timeDelta, in ray
    function _calculateCompoundedInterest(
        uint256 rate,
        uint40 lastUpdateTimestamp,
        uint256 currentTimestamp
    ) 
        internal 
        pure 
        returns (uint256) 
    {
        //solium-disable-next-line
        uint256 exp = currentTimestamp.sub(uint256(lastUpdateTimestamp));

        if (exp == 0) {
        return WadRayMath.ray();
        }

        uint256 expMinusOne = exp - 1;

        uint256 expMinusTwo = exp > 2 ? exp - 2 : 0;

        uint256 ratePerSecond = rate / SECONDS_PER_YEAR;

        uint256 basePowerTwo = ratePerSecond.rayMul(ratePerSecond);
        uint256 basePowerThree = basePowerTwo.rayMul(ratePerSecond);

        uint256 secondTerm = exp.mul(expMinusOne).mul(basePowerTwo) / 2;
        uint256 thirdTerm = exp.mul(expMinusOne).mul(expMinusTwo).mul(basePowerThree) / 6;

        return WadRayMath.ray().add(ratePerSecond.mul(exp)).add(secondTerm).add(thirdTerm);
    }

    ///@dev Calculates the compounded interest between the timestamp of the last update and the current block timestamp
    ///@param rate The interest rate (in ray)
    ///@param lastUpdateTimestamp The timestamp from which the interest accumulation needs to be calculated
    function calculateCompoundedInterest(uint256 rate, uint40 lastUpdateTimestamp)
        internal
        view
        returns (uint256)
    {
        return _calculateCompoundedInterest(rate, lastUpdateTimestamp, block.timestamp);
    }
}