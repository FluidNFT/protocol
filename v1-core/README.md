# NFTlend V1-Core

Protocol code for NFTlend.

## Local development

The following assumes the use of node `@>=14`.
### Install dependencies

```shell
npm install
```

### Compile

```shell
npx hardhat compile
```

### Test

```shell
npx hardhat test
```

### Deploy

Run local Harhdat node:
```shell
npx hardhat node --network hardhat
```

In a different shell window run the deploy script:
```shell
npx hardhat run --network localhost scripts/deployFork.js
```

## Licensing

The primary license for NFTlend V1 Core is the Business Source License 1.1 (`AGPL-3.0`), see [`LICENSE`](./LICENSE)


## Foundry integration with Hardhat

Get Foundry for Linux/Mac

    curl -L https://foundry.paradigm.xyz | bash;


Get Foundry for Windows

   cargo install --git https://github.com/foundry-rs/foundry --bins --locked
    
To install Foundry run the following command:

    foundryup


Create foundry.toml file in the root of the project and pass following:

    [default]
    contracts = 'contracts'
    test = 'test'
    out = 'artifacts/contracts'
    lib = ['lib']
    # See more config options https://github.com/foundry-rs/foundry/tree/master/config

Forge is a command-line tool that ships with Foundry. Forge tests, builds, and deploys your smart contracts. Install Forge Standard Library. 

    forge install foundry-rs/forge-std

Scripts in ./scripts folder should be annotated as following MyContract.s.sol:

    // SPDX-License-Identifier: UNLICENSED
    pragma solidity ^0.8.13;

    import "forge-std/Script.sol";

    contract ContractScript is Script {
        function setUp() public {}

        function run() public {
            vm.broadcast();
        }
    }

And then last for testing purpose in ./test folder create MyContract.t.sol. We can then import forge standard library into our test file which will be the same name as our contract plus .t.sol suffix. i.e. MyContract.t.sol

    // SPDX-License-Identifier: UNLICENSED
    pragma solidity ^0.8.13;

    import "forge-std/Test.sol";

    contract ContractTest is Test {
        function setUp() public {}

        function testExample() public {
            assertTrue(true);
        }
    }

Now lets test Foundry

    forge build
    forge test

or if we want to test only one contract
    
        forge test --match-contract ComplicatedContractTest

If everything goes well you should get something like:

    [⠢] Compiling...
    [⠆] Compiling 3 files with 0.8.14
    [⠔] Compiling 8 files with 0.8.9
    [⠑] Solc 0.8.14 finished in 110.84ms
    [⠔] Solc 0.8.9 finished in 7.25s
    Compiler run successful (with warnings)
    ....
    Running 1 test for test/Contract.t.sol:ContractTest
    [PASS] testExample() (gas: 279)
    Test result: ok. 1 passed; 0 failed; finished in 6.53ms





