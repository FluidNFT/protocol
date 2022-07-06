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


## Foundry integration within Hardhat

Get Foundry for Linux/Mac

    curl -L https://foundry.paradigm.xyz | bash;
    
To install Foundry run the following command:

    foundryup

Get Foundry for Windows

   cargo install --git https://github.com/foundry-rs/foundry --bins --locked

Docker

    docker pull ghcr.io/foundry-rs/foundry:latest

Creating new Foundry repo 

    forge init myrepo

TODO or simply add different files to existing Hardhat folders in following order

Test Foundry

    forge build
    forge test

If everything goes well you should get something like:

    protocol/v1-core git:(dev1_foundry_integration*)forge build
    [⠊] Compiling...
    No files changed, compilation skipped
    protocol/v1-core git:(dev1_foundry_integration*)forge test 
    [⠊] Compiling...
    No files changed, compilation skipped

## Foundry with Hardhat setup

cd into newly create repo and in Foundry settings file foundry.toml following lines 

    [default]
    src = 'contracts'
    test = 'test'
    out = 'artifacts/contracts'
    libs = ['lib']

Install Forge Standard Library

    forge install foundry-rs/forge-std

