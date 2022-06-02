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

    hhAssetToken2 = await AssetToken.deploy('Dai Token2', 'DAI2', hhAssetTokenSupply.toString());
    await hhAssetToken2.deployed();
    
    // Get and deploy NFT
    NFT = await ethers.getContractFactory('NFT');
    hhNFT = await NFT.deploy('Punk NFT', 'PUNK');
    await hhNFT.deployed();

    hhNFT2 = await NFT.deploy('Punk NFT2', 'PUNK2');
    await hhNFT2.deployed();

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
    await assetToken.connect(signer).approve(hhLendingPoolAddress, repaymentAmount);
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

async function redeem(signer, collateralAddress, assetToken, redeemAmount, borrowId) {
    // Approve transfer of redeemAmount asset tokens to lendingPool address)
    await assetToken.connect(signer).approve(hhLendingPoolAddress, redeemAmount);
    return hhLendingPool.connect(signer).redeem(
        collateralAddress,
        assetToken.address,
        redeemAmount,
        borrowId);
}

async function liquidate(signer, collateral, asset, borrowId) {
    return hhLendingPool.connect(signer).liquidate(collateral, asset, borrowId);
}

// Not borrower
// Not sufficient amount
// Full amount
// Part amount

describe('LendingPool >> Redeem', function() {

    it('should redeem a defaulted borrow and retreive on full payment', async function () {
        const depositAmount = ethers.utils.parseUnits('200', 18); 
        const borrowAmount = ethers.utils.parseUnits('60', 18);  
        const bidAmount = ethers.utils.parseUnits('70', 18);
        const redeemAmount1 = ethers.utils.parseUnits('3', 18);
        const redeemAmount2 = ethers.utils.parseUnits('64', 18);
        const redeemAmount3 = ethers.utils.parseUnits('63.000001145943107725', 18);
        let borrowIds;
        let borrowId;
        let newPrice;
        let borrowItem;

        // Initialize reserve
        await initReserve();
    
        // Deposit Asset tokens [required for liquidity]
        await deposit(admin, hhNFT.address, hhAssetToken, depositAmount, admin.address, '123');
        
        // Borrow Asset tokens
        await borrow(alice, hhNFT, alice_tokenId, hhAssetToken, borrowAmount, alice.address, '123');

        // Retrieve borrowId 
        borrowIds = await hhCollateralManager.getUserBorrowIds(alice.address);
        borrowId = borrowIds[0];

        borrowItem = await hhCollateralManager.getBorrow(borrowId);

        newPrice = ethers.utils.parseUnits('80', 18);
        await hhConfigurator
            .connect(admin)
            .setNFTPriceConsumerFloorPrice(hhNFT.address, newPrice); 

        await bid(bob, hhAssetToken, bidAmount, borrowId);

        await expect(
            redeem(alice, hhNFT.address, hhAssetToken, redeemAmount1, borrowId)
            ).to.be.revertedWith("INSUFFICIENT_AMOUNT");

        await expect(
            redeem(alice, hhNFT.address, hhAssetToken, redeemAmount2, borrowId)
            ).to.be.revertedWith("OVERPAYMENT");

        borrowItem = await hhCollateralManager.getBorrow(borrowId);

        res = await redeem(alice, hhNFT.address, hhAssetToken, redeemAmount3, borrowId);
        // TODO: resolve library emit
        // expect(res).to.emit(hhLendingPool, 'Redeem')
        //     .withArgs(
        //         borrowId,
        //         hhAssetToken.address,
        //         redeemAmount3,
        //         alice.address
        //     );

        let _borrowAmount = await hhCollateralManager.getBorrowAmount(borrowId);
        console.log('_borrowAmount', _borrowAmount);

        borrowItem = await hhCollateralManager.getBorrow(borrowId);
        expect(borrowItem.status).to.equal(2); // Repaid

        expect(
            (await hhNFT.ownerOf(alice_tokenId)))
            .to.equal(alice.address);      
    });

    it('should redeem a defaulted borrow and not retrieve on partial payment', async function () {
        const depositAmount = ethers.utils.parseUnits('200', 18); 
        const borrowAmount = ethers.utils.parseUnits('60', 18);  
        const bidAmount = ethers.utils.parseUnits('70', 18);
        const redeemAmount1 = ethers.utils.parseUnits('20', 18);
        let borrowIds;
        let borrowId;
        let newPrice;
        let borrowItem;
        let borrowAmountBeforeRedeem;

        // Initialize reserve
        await initReserve();

        // Deposit Asset tokens [required for liquidity]
        await deposit(admin, hhNFT.address, hhAssetToken, depositAmount, admin.address, '123');

        // Borrow Asset tokens
        await borrow(alice, hhNFT, alice_tokenId, hhAssetToken, borrowAmount, alice.address, '123');
        
        // Retrieve borrowId 
        borrowIds = await hhCollateralManager.getUserBorrowIds(alice.address);
        borrowId = borrowIds[0];

        borrowItem = await hhCollateralManager.getBorrow(borrowId);

        newPrice = ethers.utils.parseUnits('80', 18);
        await hhConfigurator
            .connect(admin)
            .setNFTPriceConsumerFloorPrice(hhNFT.address, newPrice); 

        await bid(alice, hhAssetToken, bidAmount, borrowId);

        borrowItem = await hhCollateralManager.getBorrow(borrowId);
        borrowAmountBeforeRedeem = borrowItem.borrowAmount;

        res = await  redeem(alice, hhNFT.address, hhAssetToken, redeemAmount1, borrowId);
        // TODO: resolve library emit
        // expect(res).to.emit(hhLendingPool, 'Redeem')
        //     .withArgs(
        //         borrowId,
        //         hhAssetToken.address,
        //         redeemAmount1,
        //         alice.address
        //     );

        borrowItem = await hhCollateralManager.getBorrow(borrowId);

        expect(borrowItem.borrowAmount).to.equal("43000000180379930944"); // 60 - 20 + 5% liquidation fee + interest

        expect(
            (await hhNFT.ownerOf(alice_tokenId)))
            .to.equal(hhCollateralManager.address);      
    });

    it('should revert if not borrower, incorrect asset/collateral or inactive auction', async function () {
        const depositAmount = ethers.utils.parseUnits('200', 18); 
        const borrowAmount = ethers.utils.parseUnits('60', 18);  
        const bidAmount = ethers.utils.parseUnits('70', 18);
        const redeemAmount1 = ethers.utils.parseUnits('63.000001145943107725', 18);
        let borrowIds;
        let borrowId;
        let newPrice;
        let borrowItem;
        let borrowAmountBeforeRedeem;

        // Initialize reserve
        await initReserve();

        // Deposit Asset tokens [required for liquidity]
        await deposit(admin, hhNFT.address, hhAssetToken, depositAmount, admin.address, '123');

        // Borrow Asset tokens
        await borrow(alice, hhNFT, alice_tokenId, hhAssetToken, borrowAmount, alice.address, '123');

        // Retrieve borrowId 
        borrowIds = await hhCollateralManager.getUserBorrowIds(alice.address);
        borrowId = borrowIds[0];

        borrowItem = await hhCollateralManager.getBorrow(borrowId);

        newPrice = ethers.utils.parseUnits('80', 18);
        await hhConfigurator
            .connect(admin)
            .setNFTPriceConsumerFloorPrice(hhNFT.address, newPrice); 

        await bid(alice, hhAssetToken, bidAmount, borrowId);

        // NOTE: Removing this check to permit initiator other than borrower account to init the redeem
        // await expect(
        //     redeem(bob, hhNFT.address, hhAssetToken, redeemAmount1, borrowId)
        //     ).to.be.revertedWith("NOT_BORROWER")

        await expect(
            redeem(alice, hhNFT.address, hhAssetToken2, redeemAmount1, borrowId)
            ).to.be.revertedWith("INCORRECT_ASSET")
    
        await expect(
            redeem(alice, hhNFT2.address, hhAssetToken, redeemAmount1, borrowId)
            ).to.be.revertedWith("INCORRECT_COLLATERAL")

        await redeem(alice, hhNFT.address, hhAssetToken, redeemAmount1, borrowId)
        await expect(
            redeem(alice, hhNFT.address, hhAssetToken, redeemAmount1, borrowId)
            ).to.be.revertedWith("INACTIVE_AUCTION")
    });

});
