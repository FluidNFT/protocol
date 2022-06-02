// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

/**
* @title LendingPoolAddressesProvider contract
* @dev Main registry of addresses part of or connected to the protocol, including permissioned roles
* - Acting also as factory of proxies and admin of those, so with right to change its implementations
* - Owned by the FluidNFT Governance
* @author FluidNFT
**/
interface ILendingPoolAddressesProvider {
    event MarketIdSet(string newMarketId);
    event LendingPoolUpdated(address indexed newAddress);
    event ConfiguratorUpdated(address indexed newAddress);
    event CollateralManagerUpdated(address indexed newAddress);
    event ConfigurationAdminUpdated(address indexed newAddress);
    event EmergencyAdminUpdated(address indexed newAddress);
    event PriceOracleUpdated(address indexed newAddress);
    event NftPriceOracleUpdated(address indexed newAddress);
    event LendingRateOracleUpdated(address indexed newAddress);
    event IncentivesControllerUpdated(address indexed newAddress);
    event ProxyCreated(bytes32 id, address indexed newAddress);
    event AddressSet(bytes32 id, address indexed newAddress, bool hasProxy);

    function getMarketId() external view returns (string memory);

    function setMarketId(string calldata marketId) external;

    function setAddress(bytes32 id, address newAddress) external;

    function setAddressAsProxy(
        bytes32 id,
        address impl
    ) external;

    function getAddress(bytes32 id) external view returns (address);

    function getLendingPool() external view returns (address);

    function setLendingPool(address pool) external;

    function setLendingPoolImpl(address pool) external;

    function getConfigurator() external view returns (address);

    function setConfigurator(address configurator) external;

    function setConfiguratorImpl(address configurator) external;

    function getCollateralManager() external view returns (address);

    function setCollateralManager(address collateralManager) external;

    function setCollateralManagerImpl(address collateralManager) external;

    function getPoolAdmin() external view returns (address);

    function setPoolAdmin(address admin) external;

    function getEmergencyAdmin() external view returns (address);

    function setEmergencyAdmin(address admin) external;

    function getPriceOracle() external view returns (address);

    function setPriceOracle(address priceOracle) external;

    function getNftPriceOracle() external view returns (address);

    function setNftPriceOracle(address nftPriceOracle) external;

    function getLendingRateOracle() external view returns (address);

    function setLendingRateOracle(address lendingRateOracle) external;

    function getIncentivesController() external view returns (address);

    function setIncentivesController(address controller) external;
}
