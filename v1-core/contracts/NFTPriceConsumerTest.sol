// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/AccessControl.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./TrustusTest.sol";

contract NFTPriceConsumerTest is TrustusTest, AccessControl {
    using SafeMath for uint256;
    
    // We should exclude this modifier as verifyPacket is now solving problem
    // bytes32 internal constant CONFIGURATOR_ROLE = keccak256("CONFIGURATOR_ROLE");

    mapping(address => mapping(uint256 => uint256)) floorPrices;
    mapping(address => uint256) floorPrice;
    mapping(address => uint256) lastIndex;
    mapping(address => bool) initiated;
    bool updatedWindow = false;
    uint256 window = 10;

    event FloorPrice(address nftProject, uint256 floorPrice);

    constructor(
        // We should exlude this var because verifyPacket is now solving problem
        // address configurator, 
        uint256 _window
        ) 
    {
        // This as well should be excluded because verifyPacket is now solving problem of access control
        // _setupRole(CONFIGURATOR_ROLE, configurator);
        window = _window;
    }

    // We should exclude this modifier as verifyPacket is now solving problem
    // modifier onlyConfigurator() {
    //     require(hasRole(CONFIGURATOR_ROLE, _msgSender()), "NPO1");
    //     _;
    // }

    // I add this function to original NFTPriceConsumer contract based on designe of Trustus contract    
    function setTrusted(address _signer, bool _isTrusted) public returns (bool){
        _setIsTrusted (_signer, _isTrusted);
        return true;
    }

    // I erase onlyConfigurator modifier from original NFTPriceConsumer contract based on Trustus
    function setFloorPrice(bytes32 _request, address _nftProject, TrustusPacket calldata _packet) public verifyPacket(_request, _packet) {
        if (lastIndex[_nftProject] < window) {
            floorPrices[_nftProject][lastIndex[_nftProject]] = _packet.payload;
        } else {
            initiated[_nftProject] = true;
            lastIndex[_nftProject] = 0;
            floorPrices[_nftProject][lastIndex[_nftProject]] = _packet.payload;
        }
        lastIndex[_nftProject] += 1;

        uint256 sum;
        
        for (uint256 i = 0; i < window; i++) {
            sum += floorPrices[_nftProject][i];
        }

        if (initiated[_nftProject]) {
            floorPrice[_nftProject] = sum.div(window);
        } else {
            floorPrice[_nftProject] = sum.div(lastIndex[_nftProject]);
        }        
    }

    function getFloorPrice(address _nftProject) public view returns (uint256) {
        return floorPrice[_nftProject];
    }
}