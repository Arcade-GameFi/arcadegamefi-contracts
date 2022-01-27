import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-etherscan";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-dependency-compiler";
import "hardhat-gas-reporter";
import * as dotenv from "dotenv";
dotenv.config();

const { pk } = require("./secrets.json");

const chainIds = {
  ganache: 1337,
  goerli: 5,
  hardhat: 31337,
  kovan: 42,
  mainnet: 1,
  avalanche: 43114,
  fuji: 43113,
  rinkeby: 4,
  ropsten: 3,
  bscTestnet: 97,
  bsc: 56,
  mumbai: 80001,
  polygon: 137,
  harmoneyMainnet: 1666600000,
  harmoneyTestnet: 1666700000,
};

const INFURA_API_KEY = process.env.INFURA_API_KEY;

const ETHERSCAN_KEY = process.env.ETHERSCAN_KEY;
const HARMONEYSCAN_KEY = process.env.HARMONEYSCAN_KEY;

const config = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      // blockGasLimit: 10000000,
      // forking: {
      //   url: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`
      // }
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${INFURA_API_KEY}`,
      chainId: chainIds.ropsten,
      accounts: [pk],
      gasMultiplier: 1.25
    },
    harmonyMainnet: {
      url: 'https://api.harmony.one',
      chainId: chainIds.harmoneyMainnet,
      accounts: [pk],
      gasMultiplier: 1.25
    },
    harmonyTestnet: {
      url: 'https://api.s0.b.hmny.io',
      chainId: chainIds.harmoneyTestnet,
      accounts: [pk],
      gasMultiplier: 1.25
    }
  },
  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_KEY,
      ropsten: ETHERSCAN_KEY
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.11",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  mocha: {
    timeout: 30000,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  dependencyCompiler: {
    // paths: [
    //   '@openzeppelin/contracts/token/ERC20/IERC20.sol',
    // ],
  },
};

export default config;
