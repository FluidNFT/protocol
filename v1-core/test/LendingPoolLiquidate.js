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

    // Get and deploy LendingPool
    LendingPool = await ethers.getContractFactory('LendingPool', {
        libraries: {
            SupplyLogic: hhSupplyLogicLibAddress,
            BorrowLogic: hhBorrowLogicLibAddress,
            LiquidateLogic: hhLiquidateLogicLibAddress
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

    // Set NFT interestRate threshold
    hhConfigurator
    .connect(admin)
    .setCollateralManagerInterestRate(hhNFT.address, hhAssetToken.address, ethers.utils.parseUnits(interestRate.toString(), 25)); // in RAY 1e27/100 for percentage

    // Get and deploy fToken
    FToken = await ethers.getContractFactory('FToken');
    hhFToken = await FToken.deploy(
        hhConfiguratorAddress,
        hhLendingPoolAddress,
        treasury.address,
        hhNFT.address,
        hhAssetToken.address,
        'Dai fToken', 
        'fDAI');
    await hhFToken.deployed();

    // Get and deploy debtToken
    DebtToken = await ethers.getContractFactory('DebtToken');
    hhDebtToken = await DebtToken.deploy(
        hhConfiguratorAddress,
        hhLendingPoolAddress,
        'Dai debtToken', 
        'debtDAI'
    );
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
});

async function initReserve() {
    return hhConfigurator
    .connect(admin)
    .initLendingPoolReserve(
        hhNFT.address,
        hhAssetToken.address, 
        hhFToken.address,
        hhDebtToken.address,
        "WETH"
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

describe('LendingPool >> Liquidate', function() {

    it('should not trigger liquidation', async function () {
        const depositAmount = ethers.utils.parseUnits('200', 18); 
        const borrowAmount = ethers.utils.parseUnits('60', 18);  
        const bidAmount = ethers.utils.parseUnits('70', 18);
        let borrowIds;
        let borrowId;

        // Update auction length to 1 second to be able to liquidate
        await hhConfigurator.connect(admin).setLendingPoolAuctionDuration(1);

        // Initialize reserve
        await initReserve();

        // Deposit Asset tokens [required for liquidity]
        await deposit(alice, hhNFT.address, hhAssetToken, depositAmount, alice.address, '123');
        
        // Borrow Asset tokens
        await borrow(bob, hhNFT, bob_tokenId, hhAssetToken, borrowAmount, bob.address, '123');
    
        // Retrieve borrowId 
        borrowIds = await hhCollateralManager.getUserBorrowIds(bob.address);
        borrowId = borrowIds[0];

        await expect(
            liquidate(alice, hhNFT.address, hhAssetToken.address, borrowId)
            ).to.be.revertedWith("AUCTION_NOT_TRIGGERED");

        newPrice = ethers.utils.parseUnits('80', 18);
        await hhConfigurator
            .connect(admin)
            .setNFTPriceConsumerFloorPrice(hhNFT.address, newPrice); 

        await bid(alice, hhAssetToken, bidAmount, borrowId);

        await expect(
            liquidate(alice, hhNFT.address, hhAssetToken.address, borrowId)
            ).to.be.revertedWith("AUCTION_STILL_ACTIVE");

        await sleep(2000);

        await expect(
            liquidate(alice, hhNFT.address, hhAssetToken2.address, borrowId)
            ).to.be.revertedWith("INCORRECT_ASSET");

        await expect(
            liquidate(alice, hhNFT2.address, hhAssetToken.address, borrowId)
            ).to.be.revertedWith("INCORRECT_COLLATERAL");
    });

    it('should trigger liquidation', async function () {
        const depositAmount = ethers.utils.parseUnits('200', 18); 
        const borrowAmount = ethers.utils.parseUnits('60', 18);  
        const bidAmount = ethers.utils.parseUnits('70', 18);
        let borrowIds;
        let borrowId;
        let newPrice;

        // Update auction length to 1 second to be able to liquidate
        await hhConfigurator.connect(admin).setLendingPoolAuctionDuration(1);

        // Initialize reserve
        await initReserve();
    
        // Deposit Asset tokens [required for liquidity]
        await deposit(alice, hhNFT.address, hhAssetToken, depositAmount, alice.address, '123');
        
        // Borrow Asset tokens
        await borrow(bob, hhNFT, bob_tokenId, hhAssetToken, borrowAmount, bob.address, '123');

        // Retrieve borrowId 
        borrowIds = await hhCollateralManager.getUserBorrowIds(bob.address);
        borrowId = borrowIds[0];

        newPrice = ethers.utils.parseUnits('80', 18);
        await hhConfigurator
            .connect(admin)
            .setNFTPriceConsumerFloorPrice(hhNFT.address, newPrice); 

        await bid(alice, hhAssetToken, bidAmount, borrowId);

        await sleep(2000);

        let aBalanceBefore = await hhAssetToken.balanceOf(alice.address);
        let bBalanceBefore = await hhAssetToken.balanceOf(bob.address);
        let tBalanceBefore = await hhAssetToken.balanceOf(treasury.address);

        res = await liquidate(alice, hhNFT.address, hhAssetToken.address, borrowId);
        expect(res).to.emit(hhLendingPool, "Liquidate")
            .withArgs(
                borrowId,
                alice.address
            );

        let aBalanceAfter = await hhAssetToken.balanceOf(alice.address);
        let bBalanceAfter = await hhAssetToken.balanceOf(bob.address);
        let tBalanceAfter = await hhAssetToken.balanceOf(treasury.address);

        // Expect caller to have received X
        expect(
            (aBalanceAfter.sub(aBalanceBefore)))
            .to.equal(borrowAmount.mul(5).div(100).mul(90).div(100)); // 4.5%  

        // Expect borrower to have recieved Y
        let repaymentAmount = ethers.utils.parseUnits('60.000001902587519026', 18);
        expect(
            (bBalanceAfter.sub(bBalanceBefore)))
            .to.equal(bidAmount.sub(repaymentAmount).sub(borrowAmount.mul(5).div(100))); // bid amount minus 5% fees on borrow amount 

        // Expect treasury to have received Z
        expect(
            (tBalanceAfter.sub(tBalanceBefore)))
            .to.equal(borrowAmount.mul(5).div(1000));  // 0.5%

        expect(
            (await hhNFT.ownerOf(bob_tokenId)))
            .to.equal(alice.address);  

    });
});
