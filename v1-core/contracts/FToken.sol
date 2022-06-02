// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {IIncentivesController} from "./interfaces/IIncentivesController.sol";
import {ILendingPoolAddressesProvider} from "./interfaces/ILendingPoolAddressesProvider.sol";
import { ILendingPool } from "./interfaces/ILendingPool.sol";
// import { IConfigurator } from "./interfaces/IConfigurator.sol";
import { IFToken } from "./interfaces/IFToken.sol";
import {IncentivizedERC20} from "./IncentivizedERC20.sol";
import {WadRayMath} from "./libraries/math/WadRayMath.sol";
import {Errors} from "./libraries/helpers/Errors.sol";

import "hardhat/console.sol";

/// @title FToken Contract for the FluidNFT protocol.
/// @author FluidNFT
/// @notice Allows for the tracking of asset positions for purpose the yield accrual.
/// @dev FTokens follow the ERC20 standard in that they can be transferred and traded elsewhere.
contract FToken is Initializable, IFToken, IncentivizedERC20 {
    using WadRayMath for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    ILendingPool internal _pool;
    ILendingPoolAddressesProvider internal _addressProvider;

    address internal _configurator;
    address internal _treasury;
    address internal _underlyingCollateral;
    address internal _underlyingAsset;

    modifier onlyConfigurator() {
        require(_msgSender() == _configurator, Errors.LP_CALLER_NOT_CONFIGURATOR);
        _;
    }

    modifier onlyLendingPool() {
        require(_msgSender() == address(_pool), Errors.CT_CALLER_MUST_BE_LENDING_POOL);
        _;
    }

    /**
    * @dev Initializes the fToken
    * @param addressProvider The address of the addressProvider
    * @param configurator The address of the configurator
    * @param lendingPool The address of the lendingPool
    * @param treasury The address of the FluidNFT treasury, receiving the fees on this fToken
    * @param underlyingCollateral The address of the underlying collateral of this fToken
    * @param underlyingAsset The address of the underlying asset of this fToken
    * @param fTokenDecimals The number of decimals for this fToken
    * @param fTokenName The name for this fToken
    * @param fTokenSymbol The symbol for this fToken
    */
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
    )
        external 
        override
        initializer 
    {
        __IncentivizedERC20_init(fTokenName, fTokenSymbol, fTokenDecimals);
        
        _addressProvider = ILendingPoolAddressesProvider(addressProvider);

        _pool = ILendingPool(lendingPool);

        _configurator = configurator;
        _treasury = treasury;
        _underlyingCollateral = underlyingCollateral;
        _underlyingAsset = underlyingAsset;

        emit Initialized(
            _underlyingCollateral,
            _underlyingAsset,
            _addressProvider.getLendingPool(),
            _treasury,
            _addressProvider.getIncentivesController()
        );
    }

    /**
    * @dev Burns fTokens from `user` and sends the equivalent amount of underlying to `receiverOfUnderlying`
    * - Only callable by the LendingPool, as extra state updates there need to be managed
    * @param user The owner of the fTokens, getting them burned
    * @param receiverOfUnderlying The address that will receive the underlying
    * @param amount The amount being burned
    * @param index The new liquidity index of the reserve
    **/
    function burn(
        address user,
        address receiverOfUnderlying,
        uint256 amount,
        uint256 index
    ) 
        external 
        override 
        onlyLendingPool 
    {
        uint256 amountScaled = amount.rayDiv(index);
        require(amountScaled != 0, Errors.CT_INVALID_BURN_AMOUNT);
        _burn(user, amountScaled);

        IERC20Upgradeable(_underlyingAsset).safeTransfer(receiverOfUnderlying, amount);

        emit Burn(user, receiverOfUnderlying, amount, index);
    }

    /**
    * @dev Mints `amount` fTokens to `user`
    * - Only callable by the LendingPool, as extra state updates there need to be managed
    * @param user The address receiving the minted tokens
    * @param amount The amount of tokens getting minted
    * @param index The new liquidity index of the reserve
    * @return `true` if the the previous balance of the user was 0
    */
    function mint(
        address user,
        uint256 amount,
        uint256 index
    ) 
        external 
        override 
        onlyLendingPool 
        returns (bool) 
    {
        uint256 previousBalance = super.balanceOf(user);

        uint256 amountScaled = amount.rayDiv(index);
        require(amountScaled != 0, Errors.CT_INVALID_MINT_AMOUNT);
        _mint(user, amountScaled);

        emit Mint(user, amount, index);

        return previousBalance == 0;
    }

    /**
    * @dev Mints fTokens to the reserve treasury
    * - Only callable by the LendingPool
    * @param amount The amount of tokens getting minted
    * @param index The new liquidity index of the reserve
    */
    function mintToTreasury(uint256 amount, uint256 index) external override onlyLendingPool {
        if (amount == 0) {
            return;
        }

        address treasury = _treasury;

        // Compared to the normal mint, we won't check for rounding errors.
        // The amount to mint can easily be very small since it is a fraction of the interest accrued.
        // In this case, the treasury will experience a (very small) loss, but this avoids causing
        // potentially valid transactions to fail.
        _mint(treasury, amount.rayDiv(index));

        emit Transfer(address(0), treasury, amount);
        emit Mint(treasury, amount, index);
    }

    /**
    * @dev Calculates the balance of the user: principal balance + interest generated by the principal
    * @param user The user whose balance is calculated
    * @return The balance of the user
    **/
    function balanceOf(address user) public view override returns (uint256) {
        return super.balanceOf(user).rayMul(_pool.getReserveNormalizedIncome(_underlyingCollateral, _underlyingAsset));
    }   


    /**
    * @dev Returns the scaled balance of the user. The scaled balance is the sum of all the
    * updated stored balance divided by the reserve's liquidity index at the moment of the update
    * @param user The user whose balance is calculated
    * @return The scaled balance of the user
    **/
    function scaledBalanceOf(address user) external view override returns (uint256) {
        return super.balanceOf(user);
    }

    /**
    * @dev Returns the scaled balance of the user and the scaled total supply.
    * @param user The address of the user
    * @return The scaled balance of the user
    * @return The scaled balance and the scaled total supply
    **/
    function getScaledUserBalanceAndSupply(address user) external view override returns (uint256, uint256) {
        return (super.balanceOf(user), super.totalSupply());
    }
    
    /**
    * @dev Calculates the total supply of the specific fToken
    * Since the balance of every single user increases over time, the total supply
    * does that too.
    * @return the current total supply
    **/
    function totalSupply() public view override returns (uint256) {
        uint256 currentSupplyScaled = super.totalSupply();

        if (currentSupplyScaled == 0) {
            return 0;
        }

        return currentSupplyScaled.rayMul(_pool.getReserveNormalizedIncome(_underlyingCollateral, _underlyingAsset));
    }

    /**
    * @dev Returns the scaled total supply of the variable debt token. Represents sum(debt/index)
    * @return the scaled total supply
    **/
    function scaledTotalSupply() public view virtual override returns (uint256) {
        return super.totalSupply();
    }

    /**
    * @dev Returns the address of the FluidNFT treasury, receiving the fees on this fToken
    **/
    function RESERVE_TREASURY_ADDRESS() public view returns (address) {
    return _treasury;
    }

    /**
    * @dev Returns the address of the underlyingCollateral of this fToken
    **/
    function UNDERLYING_COLLATERAL_ADDRESS() public view returns (address) {
    return _underlyingCollateral;
    }

    /**
    * @dev Returns the address of the underlyingAsset of this fToken
    **/
    function UNDERLYING_ASSET_ADDRESS() public view override returns (address) {
    return _underlyingAsset;
    }

    /**
    * @dev Returns the lending pool where this fToken is used
    **/
    function POOL() public view returns (ILendingPool) {
        return _pool;
    }

    /**
    * @dev For internal usage in the logic of the parent contract IncentivizedERC20
    **/
    function _getIncentivesController() internal view override returns (IIncentivesController) {
        return IIncentivesController(_addressProvider.getIncentivesController()); 
    }

    function _getUnderlyingCollateralAddress() internal view returns (address) {
        return _underlyingCollateral;
    }  

    function _getUnderlyingAssetAddress() internal view override returns (address) {
        return _underlyingAsset;
    }  

    /**
    * @dev Returns the address of the incentives controller contract
    **/
    function getIncentivesController() external view override returns (IIncentivesController) {
        return _getIncentivesController();
    }

    /**
    * @dev Transfers the underlying asset to `target`. Used by the LendingPool to transfer
    * assets in borrow(), withdraw() and flashLoan()
    * @param target The recipient of the fTokens
    * @param amount The amount getting transferred
    * @return The amount transferred
    **/
    function transferUnderlyingTo(address target, uint256 amount) 
        external 
        override 
        onlyLendingPool 
        returns (uint256) 
    {
        IERC20Upgradeable(_underlyingAsset).safeTransfer(target, amount);
        return amount;
    }

    function _getLendingPool() internal view returns (ILendingPool) {
        return ILendingPool(_addressProvider.getLendingPool());
    }

    // function _getConfigurator() internal view returns (IConfigurator) {
    //     return IConfigurator(_addressProvider.getConfigurator());
    // }

    /**
    * @dev Transfers the fTokens between two users. Validates the transfer
    * (ie checks for valid HF after the transfer) if required
    * @param from The source address
    * @param to The destination address
    * @param amount The amount getting transferred
    * @param validate `true` if the transfer needs to be validated
    **/
    function _transfer(
        address from,
        address to,
        uint256 amount,
        bool validate
    ) internal {
        uint256 index = _pool.getReserveNormalizedIncome(_underlyingCollateral, _underlyingAsset);

        uint256 fromBalanceBefore = super.balanceOf(from).rayMul(index);
        uint256 toBalanceBefore = super.balanceOf(to).rayMul(index);

        super._transfer(from, to, amount.rayDiv(index));

        if (validate) {
            _pool.finalizeTransfer(_underlyingCollateral, _underlyingAsset, from, to, amount, fromBalanceBefore, toBalanceBefore);
        }

        emit BalanceTransfer(from, to, amount, index);
    }

    /**
    * @dev Overrides the parent _transfer to force validated transfer() and transferFrom()
    * @param from The source address
    * @param to The destination address
    * @param amount The amount getting transferred
    **/
    function _transfer(address from, address to, uint256 amount) 
        internal 
        override 
    {
        _transfer(from, to, amount, true);
    }

}
