const { expect } = require('chai');
const { ethers } = require('hardhat');

let LendingPool;
let hhLendingPool;
let hhLendingPoolAddress;
let CollateralManager;
let hhCollateralManager;
let hhCollateralManagerAddress;
let TokenPriceConsumer;
let hhTokenPriceConsumer;
let hhTokenPriceConsumerAddress;
let AssetToken;
let hhAssetToken;
let hhAssetTokenSupply;
let FToken;
let hhFToken;
let DebtToken;
let hhDebtToken;
let admin;
let emergencyAdmin;
let alice;
let bob;
let alice_tokenId;
let bob_tokenId;
let liquidationThreshold = 150;
let interestRate = 20;
let reserveFactor = 30;  

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

beforeEach(async function() {
    numDecimals = 10; // set lower than 18 due to ether.js issue
    hhAssetTokenSupply = ethers.utils.parseUnits('10000000', 18); //3*10**numDecimals;
    hhAssetTokenInitialBalance = ethers.utils.parseUnits('1000000', 18);
    alice_tokenId = 0;
    bob_tokenId = 1;

    // Get Signers
    [admin, emergencyAdmin, alice, bob, treasury] = await ethers.getSigners();

    // Get and deploy Configurator
    Configurator = await ethers.getContractFactory('Configurator');
    hhConfigurator = await Configurator.deploy(
        emergencyAdmin.address,
        admin.address 
    );
    await hhConfigurator.deployed();
    hhConfiguratorAddress = await hhConfigurator.resolvedAddress;

    // Get and deploy OraceTokenPrice
    TokenPriceConsumer = await ethers.getContractFactory('TokenPriceConsumer');
    hhTokenPriceConsumer = await TokenPriceConsumer.deploy("0xAa7F6f7f507457a1EE157fE97F6c7DB2BEec5cD0");
    hhTokenPriceConsumerAddress = await hhTokenPriceConsumer.resolvedAddress;

    // Get and deploy SupplyLogic Library
    SupplyLogicLib = await ethers.getContractFactory('SupplyLogic');
    hhSupplyLogicLib = await SupplyLogicLib.deploy();
    await hhSupplyLogicLib.deployed();
    hhSupplyLogicLibAddress = await hhSupplyLogicLib.resolvedAddress;

    // Get and deploy BorrowLogic Library
    BorrowLogicLib = await ethers.getContractFactory('BorrowLogic');
    hhBorrowLogicLib = await BorrowLogicLib.deploy();
    await hhBorrowLogicLib.deployed();
    hhBorrowLogicLibAddress = await hhBorrowLogicLib.resolvedAddress;

    // Get and deploy LiquidateLogic Library
    LiquidateLogicLib = await ethers.getContractFactory('LiquidateLogic');
    hhLiquidateLogicLib = await LiquidateLogicLib.deploy();
    await hhLiquidateLogicLib.deployed();
    hhLiquidateLogicLibAddress = await hhLiquidateLogicLib.resolvedAddress;

    // Get and deploy ReserveLogic Library
    ReserveLogicLib = await ethers.getContractFactory('ReserveLogic');
    hhReserveLogicLib = await ReserveLogicLib.deploy();
    await hhReserveLogicLib.deployed();
    hhReserveLogicLibAddress = await hhReserveLogicLib.resolvedAddress;

    // Get and deploy LendingPool
    LendingPool = await ethers.getContractFactory('LendingPool', {
        libraries: {
            SupplyLogic: hhSupplyLogicLibAddress,
            BorrowLogic: hhBorrowLogicLibAddress,
            LiquidateLogic: hhLiquidateLogicLibAddress,
            ReserveLogic: hhReserveLogicLibAddress
        }
    });
    hhLendingPool = await LendingPool.deploy(
        hhConfiguratorAddress,
        treasury.address
    );
    await hhLendingPool.deployed();
    hhLendingPoolAddress = await hhLendingPool.resolvedAddress;

    // Connect Configurator to LendingPool by setting the address
    await hhConfigurator.connectLendingPool(hhLendingPoolAddress);

    // Get and deploy CollateralManager
    CollateralManager = await ethers.getContractFactory('CollateralManager');
    hhCollateralManager = await CollateralManager.deploy(
        hhConfiguratorAddress,
        hhLendingPoolAddress
        );
    await hhCollateralManager.deployed();
    hhCollateralManagerAddress = await hhCollateralManager.resolvedAddress;

    // Connect Configurator to CollateralManager
    await hhConfigurator
    .connect(admin)
    .connectCollateralManager(
        hhCollateralManagerAddress
    )

    // Link CollateralManager to LendingPool
    await hhConfigurator
    .connect(admin)
    .connectLendingPoolContract("CM");

    // Get and deploy Asset Token
    AssetToken = await ethers.getContractFactory('AssetToken');
    hhAssetToken = await AssetToken.deploy('Dai Token', 'DAI', hhAssetTokenSupply.toString());
    await hhAssetToken.deployed();
    
    // Get and deploy NFT
    NFT = await ethers.getContractFactory('NFT');
    hhNFT = await NFT.deploy('Punk NFT', 'PUNK');
    await hhNFT.deployed();

    // Whitelist NFT
    hhConfigurator
    .connect(admin)
    .updateCollateralManagerWhitelist(hhNFT.address, true);

    // Set NFT liquidation threshold
    hhConfigurator
    .connect(admin)
    .setCollateralManagerLiquidationThreshold(hhNFT.address, liquidationThreshold); // in percent

    // // Set NFT interestRate threshold
    // hhConfigurator
    // .connect(admin)
    // .setCollateralManagerInterestRate(hhNFT.address, hhAssetToken.address, ethers.utils.parseUnits(interestRate.toString(), 25)); // in RAY 1e27/100 for percentage

    // Get and deploy LendingPoolAddressesProvider
    LendingPoolAddressesProvider = await ethers.getContractFactory("LendingPoolAddressesProvider");
    hhLendingPoolAddressesProvider = await LendingPoolAddressesProvider.deploy("1"); // marketId
    await hhLendingPoolAddressesProvider.deployed();
    hhLendingPoolAddressesProviderAddress = await hhLendingPoolAddressesProvider.resolvedAddress;
    
    await hhLendingPoolAddressesProvider.setLendingPool(hhLendingPoolAddress);
    await hhLendingPoolAddressesProvider.setConfigurator(hhConfiguratorAddress);
    await hhLendingPoolAddressesProvider.setCollateralManager(hhCollateralManagerAddress);
    await hhLendingPoolAddressesProvider.setPoolAdmin(admin.address);
    await hhLendingPoolAddressesProvider.setEmergencyAdmin(emergencyAdmin.address);
    // TODO: add Oracles and anything else

    // Get and deploy fToken
    FToken = await ethers.getContractFactory('FToken');
    hhFToken = await upgrades.deployProxy(FToken, [
        hhLendingPoolAddressesProviderAddress, 
        hhConfiguratorAddress,
        hhLendingPoolAddress,
        treasury.address,
        hhNFT.address,
        hhAssetToken.address,
        18,
        "fToken ETH strategy A collateral BAYC",
        "fETHaBAYC"
    ]);
    await hhFToken.deployed();

    // Get and deploy debtToken
    DebtToken = await ethers.getContractFactory('DebtToken');
    hhDebtToken = await upgrades.deployProxy(DebtToken, [
        hhLendingPoolAddressesProviderAddress, 
        hhNFT.address,
        hhAssetToken.address,
        18,
        "debtToken ETH strategy A collateral BAYC",
        "debtETHaBAYC"
    ]);
    await hhDebtToken.deployed();

    // Get and deploy NFT Price Oracle
    NFTPriceConsumer = await ethers.getContractFactory('NFTPriceConsumer');
    hhNFTPriceConsumer = await NFTPriceConsumer.deploy(hhConfiguratorAddress, 5);
    await hhNFTPriceConsumer.deployed();
    hhNFTPriceConsumerAddress = await hhNFTPriceConsumer.resolvedAddress;
    await hhConfigurator.connectNFTPriceConsumer(hhNFTPriceConsumer.address);
    await hhConfigurator.connectLendingPoolContract("NFT_PRICE_ORACLE");

    // -- Assign minter role to LendingPool
    // await hhDebtToken.setMinter(hhLendingPoolAddress);

    // -- Assign burner role to LendingPool
    // await hhDebtToken.setBurner(hhLendingPoolAddress);

    // Transfer funds to alice and bob
    await hhAssetToken.transfer(alice.address, hhAssetTokenInitialBalance.toString());
    await hhAssetToken.transfer(bob.address, hhAssetTokenInitialBalance.toString());

    // Mint NFTs to alice and bob
    await hhNFT.mint(alice.address, alice_tokenId);
    await hhNFT.mint(bob.address, bob_tokenId);

    // Set/Mock NFT Price Oracle NFT price
    const mockFloorPrice = ethers.utils.parseUnits('100', 18);
    await hhConfigurator
        .connect(admin)
        .setNFTPriceConsumerFloorPrice(hhNFT.address, mockFloorPrice);  
        
    // Set Interest Rate Strategy
    const rateStrategyOne = {
        "name": "rateStrategyOne",
        "optimalUtilizationRate": ethers.utils.parseUnits('0.65', 27),
        "baseVariableBorrowRate": ethers.utils.parseUnits('0.03', 27),
        "variableRateSlope1": ethers.utils.parseUnits('0.08', 27),
        "variableRateSlope2": ethers.utils.parseUnits('1', 27),
    };
    InterestRateStrategy = await ethers.getContractFactory('InterestRateStrategy');
    hhInterestRateStrategy = await InterestRateStrategy.deploy(
        rateStrategyOne["optimalUtilizationRate"],
        rateStrategyOne["baseVariableBorrowRate"],
        rateStrategyOne["variableRateSlope1"],
        rateStrategyOne["variableRateSlope2"]
    );
    await hhInterestRateStrategy.deployed();
    hhInterestRateStrategyAddress = await hhInterestRateStrategy.resolvedAddress;

});

