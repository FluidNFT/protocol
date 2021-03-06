const { expect, util } = require('chai');
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

async function withdraw(signer, poolCollateralAddress, assetToken, fToken, _tokenAmount) {
    // Approve fToken burnFrom lendingPool 
    await fToken.connect(signer).approve(hhLendingPoolAddress, _tokenAmount);
    // Withdraw assetTokens by depositing/buring fTokens
    return hhLendingPool.connect(signer).withdraw(poolCollateralAddress, assetToken.address, _tokenAmount);
}

async function borrow(signer, nftToken, tokenId, assetToken, tokenAmount, onBehalfOf, referralCode, isCreate=true) {
    // Approve NFT transfer
    if (isCreate) {
        await nftToken.connect(signer).approve(hhCollateralManagerAddress, tokenId);
    }    
    return hhLendingPool.connect(signer).borrow(
        assetToken.address,
        tokenAmount,
        nftToken.address,
        tokenId,
        onBehalfOf,
        referralCode);
}

async function repay(signer, collateralAddress, assetToken, fToken, repaymentAmount, borrowId) {
    // Approve transfer of repaymentAmount asset tokens to fToken address (asset reserve)
    await assetToken.connect(signer).approve(hhLendingPool.address, repaymentAmount);
    return hhLendingPool.connect(signer).repay(
        collateralAddress,
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

describe('LendingPool >> Repay', function() {

    it('should retrieve an NFT by repaying a borrow', async function () {
        const depositAmount = ethers.utils.parseUnits('2', 18); 
        const borrowAmount = ethers.utils.parseUnits('1', 18);
        const repaymentAmount = ethers.utils.parseUnits('1.0001',18); // Overpayment to account for accrued interest         
        const paidAmount = ethers.utils.parseUnits('1.000000012683916794', 18);
        const interestRate = 20;

        // Initialize reserve
        await initReserve();

        // Deposit Asset tokens [required for liquidity]
        await deposit(alice, hhNFT.address, hhAssetToken, depositAmount, alice.address, '123');
        
        // Borrow Asset tokens
        await borrow(bob, hhNFT, bob_tokenId, hhAssetToken, borrowAmount, bob.address, '123');

        // Retrieve borrowId 
        borrowIds = await hhCollateralManager.getUserBorrowIds(bob.address);
        borrowId = borrowIds[0];

        // Repay Asset tokens
        async function _repay(signer, collateralAddress, assetToken, fToken, repaymentAmount, borrowId, fullRepayment) {
            return repay(signer, collateralAddress, assetToken, fToken, repaymentAmount, borrowId, fullRepayment);
        }

        // Expect: Repay Emit response
        res = await _repay(bob, hhNFT.address, hhAssetToken, hhFToken, repaymentAmount, borrowId);
        // TODO: resolve non-emitting libraries
        // expect(res)
        //     .to.emit(hhLendingPool, 'Repay')
        //     .withArgs(
        //         borrowId,
        //         hhAssetToken.address,
        //         paidAmount,
        //         bob.address);  

        // Expect: corresponding debtTokens to have been burned
        expect(
            (await hhDebtToken.balanceOf(bob.address)))
            .to.equal(0);

        // Expect: NFT transferred from Escrow back to user
        expect(
            (await hhNFT.ownerOf(bob_tokenId)))
            .to.equal(bob.address);    
    });

    it('should not retrieve an NFT by partially repaying a borrow', async function () {
        const depositAmount = ethers.utils.parseUnits('2', 18); 
        const borrowAmount = ethers.utils.parseUnits('1', 18);
        const repaymentAmount = ethers.utils.parseUnits('0.5', 18);           
        const interestRate = 20;

        // Initialize reserve
        await initReserve();

        // Deposit Asset tokens [required for liquidity]
        await deposit(alice, hhNFT.address, hhAssetToken, depositAmount, alice.address, '123');
        
        // Borrow Asset tokens
        await borrow(bob, hhNFT, bob_tokenId, hhAssetToken, borrowAmount, bob.address, '123');

        // Expect: debtTokens to have been minted
        expect(
            (await hhDebtToken.balanceOf(bob.address)))
            .to.equal(ethers.utils.parseUnits('1', 18)); 
        
        // Retrieve borrowId 
        borrowIds = await hhCollateralManager.getUserBorrowIds(bob.address);
        borrowId = borrowIds[0];

        // Repay Asset tokens
        async function _repay(signer, collateralAddress, assetToken, fToken, repaymentAmount, borrowId) {
            return repay(signer, collateralAddress, assetToken, fToken, repaymentAmount, borrowId);
        }

        // Expect: Repay Emit response
        res = await _repay(bob, hhNFT.address, hhAssetToken, hhFToken, repaymentAmount, borrowId);
        // TODO: resolve library event emit
        // expect(res)
        //     .to.emit(hhLendingPool, 'Repay')
        //     .withArgs(
        //         borrowId,
        //         hhAssetToken.address,
        //         repaymentAmount,
        //         bob.address);  

        // Expect: assetTokens transferred from user to fToken reserve
        expect(
            (await hhAssetToken.balanceOf(bob.address)))
            .to.equal(hhAssetTokenInitialBalance.add(borrowAmount).sub(repaymentAmount));
        expect(
            (await hhAssetToken.balanceOf(hhFToken.address)))
            .to.equal(depositAmount.sub(borrowAmount).add(repaymentAmount)); // Alice's deposit - Bob's borrow + Bob's repayment  

        // Expect: remaining debtTokens to persist and have accrued
        expect(
            (await hhDebtToken.balanceOf(bob.address)))
            .to.equal(ethers.utils.parseUnits('0.500000005805331156', 18)); 

        // Expect: NFT not transferred from Escrow
        expect(
            (await hhNFT.ownerOf(bob_tokenId)))
            .to.equal(hhCollateralManagerAddress);           
    });

    it('should retrieve an NFT by first partially repaying and then fully repaying a borrow', async function () {
        const depositAmount = ethers.utils.parseUnits('2', 18); 
        const borrowAmount = ethers.utils.parseUnits('1', 18);
        const repaymentAmount = ethers.utils.parseUnits('0.5', 18);   
        const repaymentAmount2 = ethers.utils.parseUnits('0.6', 18);       
        const paidAmount = ethers.utils.parseUnits('0.500000019025875352', 18);
        const interestRate = 20;

        // Initialize reserve
        await initReserve();

        // Deposit Asset tokens [required for liquidity]
        await deposit(alice, hhNFT.address, hhAssetToken, depositAmount, alice.address, '123');
        
        // Borrow Asset tokens
        await borrow(bob, hhNFT, bob_tokenId, hhAssetToken, borrowAmount, bob.address, '123');

        // Expect: debtTokens to have been minted
        expect(
            (await hhDebtToken.balanceOf(bob.address)))
            .to.equal(ethers.utils.parseUnits('1', 18)); 
        
        // Retrieve borrowId 
        borrowIds = await hhCollateralManager.getUserBorrowIds(bob.address);
        borrowId = borrowIds[0];

        // Repay Asset tokens
        async function _repay(signer, collateralAddress, assetToken, fToken, repaymentAmount, borrowId) {
            return repay(signer, collateralAddress, assetToken, fToken, repaymentAmount, borrowId);
        }

        // Expect: Repay Emit response
        res = await _repay(bob, hhNFT.address, hhAssetToken, hhFToken, repaymentAmount, borrowId);
        // TODO: resolve library event emit
        // expect(res)
        //     .to.emit(hhLendingPool, 'Repay')
        //     .withArgs(
        //         borrowId,
        //         hhAssetToken.address,
        //         repaymentAmount,
        //         bob.address);  

        // Expect: remaining debtTokens to persist and have accrued
        expect(
            (await hhDebtToken.balanceOf(bob.address)))
            .to.equal(ethers.utils.parseUnits('0.500000005805331156', 18)); 

        // Expect: NFT not transferred from Escrow
        expect(
            (await hhNFT.ownerOf(bob_tokenId)))
            .to.equal(hhCollateralManagerAddress);           

        res2 = await _repay(bob, hhNFT.address, hhAssetToken, hhFToken, repaymentAmount2, borrowId);
        // TODO: resolve library event emit
        // expect(res2)
        //     .to.emit(hhLendingPool, 'Repay')
        //     .withArgs(
        //         borrowId,
        //         hhAssetToken.address,
        //         paidAmount, // The amount of repaid debt vs the amount sent
        //         bob.address);  

        // Expect: NFT transferred from Escrow
        expect(
            (await hhNFT.ownerOf(bob_tokenId)))
            .to.equal(bob.address);      
    });

    it('should create a new borrow after first partially repaying and then fully repaying a borrow', async function () {
        const depositAmount = ethers.utils.parseUnits('2', 18); 
        const borrowAmount = ethers.utils.parseUnits('1', 18);
        const repaymentAmount = ethers.utils.parseUnits('0.5', 18);   
        const repaymentAmount2 = ethers.utils.parseUnits('0.6', 18);       
        const paidAmount = ethers.utils.parseUnits('0.500000019025875352', 18);
        const interestRate = 20;

        // Initialize reserve
        await initReserve();

        // Deposit Asset tokens [required for liquidity]
        await deposit(alice, hhNFT.address, hhAssetToken, depositAmount, alice.address, '123');
        
        // Borrow Asset tokens
        await borrow(bob, hhNFT, bob_tokenId, hhAssetToken, borrowAmount, bob.address, '123');

        // Expect: debtTokens to have been minted
        expect(
            (await hhDebtToken.balanceOf(bob.address)))
            .to.equal(ethers.utils.parseUnits('1', 18)); 
        
        // Retrieve borrowId 
        borrowIds = await hhCollateralManager.getUserBorrowIds(bob.address);
        borrowId = borrowIds[0];

        // Repay Asset tokens
        async function _repay(signer, collateralAddress, assetToken, fToken, repaymentAmount, borrowId) {
            return repay(signer, collateralAddress, assetToken, fToken, repaymentAmount, borrowId);
        }

        // Expect: Repay Emit response
        res = await _repay(bob, hhNFT.address, hhAssetToken, hhFToken, repaymentAmount, borrowId);
        // TODO resovle library event emit
        // expect(res)
        //     .to.emit(hhLendingPool, 'Repay')
        //     .withArgs(
        //         borrowId,
        //         hhAssetToken.address,
        //         repaymentAmount,
        //         bob.address);  

        // Expect: remaining debtTokens to persist and have accrued
        expect(
            (await hhDebtToken.balanceOf(bob.address)))
            .to.equal(ethers.utils.parseUnits('0.500000005805331156', 18)); 

        // Expect: NFT not transferred from Escrow
        expect(
            (await hhNFT.ownerOf(bob_tokenId)))
            .to.equal(hhCollateralManagerAddress);           
        
        res2 = await _repay(bob, hhNFT.address, hhAssetToken, hhFToken, repaymentAmount2, borrowId); 
        // TODO: solve library event emit
        // expect(res2)
        //     .to.emit(hhLendingPool, 'Repay')
        //     .withArgs(
        //         borrowId,
        //         hhAssetToken.address,
        //         paidAmount, // The amount of repaid debt vs the amount sent
        //         bob.address);  

        // Expect: NFT transferred from Escrow
        expect(
            (await hhNFT.ownerOf(bob_tokenId)))
            .to.equal(bob.address);     
            
        // Borrow Asset tokens
        await borrow(bob, hhNFT, bob_tokenId, hhAssetToken, borrowAmount, bob.address, '123');

        // NFT should be in collateral manager contract
        expect(
            (await hhNFT.ownerOf(bob_tokenId)))
            .to.equal(hhCollateralManagerAddress); 
    });
});
