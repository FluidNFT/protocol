// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import { ILendingPool } from "./interfaces/ILendingPool.sol";
import { ICollateralManager } from "./interfaces/ICollateralManager.sol";
import { IFToken } from "./interfaces/IFToken.sol";
import { IDebtToken } from "./interfaces/IDebtToken.sol";
import { INFTPriceConsumer } from "./interfaces/INFTPriceConsumer.sol";

import "hardhat/console.sol";

/// @title Configuration contract for the NFTlend protocol.
/// @author Niftrr
/// @notice Allows for configuration of the protocol.
/// @dev Emergency admin role is for non-BAU, security-critical updates.
contract Configurator is Context, AccessControl {
    bytes32 public constant EMERGENCY_ADMIN_ROLE = keccak256("EMERGENCY_ADMIN_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    address public collateralManagerAddress;
    address public lendingPoolAddress;
    address public nftPriceConsumerAddress;
    address public tokenPriceConsumerAddress;

    bytes32 private constant CM = keccak256("CM");
    bytes32 private constant NFT_PRICE_ORACLE = keccak256("NFT_PRICE_ORACLE");
    bytes32 private constant TOKEN_PRICE_ORACLE = keccak256("TOKEN_PRICE_ORACLE");

    bytes32 private constant ACTIVE = keccak256("ACTIVE");
    bytes32 private constant FROZEN = keccak256("FROZEN");
    bytes32 private constant PAUSED = keccak256("PAUSED");
    bytes32 private constant PROTECTED = keccak256("PROTECTED");

    constructor(address emergencyAdmin, address admin) {
        _setupRole(EMERGENCY_ADMIN_ROLE, emergencyAdmin);
        _setupRole(ADMIN_ROLE, admin);
    }

    modifier onlyEmergencyAdmin {
        require(hasRole(EMERGENCY_ADMIN_ROLE, _msgSender()), "EA1");
        _;
    }

    modifier onlyAdmin {
        require(hasRole(ADMIN_ROLE, _msgSender()), "CA1");
        _;
    }

    modifier whenLendingPoolConnected {
        require(lendingPoolAddress != address(0), "LP1");
        _;
    }

    modifier whenCollateralManagerConnected {
        require(collateralManagerAddress != address(0), "LP9");
        _;
    }

    /// @notice Connects the Lending Pool contract by setting the address.
    /// @param _lendingPoolAddress The lending pool contract address.
    /// @dev Sets the lendingPoolAddress variable.
    function connectLendingPool(address _lendingPoolAddress) public onlyAdmin {
        lendingPoolAddress = _lendingPoolAddress;
    }

    /// @notice Connects the NftPriceConsumer contract by setting the address.
    /// @param _nftPriceConsumerAddress The tokenPriceConsumerAddress contract address.
    /// @dev Sets the TokenPriceConsumerAddress variable.
    function connectNFTPriceConsumer(address _nftPriceConsumerAddress) public onlyAdmin {
        nftPriceConsumerAddress = _nftPriceConsumerAddress;
    }

    /// @notice Connects the TokenPriceConsumer contract by setting the address.
    /// @param _tokenPriceConsumerAddress The tokenPriceConsumerAddress contract address.
    /// @dev Sets the TokenPriceConsumerAddress variable.
    function connectTokenPriceConsumer(address _tokenPriceConsumerAddress) public onlyAdmin {
        tokenPriceConsumerAddress = _tokenPriceConsumerAddress;
    }

    /// @notice Gets the Lending Pool contract address.
    /// @dev Returns the value of the lendingPoolAddress variable.
    function getLendingPoolAddress() public view returns (address) {
        return lendingPoolAddress;
    }

    /// @notice Pauses all Lending Pool contract functions.
    /// @dev Functions paused via Pausable contract modifier.
    function pauseLendingPool() 
        public 
        onlyEmergencyAdmin
        whenLendingPoolConnected
    {
        ILendingPool(lendingPoolAddress).pause();
    }

    /// @notice Unpauses all Lending Pool contract functions.
    /// @dev Functions unpaused via Pausable contract modifier.
    function unpauseLendingPool()
        public 
        onlyEmergencyAdmin 
        whenLendingPoolConnected
    {
        ILendingPool(lendingPoolAddress).unpause();
    }

    /// @notice Initializes a Lending Pool reserve.
    /// @param collateral The NFT collateral contract address.
    /// @param asset The ERC20, reserve asset token.
    /// @param interestRateStrategy The interest rate strategy.
    /// @param fTokenAddress The derivative fToken address.
    /// @param debtTokenAddress The derivative debtToken address.
    /// @param assetName The name of the asset. E.g. WETH.
    /// @param reserveFactor The reserve factor.
    /// @dev External `initReserve` function calls `_initReserve` if modifiers are succeeded.    
    function initLendingPoolReserve(
        address collateral,
        address asset, 
        address interestRateStrategy,
        address fTokenAddress,
        address debtTokenAddress,
        string calldata assetName,
        uint256 reserveFactor
    )
        public
        onlyAdmin
        whenLendingPoolConnected 
    {
        ILendingPool(lendingPoolAddress).initReserve(
            collateral,
            asset, 
            interestRateStrategy,
            fTokenAddress, 
            debtTokenAddress,
            assetName,
            reserveFactor
        );
    }

    /// @notice Freezes the specified Lending Pool asset reserve
    /// @param collateral The reserve asset collateral token.
    /// @param asset The ERC20, reserve asset token.
    /// @dev To freeze Lending Pool deposit and borrow functions for a single reserve.
    function freezeLendingPoolReserve(
        address collateral,
        address asset
    ) 
        public 
        onlyEmergencyAdmin
        whenLendingPoolConnected
    {
        ILendingPool(lendingPoolAddress).updateReserve(collateral, asset, FROZEN);
    }

    /// @notice Pauses the specified Lending Pool asset reserve
    /// @param collateral The reserve asset collateral token.
    /// @param asset The ERC20, reserve asset token.
    /// @dev To pause Lending Pool functions for a single reserve instead of the whole contract.
    function pauseLendingPoolReserve(
        address collateral,
        address asset
    ) 
        public 
        onlyEmergencyAdmin 
        whenLendingPoolConnected
    {
        ILendingPool(lendingPoolAddress).updateReserve(collateral, asset, PAUSED);
    }

    /// @notice Protects the specified Lending Pool asset reserve
    /// @param collateral The reserve asset collateral token.
    /// @param asset The ERC20, reserve asset token.
    /// @dev Deactivates Lending Pool functions `liquidate`, `deposit` and `borrow`.
    function protectLendingPoolReserve(
        address collateral,
        address asset
    ) 
        public
        onlyEmergencyAdmin 
        whenLendingPoolConnected
    {
        ILendingPool(lendingPoolAddress).updateReserve(collateral, asset, PROTECTED);
    }

    /// @notice Activate the specified Lending Pool asset reserve
    /// @param collateral The reserve asset collateral token.
    /// @param asset The ERC20, reserve asset token.
    /// @dev To activate all functions for a single Lending Pool reserve.
    function activateLendingPoolReserve(
        address collateral,
        address asset
    ) 
        public 
        onlyEmergencyAdmin
        whenLendingPoolConnected 
    {
        ILendingPool(lendingPoolAddress).updateReserve(collateral, asset, ACTIVE);
    }

    // /// @notice Connects the Lending Pool to other contracts by setting the address.
    // /// @dev This can be set more than once to allow for future optimizations.
    function connectLendingPoolContract(
        string memory contractName
    )
        public
        onlyAdmin
        whenLendingPoolConnected
    {
        bytes32 CONTRACT = keccak256(abi.encodePacked(contractName));
        if (CONTRACT==CM) {
            require(collateralManagerAddress != address(0), "CLP8");
            ILendingPool(lendingPoolAddress).connectContract(
                CONTRACT,
                collateralManagerAddress
            );
        } else if (CONTRACT==NFT_PRICE_ORACLE) {
            require(nftPriceConsumerAddress != address(0), "CLP9");
            ILendingPool(lendingPoolAddress).connectContract(
                CONTRACT,
                nftPriceConsumerAddress
            );
        } else if (CONTRACT==TOKEN_PRICE_ORACLE) {
            require(tokenPriceConsumerAddress != address(0), "CLP10");
            ILendingPool(lendingPoolAddress).connectContract(
                CONTRACT,
                tokenPriceConsumerAddress
            );
        } 
    }

    function updateLendingPoolInterestFee(uint256 interestFee) 
        public
        onlyAdmin
    {
        require(lendingPoolAddress != address(0), "CLP1");
        ILendingPool(lendingPoolAddress).updateInterestFee(interestFee);
    }

    function updateLendingPoolLiquidationFee(uint256 liquidationFee) 
        public
        onlyAdmin
    {
        require(lendingPoolAddress != address(0), "CLP1");
        ILendingPool(lendingPoolAddress).updateLiquidationFee(liquidationFee);
    }

    function updateLendingPoolLiquidationFeeProtocolPercentage(uint256 protocolPercentage) 
        public
        onlyAdmin
    {
        require(lendingPoolAddress != address(0), "CLP1");
        ILendingPool(lendingPoolAddress).updateLiquidationFeeProtocolPercentage(protocolPercentage);
    }

    function setLendingPoolAuctionDuration(uint40 duration) 
        public
        onlyAdmin
    {
        require(lendingPoolAddress != address(0), "CLP1");
        ILendingPool(lendingPoolAddress).setAuctionDuration(duration);
    }

    /// @notice Connects the Collateral Manager contract by setting the address.
    /// @param _collateralManagerAddress The collateral manager contract address.
    /// @dev Sets the collateralManager variable.
    function connectCollateralManager(address _collateralManagerAddress) public onlyAdmin {
        collateralManagerAddress = _collateralManagerAddress;
    }

    function setNFTPriceConsumerFloorPrice(address nftProject, uint256 floorPrice) public onlyAdmin {
        INFTPriceConsumer(nftPriceConsumerAddress).setFloorPrice(
            nftProject,
            floorPrice
        );
    }

    // function setCollateralManagerInterestRate(
    //     address collateral,
    //     address asset,
    //     uint256 interestRate
    // )
    //     public
    //     onlyAdmin
    //     whenCollateralManagerConnected
    // {
    //     ICollateralManager(collateralManagerAddress).setInterestRate(
    //         collateral,
    //         asset,
    //         interestRate  
    //     );
    // }

    function setCollateralManagerLiquidationThreshold(
        address _erc721Token,
        uint256 _threshold
    ) 
        public
        onlyAdmin
        whenCollateralManagerConnected
    {
        ICollateralManager(collateralManagerAddress).setLiquidationThreshold(
            _erc721Token, 
            _threshold);
    }

    function updateCollateralManagerWhitelist(
        address erc721Token,
        bool isWhitelisted
    ) 
        public
        onlyAdmin
        whenCollateralManagerConnected
    {
        ICollateralManager(collateralManagerAddress).updateWhitelist(
            erc721Token,
            isWhitelisted
        );
    }

    function pauseCollateralManager() 
        public 
        onlyEmergencyAdmin
        whenCollateralManagerConnected
    {
        ICollateralManager(collateralManagerAddress).pause();
    }

    function unpauseCollateralManager() 
        public 
        onlyEmergencyAdmin
        whenCollateralManagerConnected
    {
        ICollateralManager(collateralManagerAddress).unpause();
    }

}