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
    bob_tokenId2 = 2;

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
    await hhNFT.mint(bob.address, bob_tokenId2);

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

async function batchBorrow(signer, nftTokens, tokenIds, assetTokens, tokenAmounts, onBehalfOf, referralCode, isCreate=true) {
    // Approve NFT transfer
    let assetTokenAddresses = [];
    let nftTokenAddresses = [];
    if (isCreate) {
        for (let i = 0; i < nftTokens.length; i++) {
            await nftTokens[i].connect(signer).approve(hhCollateralManagerAddress, tokenIds[i]);
            assetTokenAddresses.push(assetTokens[i].address);
            nftTokenAddresses.push(nftTokens[i].address);
        }    
    }   

    return hhLendingPool.connect(signer).batchBorrow(
        assetTokenAddresses,
        tokenAmounts,
        nftTokenAddresses,
        tokenIds,
        onBehalfOf,
        referralCode);
}

async function repay(signer, collateralAddress, assetToken, fToken, repaymentAmount, borrowId) {
    // Approve transfer of repaymentAmount asset tokens to fToken address (asset reserve)
    await assetToken.connect(signer).approve(fToken.address, repaymentAmount);
    return hhLendingPool.connect(signer).repay(
        collateralAddress,
        assetToken.address,
        repaymentAmount,
        borrowId);
}

async function bid(signer, assetToken, bidAmount, borrowId) {
    // Approve transfer of bidAmount asset tokens to lendingPool address)
    await assetToken.connect(signer).approve(hhLendingPoolAddress, bidAmount);
    return hhLendingPool.connect(signer).bid(
        assetToken.address,
        bidAmount,
        borrowId);
}

async function redeem(signer, assetToken, redeemAmount, borrowId) {
    // Approve transfer of redeemAmount asset tokens to lendingPool address)
    await assetToken.connect(signer).approve(hhLendingPoolAddress, redeemAmount);
    return hhLendingPool.connect(signer).redeem(
        assetToken.address,
        liquidationAmount,
        borrowId);
}

async function liquidate(signer, collateral, asset, borrowId) {
    return hhLendingPool.connect(signer).liquidate(collateral, asset, borrowId);
}

