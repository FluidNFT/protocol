// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import { INToken } from './interfaces/INToken.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import "@openzeppelin/contracts/utils/Context.sol";

/// @title NToken Contract for the NFTlend protocol.
/// @author Niftrr
/// @notice Allows for the tracking of asset positions for purpose the yield accrual.
/// @dev NTokens follow the ERC20 standard in that they can be transferred and traded elsewhere.
contract NToken is Context, ERC20Pausable, INToken, AccessControl {
    bytes32 public constant CONFIGURATOR_ROLE = keccak256("CONFIGURATOR_ROLE");
    bytes32 public constant LENDING_POOL_ROLE = keccak256("LENDING_POOL_ROLE");

    uint256 currentAPY; 

    /// @notice Emitted when a reserve transfer is sent.
    /// @param from The sender account.
    /// @param to The recipient account.
    /// @param amount The amount of Asset tokens.
    event ReserveTransfer(address from, address to, uint256 amount);

    constructor(
        address configurator, 
        address lendingPool,
        string memory name, 
        string memory symbol
    ) 
        ERC20(name, symbol) 
    {
        _setupRole(CONFIGURATOR_ROLE, configurator);
        _setupRole(LENDING_POOL_ROLE, lendingPool);
    }

    modifier onlyConfigurator() {
        require(hasRole(CONFIGURATOR_ROLE, _msgSender()), "Caller is not the Configurator");
        _;
    }

    modifier onlyLendingPool() {
        require(hasRole(LENDING_POOL_ROLE, _msgSender()), "Caller is not the Lending Pool");
        _;
    }

    /// @notice Mints an amount of NTokens to a given account.
    /// @param to The account.
    /// @param amount The amount of NTokens.
    /// @dev Calls the underlying ERC20 `_mint` function.
    function mint(
        address to, 
        uint256 amount
    ) 
        public 
        virtual 
        override 
        onlyLendingPool 
        whenNotPaused 
    {
        _mint(to, amount);
    }

    /// @notice Burns an amount of NTokens from the _msgSender() account.
    /// @param amount The amount of NTokens.
    /// @dev Calls the underlying ERC20 `_burn` function.
    function burn(uint256 amount) public virtual override onlyLendingPool whenNotPaused {
        _burn(_msgSender(), amount);
    }

    /// @notice Burns an amount of NTokens from a given account.
    /// @param account The account.
    /// @param amount The amount of debt tokens.
    /// @dev Calls the underlying ERC20 `_burn` function.
    function burnFrom(
        address account, 
        uint256 amount
    ) 
        public 
        virtual 
        override 
        onlyLendingPool 
        whenNotPaused 
    {
        uint256 currentAllowance = allowance(account, _msgSender());
        require(currentAllowance >= amount, "ERC20: burn amount exceeds allowance");
        unchecked {
            _approve(account, _msgSender(), currentAllowance - amount);
        }
        _burn(account, amount);
    }

    /// @notice Transfer of Asset tokens from the reserve.
    /// @param to The recipient account.
    /// @param asset The Asset token.
    /// @param amount The amount of Asset tokens.
    /// @dev Asset tokens reclaimed from the NToken reserve.
    function reserveTransfer(
        address to, 
        address asset, 
        uint256 amount
    ) 
        external 
        virtual 
        override 
        onlyLendingPool 
        whenNotPaused
    {
        require(IERC20(asset).balanceOf(address(this)) >= amount, "Insufficient supply of asset token in reserve.");
        IERC20(asset).approve(to, amount);
        IERC20(asset).transfer(to, amount);
        emit ReserveTransfer(address(this), to, amount);
    }

    /// @notice Transfers Asset tokens to the reserve.
    /// @param from The sender account.
    /// @param asset The Asset token.
    /// @param amount The amount of Asset tokens.
    /// @dev Asset tokens deposited to the NToken reserve.
    function reserveTransferFrom(
        address from, 
        address asset, 
        uint256 amount
    ) 
        external 
        virtual 
        override 
        onlyLendingPool 
        whenNotPaused
    {
        require(IERC20(asset).balanceOf(from) >= amount, "Insufficient user asset token balance.");
        IERC20(asset).transferFrom(from, address(this), amount);
        emit ReserveTransfer(from, address(this), amount);
    }

    /// @notice Get the current yield; APY (WIP)
    /// @dev Functionality not yet implemented.
    function getCurrentAPY() public view returns (uint256) {
        return currentAPY;
    }

    /// @notice Pauses all contract functions.
    /// @dev Functions paused via Pausable contract modifier.
    function pause() external override onlyConfigurator {
        _pause();
    }

    /// @notice Unpauses all contract functions.
    /// @dev Functions unpaused via Pausable contract modifier.
    function unpause() external override onlyConfigurator{
        _unpause();
    }
}
