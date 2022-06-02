// // SPDX-License-Identifier: AGPL-3.0
// pragma solidity ^0.8.0;

// import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

// interface IFTokenOld is IERC20 {
//     function mint(address account, uint256 amount, uint256 liquidityIndex) external returns (bool);

//     function burn(
//         address initiator, 
//         address receiverOfUnderlying,
//         uint256 amount, 
//         uint256 liquidityIndex
//     ) external;

//     // function burnFrom(address account, uint256 amount, uint256 liquidityIndex) external returns (bool);

//     function reserveTransfer(address to, uint256 amount) external returns (uint256);

//     function reserveTransferFrom(address from, uint256 amount) external returns (bool);

//     // function transferBalance(address from, address to, uint256 amount) external returns (bool);

//     function transferBalance(address from, address to, uint256 amount) external;

//     function pause() external;

//     function unpause() external;
// }