describe('LendingPool >> Borrow', function() {
    
    it('should check NFT balances', async function () {
        expect(
            (await hhNFT.balanceOf(alice.address)))
            .to.equal(1);
        expect(
            (await hhNFT.balanceOf(bob.address)))
            .to.equal(2); 
    });

    it('should check NFT tokenId ownership', async function () {
        expect(
            (await hhNFT.ownerOf(alice_tokenId)))
            .to.equal(alice.address);
        expect(
            (await hhNFT.ownerOf(bob_tokenId)))
            .to.equal(bob.address);    
    });

    it('should create borrow, escrow NFT, release tokens and create debt', async function() {
        const depositAmount = ethers.utils.parseUnits('4', 18); 
        const borrowAmount = ethers.utils.parseUnits('2', 18); 
        const liquidityIndex = ethers.utils.parseUnits('1.000000006341958396752917300', 27);

        // Initialize reserve
        await initReserve();

        // Deposit Asset tokens [required for liquidity]
        await deposit(alice, hhNFT.address, hhAssetToken, depositAmount, alice.address, '123');

        // Expect: Borrow Emit response
        res = await borrow(bob, hhNFT, bob_tokenId, hhAssetToken, borrowAmount, bob.address, '123');

        // TODO: resolve why library events aren't triggering in hardhat
        // expect(res).to.emit(hhLendingPool, 'Borrow')
        //     .withArgs(
        //         hhAssetToken.address,
        //         borrowAmount,
        //         hhNFT.address,
        //         bob_tokenId,
        //         bob.address, 
        //         liquidityIndex);

        // Expect: NFT to be held in Escrow
        expect(
            (await hhNFT.ownerOf(bob_tokenId)))
            .to.equal(hhCollateralManagerAddress);

        // Expect: assetTokens transferred to bob
        expect(
            (await hhAssetToken.balanceOf(bob.address)))
            .to.equal(hhAssetTokenInitialBalance.add(borrowAmount));

        // Expect: assetTokens transferred to bob
        expect(
            (await hhDebtToken.balanceOf(bob.address)))
            .to.equal(borrowAmount);
    });

    // // it('should correctly update the liquidity index', async function() {
    // //     const depositAmount = 2;
    // //     const borrowAmount = 1;

    // //     const depositAmountWad = ethers.utils.parseUnits('2', 18); 
    // //     const borrowAmountWad = ethers.utils.parseUnits('1', 18); 

    // //     // Calculate Liquidity Index
    // //     prevLiquidityIndex = ethers.utils.parseUnits('1', 27);
    // //     timeDelta = 2;
        
    // //     // Initialize reserve
    // //     await initReserve();

    // //     // Deposit Asset tokens [required for liquidity]
    // //     await deposit(alice, hhNFT.address, hhAssetToken, depositAmount, alice.address, '123');
        
    // //     const utilizationRate = ethers.utils.parseUnits((borrowAmountWad / depositAmountWad).toString(), 27); 
    // //     //** const borrowRate = ethers.utils.parseUnits(interestRate.toString(), 25); // 20% to 27dp
    // //     const liquidityRate = utilizationRate.mul(interestRate).div(100); // **using interestRate.div(100) as a proxy for borrowRate without the decimals
    // //     const liquidityIndex = (prevLiquidityIndex.mul(liquidityRate).div(ethers.utils.parseUnits('1', 27)).mul(timeDelta).div(365).div(24).div(60).div(60)).add(prevLiquidityIndex);

    // //     // Expect: Borrow Emit response
    // //     await expect(
    // //         borrow(bob, hhNFT, bob_tokenId, hhAssetToken, borrowAmountWad))
    // //         .to.emit(hhLendingPool, 'Borrow')
    // //         .withArgs(
    // //             hhAssetToken.address,
    // //             borrowAmountWad,
    // //             hhNFT.address,
    // //             bob_tokenId,
    // //             bob.address,
    // //             liquidityIndex);
    // // });

    it('should create borrow, and then allow for more to be borrowed against it', async function() {
        const depositAmount = ethers.utils.parseUnits('100', 18); 
        const borrowAmount = ethers.utils.parseUnits('2', 18); 
        const borrowAmount2 = ethers.utils.parseUnits('4.000000002058697264', 18);
        const borrowAmount3 = ethers.utils.parseUnits('70', 18); 

        // Initialize reserve
        await initReserve();

        // Deposit Asset tokens [required for liquidity]
        await deposit(alice, hhNFT.address, hhAssetToken, depositAmount, alice.address, '123');
        
        console.log('borrow1');
        // Expect: Borrow Emit response
        await borrow(bob, hhNFT, bob_tokenId, hhAssetToken, borrowAmount, bob.address, '123');

        // Expect: NFT to be held in Escrow
        expect(
            (await hhNFT.ownerOf(bob_tokenId)))
            .to.equal(hhCollateralManagerAddress);

        // Expect: assetTokens transferred to bob
        expect(
            (await hhAssetToken.balanceOf(bob.address)))
            .to.equal(hhAssetTokenInitialBalance.add(borrowAmount));

        // Expect: assetTokens transferred to bob
        expect(
            (await hhDebtToken.balanceOf(bob.address)))
            .to.equal(borrowAmount);

        console.log('borrow2');
        // Expect: Borrow Emit response
        res = await borrow(bob, hhNFT, bob_tokenId, hhAssetToken, borrowAmount, bob.address, '123', false);
        // TODO: resolve library not emitting events
        // expect(res).to.emit(hhLendingPool, 'Borrow')

        // Expect: assetTokens transferred to bob
        expect(
            (await hhDebtToken.balanceOf(bob.address)))
            .to.equal(borrowAmount2);

        await expect(
            borrow(bob, hhNFT, bob_tokenId, hhAssetToken, borrowAmount3, bob.address, '123', false))
            .to.be.revertedWith('UNDERCOLLATERALIZED');
            
    });

    it('should create a batch of borrows, escrow NFTs, release tokens and create debt', async function() {
        const depositAmount = ethers.utils.parseUnits('4', 18); 
        const borrowAmount = ethers.utils.parseUnits('2', 18); 

        // Initialize reserve
        await initReserve();

        // Deposit Asset tokens [required for liquidity]
        await deposit(alice, hhNFT.address, hhAssetToken, depositAmount, alice.address, '123');
        
        // Expect: Create Batch Borrow
        res = await batchBorrow(bob, [hhNFT, hhNFT], [bob_tokenId, bob_tokenId2], [hhAssetToken, hhAssetToken], [borrowAmount, borrowAmount], bob.address, '123');
        // TODO: resolve why library events aren't triggering in hardhat
        // TODO 2: rewrite Batch Borrow return args
        // expect(res).to.emit(hhLendingPool, 'BatchBorrow')
        //     .withArgs(
        //         hhAssetToken.address,
        //         borrowAmount,
        //         hhNFT.address,
        //         bob_tokenId,
        //         bob.address, 
        //         liquidityIndex);

        // Expect: NFTs to be held in Escrow
        expect(
            (await hhNFT.ownerOf(bob_tokenId)))
            .to.equal(hhCollateralManagerAddress);
        expect(
            (await hhNFT.ownerOf(bob_tokenId2)))
            .to.equal(hhCollateralManagerAddress);
            
        // Expect: assetTokens transferred to bob
        expect(
            (await hhAssetToken.balanceOf(bob.address)))
            .to.equal(hhAssetTokenInitialBalance.add(borrowAmount).add(borrowAmount));

        // // Expect: assetTokens transferred to bob
        // TODO: resolve maths
        expect(
            (await hhDebtToken.balanceOf(bob.address)))
            .to.equal(borrowAmount.add(borrowAmount));
    });

    it('should return an interest rate', async function() {
        const depositAmount = ethers.utils.parseUnits('4', 18); 
        const borrowAmount = ethers.utils.parseUnits('2', 18); 

        // Initialize reserve
        await initReserve();

        // Deposit Asset tokens [required for liquidity]
        await deposit(alice, hhNFT.address, hhAssetToken, depositAmount, alice.address, '123');
        
        // Expect: Create Batch Borrow
        res = await batchBorrow(bob, [hhNFT, hhNFT], [bob_tokenId, bob_tokenId2], [hhAssetToken, hhAssetToken], [borrowAmount, borrowAmount], bob.address, '123');
        // TODO: resolve why library events aren't triggering in hardhat
        // TODO 2: rewrite Batch Borrow return args
        // expect(res).to.emit(hhLendingPool, 'BatchBorrow')
        //     .withArgs(
        //         hhAssetToken.address,
        //         borrowAmount,
        //         hhNFT.address,
        //         bob_tokenId,
        //         bob.address, 
        //         liquidityIndex);

        let baseVariableBorrowRate = await hhInterestRateStrategy.baseVariableBorrowRate()
        console.log('baseVariableBorrowRate', baseVariableBorrowRate);

        let interestRate = await hhInterestRateStrategy.calculateInterestRates(
            hhAssetToken.address,
            hhFToken.address,
            "0",
            "0",
            ethers.utils.parseUnits('1', 18),
            "5"
        );
        console.log('liquidityRate', ethers.utils.formatUnits(interestRate[0], 27));
        console.log('interestRate', ethers.utils.formatUnits(interestRate[1], 27));
        
    });
});