async function initReserve() {
    return hhConfigurator
    .connect(admin)
    .initLendingPoolReserve(
        hhNFT.address,
        hhAssetToken.address, 
        hhInterestRateStrategy.address,
        hhFToken.address,
        hhDebtToken.address,
        "WETH",
        ethers.utils.parseUnits(String(reserveFactor), 2), //30 x 10^2 = 3000 => 30% in percentageMaths
    )
}

async function deposit(initiator, poolCollateralAddress, assetToken, tokenAmount, onBehalfOf, referralCode) {
    // Approve transferFrom lendingPool 
    await assetToken.connect(initiator).approve(hhLendingPoolAddress, tokenAmount);
    // Deposit in hhFToken contract reserve
    return hhLendingPool.connect(initiator).deposit(poolCollateralAddress, assetToken.address, tokenAmount, onBehalfOf, referralCode); 
}

async function withdraw(signer, poolCollateralAddress, assetToken, fToken, _tokenAmount, to) {
    // Approve fToken burnFrom lendingPool 
    await fToken.connect(signer).approve(hhLendingPoolAddress, _tokenAmount);
    // Withdraw assetTokens by depositing/buring fTokens
    return hhLendingPool.connect(signer).withdraw(poolCollateralAddress, assetToken.address, _tokenAmount, to);
}

