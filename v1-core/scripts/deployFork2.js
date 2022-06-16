// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const fs = require("fs");
const envFile = "./interface-env.env";
const docsFile = "../docs/deployed_address.txt";
let dataItem = "";
let fileData = "";
let docsFileData = "";
  
async function writeContractAddressesToFile(fileData, fileName) {
  fs.writeFile(fileName, fileData, (err) => {
    // In case of a error throw err.
    if (err) throw err;
  });
}

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  console.log('network', network.name);

  /* 
  
  1. Deploy locally
  
  */
  let address;

  // Get Signers
  [acc0, acc1, acc2, emergencyAdmin, admin, treasuryAccount] = await hre.ethers.getSigners();
 
  // Get network
  docsFileData += `NETWORK=${network.name.toUpperCase()}\n`;

  // // Get and deploy Configurator
  Configurator = await ethers.getContractFactory('Configurator');
  // If deployed
  // address = "0x64Ec81A4005f715f19cD50B568FFA381479C5c61";
  // configurator = await Configurator.attach(address);

  // To deploy
  configurator = await Configurator.deploy(
      emergencyAdmin.address,
      admin.address 
  );
  await configurator.deployed();
  // Log
  console.log("Configurator deployed to:", configurator.address);
  docsFileData += `LENDING_POOL_CONTRACT_ADDRESS=${configurator.address}\n`;

  // Get and deploy SupplyLogic Library
  SupplyLogicLib = await ethers.getContractFactory('SupplyLogic');
  // If deployed
  // address = "0x5fCbB6B3bcB40c193a4B544feF85fdE0f2956FDB";
  // hhSupplyLogicLib = await SupplyLogicLib.attach(address);
  // To deploy
  hhSupplyLogicLib = await SupplyLogicLib.deploy();
  await hhSupplyLogicLib.deployed();
  hhSupplyLogicLibAddress = await hhSupplyLogicLib.resolvedAddress;
  console.log('hhSupplyLogicLib deployed to:', hhSupplyLogicLib.address);

  // Get and deploy BorrowLogic Library
  BorrowLogicLib = await ethers.getContractFactory('BorrowLogic');
  // If deployed
  // address = "0x201c17bd0653B0B6B686383FEB69413f4F5A73B7";
  // hhBorrowLogicLib = await BorrowLogicLib.attach(address);
  // To deploy
  hhBorrowLogicLib = await BorrowLogicLib.deploy();
  await hhBorrowLogicLib.deployed();
  hhBorrowLogicLibAddress = await hhBorrowLogicLib.resolvedAddress;
  console.log('hhBorrowLogicLib deployed to:', hhBorrowLogicLib.address);

  // Get and deploy LiquidateLogic Library
  LiquidateLogicLib = await ethers.getContractFactory('LiquidateLogic');
  // If deployed
  // address = "0x8FAA542cC4Ed31fb229d20F5Cb438844fD7772a8";
  // hhLiquidateLogicLib = await LiquidateLogicLib.attach(address);
  // To deploy
  hhLiquidateLogicLib = await LiquidateLogicLib.deploy();
  await hhLiquidateLogicLib.deployed();
  hhLiquidateLogicLibAddress = await hhLiquidateLogicLib.resolvedAddress;
  console.log('hhLiquidateLogicLib deployed to:', hhLiquidateLogicLib.address);

  // Get and deploy ReserveLogic Library
  ReserveLogicLib = await ethers.getContractFactory('ReserveLogic');
  // If deployed
  // address = "0x98F20F7F1FCdb1a96f493673B0c4A2e1DD60c715";
  // hhReserveLogicLib = await ReserveLogicLib.attach(address);
  // To deploy
  hhReserveLogicLib = await ReserveLogicLib.deploy();
  await hhReserveLogicLib.deployed();
  hhReserveLogicLibAddress = await hhReserveLogicLib.resolvedAddress;
  console.log('hhReserveLogicLib deployed to:', hhReserveLogicLib.address);

  // Get and deploy LendingPool contract
  const LendingPool = await ethers.getContractFactory('LendingPool', {
    libraries: {
        SupplyLogic: hhSupplyLogicLib.address,
        BorrowLogic: hhBorrowLogicLib.address,
        LiquidateLogic: hhLiquidateLogicLib.address,
        ReserveLogic: hhReserveLogicLib.address
    }
  });
  // If deployed
  // address = "0x7785DF9d1dd252AefA30f40a02AACfeb5d8Ff2c9";
  // lendingPool = await LendingPool.attach(address);
  // To deploy
  const lendingPool = await LendingPool.connect(admin).deploy(
    configurator.address,
    treasuryAccount.address
  );
  await lendingPool.deployed();
  console.log("LendingPool deployed to:", lendingPool.address);
  dataItem = `LENDING_POOL_CONTRACT_ADDRESS=${lendingPool.address}\n`;
  fileData += `REACT_APP_${dataItem}`;
  docsFileData += dataItem;

  // // Connect Configurator to LendingPool by setting the address
  await configurator.connect(admin).connectLendingPool(lendingPool.address);

  // Get and deploy CollateralManager contract
  const CollateralManager = await ethers.getContractFactory('CollateralManager');
  // If deployed
  // address = "0x64e9974C99325B6719Ce56e1096Fbda0a276d532";
  // collateralManager = await CollateralManager.attach(address);
  // To deploy
  const collateralManager = await CollateralManager.deploy(
    configurator.address,
    lendingPool.address
  );
  await collateralManager.deployed();
  console.log("CollateralManager deployed to:", collateralManager.address);
  dataItem = `COLLATERAL_MANAGER_CONTRACT_ADDRESS=${collateralManager.address}\n`;
  fileData += `REACT_APP_${dataItem}`;
  docsFileData += dataItem;

  // Connect CollateralManager in Configurator
  await configurator.connect(admin).connectCollateralManager(
      collateralManager.address
  );

  // Link CollateralManager to LendingPool
  await configurator.connect(admin).connectLendingPoolContract("CM");

  // Get and deploy TokenPriceConsumer
  TokenPriceConsumer = await ethers.getContractFactory('TokenPriceConsumer');
  // If deployed 
  // address = "0x7743d7916260236De5E543a9e5D578C3E2E87B3D";
  // tokenPriceConsumer = TokenPriceConsumer.attach(address);
  // To deploy
  tokenPriceConsumer = await TokenPriceConsumer.deploy(
    "0xAa7F6f7f507457a1EE157fE97F6c7DB2BEec5cD0" // registry
  );
  await configurator.connect(admin).connectTokenPriceConsumer(tokenPriceConsumer.address);
  await configurator.connect(admin).connectLendingPoolContract("TOKEN_PRICE_ORACLE");
  console.log("tokenPriceConsumer deployed to:", tokenPriceConsumer.address);
  dataItem = `TOKEN_PRICE_CONSUMER_CONTRACT_ADDRESS=${tokenPriceConsumer.address}\n`;
  fileData += `REACT_APP_${dataItem}`;
  docsFileData += dataItem;

  // Get and deploy NFTPriceConsumer
  NFTPriceConsumer = await ethers.getContractFactory('NFTPriceConsumer');
  // If deployed
  // address = "0x683000C46E36861C480D5f37C890782b839E16d8";
  // nftPriceConsumer = NFTPriceConsumer.attach(address);
  // To deploy
  nftPriceConsumer = await NFTPriceConsumer.deploy(
    configurator.address,
    10 // window size
  );
  await configurator.connect(admin).connectNFTPriceConsumer(nftPriceConsumer.address);
  await configurator.connect(admin).connectLendingPoolContract("NFT_PRICE_ORACLE");
  console.log("nftPriceConsumer deployed to:", nftPriceConsumer.address);
  dataItem = `NFT_PRICE_CONSUMER_CONTRACT_ADDRESS=${nftPriceConsumer.address}\n`;
  fileData += `REACT_APP_${dataItem}`;
  docsFileData += dataItem;

  // Get and deploy AssetToken contracts
  const assetTokenSupply = hre.ethers.utils.parseEther("5000000.0");
  const assetTokenInitialBalance = hre.ethers.utils.parseEther("150000.0");
  const assetTokenInitialBalanceWETH = hre.ethers.utils.parseEther("200.0");
  const AssetToken = await ethers.getContractFactory('AssetToken');

  // Get NFT contracts
  NFT = await ethers.getContractFactory('NFT');
  // If deployed
  // address = "0x46fe1bE5F98ea0ad53E9eE834f7E5Fb313487f6F";
  // nftBAYC = await NFT.attach(address);
  // To deploy
  // BAYC:
  nftBAYC = await NFT.connect(admin).deploy('Bored Ape Yacht Club', 'BAYC');
  await nftBAYC.deployed();
  console.log("NFT BAYC deployed to:", nftBAYC.address);
  dataItem = `NFT_BAYC_CONTRACT_ADDRESS=${nftBAYC.address}\n`;
  fileData += `REACT_APP_${dataItem}`;
  docsFileData += dataItem;

  // WETH Asset Token:
  // WETH Asset Token:
  // If deployed
  // address = "0x0cb653DA1b3c314d1E8207Dd6CE18FC9098bE1F0";
  // assetTokenWETH = await AssetToken.attach(address);
  // To deploy
  assetTokenWETH = await AssetToken.connect(admin).deploy('WETH Token', 'WETH', assetTokenSupply); 
  await assetTokenWETH.deployed();
  console.log("assetTokenWETH deployed to:", assetTokenWETH.address);
  dataItem = `ASSET_TOKEN_WETH_CONTRACT_ADDRESS=${assetTokenWETH.address}\n`;
  fileData += `REACT_APP_${dataItem}`;
  docsFileData += dataItem;

  // Get and deploy LendingPoolAddressesProvider
  LendingPoolAddressesProvider = await ethers.getContractFactory("LendingPoolAddressesProvider");
  // If deployed
  // address = "0x0b9f6Bf99553C87F0e3B5DC9E9a0A9Ad95a4074e";
  // hhLendingPoolAddressesProvider = await LendingPoolAddressesProvider.attach(address);
  // To deploy
  hhLendingPoolAddressesProvider = await LendingPoolAddressesProvider.deploy("1"); // marketId
  await hhLendingPoolAddressesProvider.deployed();
  hhLendingPoolAddressesProviderAddress = await hhLendingPoolAddressesProvider.resolvedAddress;
  console.log("LendingPoolAddressesProvider deployed to:", hhLendingPoolAddressesProvider.address);
  await hhLendingPoolAddressesProvider.setLendingPool(lendingPool.address);
  await hhLendingPoolAddressesProvider.setConfigurator(configurator.address);
  await hhLendingPoolAddressesProvider.setCollateralManager(collateralManager.address);
  await hhLendingPoolAddressesProvider.setPoolAdmin(admin.address);
  await hhLendingPoolAddressesProvider.setEmergencyAdmin(emergencyAdmin.address);
  // TODO: add Oracles and anything else

  // Get and deploy fToken contracts
  FToken = await ethers.getContractFactory('FToken');
  // If deployed
  // address = "0xdd453aa7e0E08A4b7E634f7ebAd2BE260002041e";
  // fTokenBAYCWETH = await FToken.attach(address);
  // To deploy
  // WETH FToken:
  fTokenBAYCWETH = await  upgrades.deployProxy(FToken, [
    hhLendingPoolAddressesProviderAddress, 
    configurator.address,
    lendingPool.address,
    treasuryAccount.address,
    nftBAYC.address,
    assetTokenWETH.address,
    18,
    "BAYC-ETH-A F-Token",
    "baycETHa"
  ]);
  await fTokenBAYCWETH.deployed();
  console.log("fTokenBAYCWETH deployed to:", fTokenBAYCWETH.address);
  dataItem = `N_TOKEN_WETH_CONTRACT_ADDRESS=${fTokenBAYCWETH.address}\n`;
  fileData += `REACT_APP_${dataItem}`;
  docsFileData += dataItem;

  // Get and deploy debtToken contracts
  DebtToken = await ethers.getContractFactory('DebtToken');
  // If deployed
  // address = "0x53A460790552EB463C288cdbc89C512861673A66";
  // debtTokenBAYCWETH = await DebtToken.attach(address);
  // To deploy
  debtTokenBAYCWETH = await upgrades.deployProxy(DebtToken, [
      hhLendingPoolAddressesProviderAddress, 
      nftBAYC.address,
      assetTokenWETH.address,
      18,
      "BAYC-ETH-A Debt-Token",
      "DbaycETHa"
  ]);
  await debtTokenBAYCWETH.deployed();  
  console.log("debtTokenBAYCWETH deployed to:", debtTokenBAYCWETH.address);
  dataItem = `DEBT_TOKEN_WETH_CONTRACT_ADDRESS=${debtTokenBAYCWETH.address}\n`;
  fileData += `REACT_APP_${dataItem}`;
  docsFileData += dataItem;

  // Set Interest Rate Strategy
  const rateStrategyOne = {
    "name": "rateStrategyOne",
    "optimalUtilizationRate": ethers.utils.parseUnits('0.65', 27),
    "baseVariableBorrowRate": ethers.utils.parseUnits('0.03', 27),
    "variableRateSlope1": ethers.utils.parseUnits('0.08', 27),
    "variableRateSlope2": ethers.utils.parseUnits('1', 27),
  };
  InterestRateStrategy = await ethers.getContractFactory('InterestRateStrategy');
  // If deployed
  // address = "0xc1aec281f0329e8D24D97D578aa7D70B2f5F21B5";
  // hhInterestRateStrategy = await InterestRateStrategy.attach(address);
  // To deploy
  hhInterestRateStrategy = await InterestRateStrategy.deploy(
      rateStrategyOne["optimalUtilizationRate"],
      rateStrategyOne["baseVariableBorrowRate"],
      rateStrategyOne["variableRateSlope1"],
      rateStrategyOne["variableRateSlope2"]
  );
  await hhInterestRateStrategy.deployed();
  hhInterestRateStrategyAddress = await hhInterestRateStrategy.resolvedAddress;
  console.log("interestRateStrategy deployed to:", hhInterestRateStrategyAddress);
  dataItem = `INTEREST_RATE_STRATEGY_CONTRACT_ADDRESS=${hhInterestRateStrategyAddress}\n`;
  fileData += `REACT_APP_${dataItem}`;
  docsFileData += dataItem;

  // Initialize Reserves
  // WETH:
  await configurator.connect(admin).initLendingPoolReserve(
    nftBAYC.address,
    assetTokenWETH.address, 
    hhInterestRateStrategy.address,
    fTokenBAYCWETH.address, 
    debtTokenBAYCWETH.address, 
    "WETH",
    ethers.utils.parseUnits("30", 2), //30 x 10^2 = 3000 => 30% in percentageMaths 
  );
  console.log('Initialized Reserves');

  // Set NFT liquidation thresholds
  // await configurator.connect(admin).setCollateralManagerLiquidationThreshold(nftPUNK.address, 150); // in percent
  await configurator.connect(admin).setCollateralManagerLiquidationThreshold(nftBAYC.address, 150); // in percent

  // Whitelist NFT
  // await configurator.connect(admin).updateCollateralManagerWhitelist(nftPUNK.address, true);
  await configurator.connect(admin).updateCollateralManagerWhitelist(nftBAYC.address, true);

  // Set Mocked Oracle NFT prices
  let mockFloorPrice;
  // mockFloorPrice = ethers.utils.parseUnits('100', 18);
  // await lendingPool.setMockFloorPrice(nftPUNK.address, mockFloorPrice);
  mockFloorPrice = ethers.utils.parseUnits('130', 18);
  await configurator.connect(admin).setNFTPriceConsumerFloorPrice(nftBAYC.address, mockFloorPrice);
  let testFloorPrice = await nftPriceConsumer.getFloorPrice(nftBAYC.address);
  console.log('testFloorPrice:', testFloorPrice);

  // Writes fileData to interface ../interface/.env 
  await writeContractAddressesToFile(fileData, envFile);

  // Write out docs data if network == ropsten or rinkeby
  if (network.name=="ropsten" || network.name=="rinkeby") {
    await writeContractAddressesToFile(docsFileData, docsFile);
  }

  /* 
  
  2. Transfer Asset Tokens and NFTs to accounts 0, 1 and 2.
  */

  // Transfer funds to acc0, acc1 and acc2
  const accDict = {0: acc0, 1: acc1, 2: acc2, 3: admin}
  const tokenDict = {
    "WETH": assetTokenWETH.address
  }
  function swap(_dict){ 
    var ret = {};
    for(var key in _dict){
      ret[_dict[key]] = key;
    }
    return ret;
  }
  const inverseTokenDict = swap(tokenDict);

  async function transfer(accNum, token) {
    let transferAmount = assetTokenInitialBalance;
    if (inverseTokenDict[token.address]=="WETH") {
      transferAmount = assetTokenInitialBalanceWETH;
    }
    await token.connect(admin).transfer(accDict[accNum].address, transferAmount);
    console.log(`Transferred acc${accNum} (${accDict[accNum].address}) ${transferAmount/10**18} ${inverseTokenDict[token.address]} (${token.address})`)
    let balance = await token.balanceOf(accDict[accNum].address);
    console.log('balance:', balance);
  }
  await transfer(0, assetTokenWETH);
  await transfer(1, assetTokenWETH);
  await transfer(2, assetTokenWETH);


  // Mint NFTs to acc1 and acc2
  const nftDict = {"BAYC": nftBAYC} //"PUNK": nftPUNK, 
  async function mint(nftName, accNum, tokenId) {
    const nft = nftDict[nftName];
    const acc = accDict[accNum];
    await nft.mint(acc.address, tokenId);
    console.log(`${nftName} #${tokenId} minted to acc${accNum} (address: ${acc.address})`)
  }
  await mint("BAYC", 0, 0);
  await mint("BAYC", 0, 1);
  await mint("BAYC", 0, 2);
  await mint("BAYC", 0, 3);
  await mint("BAYC", 1, 4);
  await mint("BAYC", 1, 5); 
  await mint("BAYC", 1, 6); 
  await mint("BAYC", 1, 7); 
  await mint("BAYC", 2, 8); 
  await mint("BAYC", 2, 9); 
  await mint("BAYC", 2, 10); 
  await mint("BAYC", 2, 11); 
  
  // for(let i=97; i< 100; i++) {
  //   await mint("BAYC", 3, i); 
  // }

  /* 
  
  3. Create deposits and borrows (including defaulted borrows) from accounts 2 and 3.
  */

  // Deposits from Account 1
  let depositAmount; 
  depositAmount = hre.ethers.utils.parseEther("200.00");
  await assetTokenWETH.connect(acc1).approve(lendingPool.address, depositAmount);
  await lendingPool.connect(acc1).deposit(nftBAYC.address, assetTokenWETH.address, depositAmount, acc1.address, '1');

  // Deposits from Account 2
  depositAmount = hre.ethers.utils.parseEther("135");
  await assetTokenWETH.connect(acc2).approve(lendingPool.address, depositAmount);
  await lendingPool.connect(acc2).deposit(nftBAYC.address, assetTokenWETH.address, depositAmount, acc2.address, '12');

  // Deposit from admin
  depositAmount = hre.ethers.utils.parseEther("1000");
  await assetTokenWETH.connect(admin).approve(lendingPool.address, depositAmount);
  await lendingPool.connect(admin).deposit(nftBAYC.address, assetTokenWETH.address, depositAmount, admin.address, '123');


  /*
  4. Create borrows
  */
  console.log('Create Borrows');
  let borrowAmount; 
  borrowAmount = hre.ethers.utils.parseEther("85");
  for (let i=1; i< 2; i++) {
    console.log('borrow', i);
    await nftBAYC.connect(accDict[0]).approve(collateralManager.address, i);
    await lendingPool.connect(accDict[0]).borrow(
      assetTokenWETH.address,
      borrowAmount,
      nftBAYC.address,
      i,
      accDict[0].address,
      '91'
    )
  }

  borrowAmount = hre.ethers.utils.parseEther("85");
  for (let i=5; i< 6; i++) {
    console.log('borrow', i);
    await nftBAYC.connect(accDict[1]).approve(collateralManager.address, i);
    await lendingPool.connect(accDict[1]).borrow(
      assetTokenWETH.address,
      borrowAmount,
      nftBAYC.address,
      i,
      accDict[1].address,
      '92'
    )
    console.log('done');
  }

  borrowAmount = hre.ethers.utils.parseEther("85");
  for (let i=8; i< 10; i++) {
    console.log('borrow', i);
    await nftBAYC.connect(accDict[2]).approve(collateralManager.address, i);
    await lendingPool.connect(accDict[2]).borrow(
      assetTokenWETH.address,
      borrowAmount,
      nftBAYC.address,
      i,
      accDict[2].address,
      '93'
    )
    console.log('done');
  }

  /*
  5. Liquidations
    - 2x undercollateralized, not yet liquidiated
    - 2x liquidated, ready for bids 
    - 2x liquidated, to be redeemed 
  */
  console.log('Trigger Liquidations');
  mockFloorPrice = ethers.utils.parseUnits('100', 18);
  await configurator.connect(admin).setNFTPriceConsumerFloorPrice(nftBAYC.address, mockFloorPrice);

  // To be Liquidated
  let bidAmount; 
  bidAmount = ethers.utils.parseUnits('88', 18);
  await assetTokenWETH.connect(admin).approve(lendingPool.address, bidAmount);
  await lendingPool.connect(admin).bid(assetTokenWETH.address, bidAmount, 1);
  
  await assetTokenWETH.connect(admin).approve(lendingPool.address, bidAmount);
  await lendingPool.connect(admin).bid(assetTokenWETH.address, bidAmount, 2);

  // To be redeemed (assuming we are acc1)
  bidAmount = ethers.utils.parseUnits('88', 18);
  await assetTokenWETH.connect(admin).approve(lendingPool.address, bidAmount);
  await lendingPool.connect(admin).bid(assetTokenWETH.address, bidAmount, 3);

  await assetTokenWETH.connect(admin).approve(lendingPool.address, bidAmount);
  await lendingPool.connect(admin).bid(assetTokenWETH.address, bidAmount, 4);

  // Leaving Acc2s to be triggered for liquidation
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});