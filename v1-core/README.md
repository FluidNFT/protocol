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


## Foundry integration with Hardhat from scratch

Get Foundry for Linux/Mac

    curl -L https://foundry.paradigm.xyz | bash;


Get Foundry for Windows

   cargo install --git https://github.com/foundry-rs/foundry --bins --locked
    
To install Foundry run the following command:

    foundryup

Forge is a command-line tool that ships with Foundry. Forge tests, builds, and deploys your smart contracts. Install Forge Standard Library. 

    forge install foundry-rs/forge-std

    Now lets test Foundry

    forge build
    forge test

or if we want to test only one contract
    
        forge test --match-contract NFTPriceConsumer

If everything goes well you should get something like:

    [⠢] Compiling...
    [⠆] Compiling 3 files with 0.8.14
    [⠔] Compiling 8 files with 0.8.9
    [⠑] Solc 0.8.14 finished in 110.84ms
    [⠔] Solc 0.8.9 finished in 7.25s
    Compiler run successful (with warnings)
    ....
    Running 2 tests for test/NFTPriceConsumer.t.sol:NFTPriceConsumerTest
    [PASS] testGetFloorPrice() (gas: 159593)
    [PASS] testSetTrusted() (gas: 24697)
    Test result: ok. 2 passed; 0 failed; finished in 6.58ms