async function borrow(signer, nftToken, tokenId, assetToken, tokenAmount) {
    // Approve NFT transfer
    await nftToken.connect(signer).approve(hhCollateralManagerAddress, tokenId);
    return hhLendingPool.connect(signer).borrow(
        assetToken.address,
        tokenAmount,
        nftToken.address,
        tokenId);
}

async function repay(signer, assetToken, fToken, repaymentAmount, borrowId) {
    // Approve transfer of repaymentAmount asset tokens to fToken address (asset reserve)
    await assetToken.connect(signer).approve(fToken.address, repaymentAmount);
    return hhLendingPool.connect(signer).repay(
        assetToken.address,
        repaymentAmount,
        borrowId);
}

async function liquidate(signer, assetToken, liquidationAmount, borrowId) {
    // Approve transfer of liquidationAmount asset tokens to lendingPool address)
    await assetToken.connect(signer).approve(hhLendingPoolAddress, liquidationAmount);
    return hhLendingPool.connect(signer).liquidate(
        assetToken.address,
        liquidationAmount,
        borrowId);
}
    
describe('LendingPool >> Withdraw', function() {

    it('should withdraw tokens from the FToken reserve', async function () {
        const tokenAmount = ethers.utils.parseUnits('2', 18);
        const withdrawAmount = ethers.utils.parseUnits('1', 18);
        const initialLiquidityIndex = ethers.utils.parseUnits('1', 27);

        // Initialize reserve
        await initReserve();

        // Deposit asset tokens
        await deposit(alice, hhNFT.address, hhAssetToken, tokenAmount, alice.address, '123');

        // Withdraw Asset tokens
        async function _withdraw(signer, collateralAddress, assetToken, fToken, _tokenAmount, to) {
            return withdraw(signer, collateralAddress, assetToken, fToken, _tokenAmount, to);
        }

        // TODO: resolve libraries not emiting events
        const res = await _withdraw(alice, hhNFT.address, hhAssetToken, hhFToken, withdrawAmount, alice.address);
        // Event polling every 4 seconds
        // https://hardhat.org/plugins/nomiclabs-hardhat-ethers.html
        await sleep(5000);

        // Expect: Withdraw Emit response
        // expect(res)
        //     .to.emit(hhLendingPool, 'Withdraw')
        //     .withArgs(
        //         alice.address,
        //         hhNFT.address,
        //         hhAssetToken.address,
        //         withdrawAmount,
        //         alice.address);

    });

    it('should transfer assetTokens from hhFToken contract to alice', async function () {
        const tokenAmount = ethers.utils.parseUnits('2', 18);
        const withdrawAmount = ethers.utils.parseUnits('1', 18);

        // Initialize reserve
        await initReserve();

        // Deposit Asset tokens
        await deposit(alice, hhNFT.address, hhAssetToken, tokenAmount, alice.address, '123');

        // Withdraw asset tokens
        await withdraw(alice, hhNFT.address, hhAssetToken, hhFToken, withdrawAmount, alice.address);

        // Expect: assetTokens transfered from hhNToken contract to alice
        expect(
            (await hhAssetToken.balanceOf(alice.address)))
            .to.equal(hhAssetTokenInitialBalance.sub(tokenAmount.sub(withdrawAmount)));

        expect(
            (await hhAssetToken.balanceOf(hhFToken.address)))
            .to.equal(tokenAmount.sub(withdrawAmount));
    });

    it('should burn fTokens from alice', async function () {            
        const tokenAmount = ethers.utils.parseUnits('2', 18);
        const withdrawAmount = ethers.utils.parseUnits('1', 18);
    
        // Initialize reserve
        await initReserve();

        // Deposit Asset tokens
        await deposit(alice, hhNFT.address, hhAssetToken, tokenAmount, alice.address, '123');

        // Withdraw asset tokens
        await withdraw(alice, hhNFT.address, hhAssetToken, hhFToken, withdrawAmount, alice.address);

        // Expect: fTokens burnedFrom alice
        expect(
            (await hhFToken.balanceOf(alice.address)))
            .to.equal(tokenAmount.sub(withdrawAmount));
    });

    // it('should update liquidity index', async function () {            
    //     const tokenAmount = ethers.utils.parseUnits('3', 18);//1*10**numDecimals;
    //     const borrowAmount = ethers.utils.parseUnits('2', 18);
    //     const withdrawAmount = ethers.utils.parseUnits('1', 18);
    //     const updatedLiquidityIndex = "1000000021139861537018718872";

    //     // Initialize reserve
    //     await initReserve();

    //     // Deposit Asset tokens
    //     await deposit(alice, hhNFT.address, hhAssetToken, tokenAmount, alice.address, '123');

    //     // Borrow Asset tokens
    //     await borrow(bob, hhNFT, bob_tokenId, hhAssetToken, borrowAmount);

    //     // Expect updated liquidity Index
    //     await expect(
    //         withdraw(alice, hhNFT.address, hhAssetToken, hhFToken, withdrawAmount))
    //         .to.emit(hhLendingPool, 'Withdraw')
    //         .withArgs(
    //             hhNFT.address,
    //             hhAssetToken.address,
    //             withdrawAmount,
    //             alice.address,
    //             updatedLiquidityIndex);
    // });

    // it('should update scaledUserBalance and fToken Balance', async function() {
    //     const depositAmount = ethers.utils.parseUnits('3', 18);
    //     const withdrawAmount = ethers.utils.parseUnits('2', 18);
    //     const borrowAmount = ethers.utils.parseUnits('1', 18); 
    //     const updatedScaledBalance = "1000000008455944493";
    //     const updatedBalance = "1000000025367833801"; // updatedBalance > updatedScaledBalance

    //     // Initialize reserve
    //     await initReserve();

    //     // Deposit Asset tokens
    //     await deposit(alice, hhNFT.address, hhAssetToken, depositAmount)

    //     // Borrow Asset tokens
    //     await borrow(bob, hhNFT, bob_tokenId, hhAssetToken, borrowAmount)

    //     // Withdraw asset tokens
    //     await withdraw(alice, hhNFT.address, hhAssetToken, hhFToken, withdrawAmount);

    //     await expect(await hhFToken.scaledBalanceOf(alice.address)).to.equal(updatedScaledBalance);
    //     await expect(await hhFToken.balanceOf(alice.address)).to.equal(updatedBalance);
    // });
});
