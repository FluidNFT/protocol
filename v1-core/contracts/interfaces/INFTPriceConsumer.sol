// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.0;

interface INFTPriceConsumer {
    function getFloorPrice(address collateral) external returns (uint256);

    function setFloorPrice(address _nftProject, uint256 _floorPrice) external;
}