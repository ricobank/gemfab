import '@nomiclabs/hardhat-ethers'
import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-truffle5";

import './task/deploy-gemfab'

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
export default {
  solidity: {
    version: '0.8.9',
    settings: {
      optimizer: {
        enabled: true,
        runs: 1 
      },
    },
  },
  paths: {
    sources: "./sol"
  },
}
