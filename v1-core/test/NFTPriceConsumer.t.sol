//SPDX-License-Modifier: MIT

pragma solidity 0.8.9;

import "forge-std/Test.sol";
import "../contracts/NFTPriceConsumer.sol";

contract NFTPriceConsumerTest is Test, NFTPriceConsumer(10) {

    address payloadSender;
    bytes32 request;
    address nftProject;
    uint8 v;
    bytes32 r;
    bytes32 s;
    uint256 deadline;
    uint256 payload; 
  

    function _computeDomainSeparator() internal view virtual override returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    keccak256(
                        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                    ),
                    keccak256("Trustus"),
                    keccak256("1"),
                    // block.chainId,
                    // nftProject
                    42,
                    0xC66cd21E45265e4A7bbd2B66a02bfaa3247f20F5
                )
            );
    } 
    
    function setUp() public {  
            nftProject = 0xC66cd21E45265e4A7bbd2B66a02bfaa3247f20F5;
            payloadSender = 0x273f4FCa831A7e154f8f979e1B06F4491Eb508B6;                    
            v = 27;
            r =0xe8346ffec7eaa96299b48dbed89bfe407b24b87533f4881189f6763c88696e00;
            s =0x4cc6aa30046318b9a9de3b060ae6afc66f0d012cb22f4b6a2514ed1287566cf1;      
            request = 0x0000000000000000000000000000000000000000000000000000000000000001;      
            deadline=1657818852;
            payload=1027;          
    }   
 

    function testSetTrusted() public {
        bool success = setTrusted (payloadSender, true);
        assertTrue(success);
    }
    
    function testGetFloorPrice() public {               
        setTrusted(payloadSender, true);
        setFloorPrice(request, nftProject, TrustusPacket(v, r, s, request, deadline, payload));
        uint256 floorPrice = getFloorPrice(nftProject);
        assert(floorPrice > 0);
    }

}
