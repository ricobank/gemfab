import '@nomiclabs/hardhat-ethers'
import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-truffle5";

import './task/deploy-gemfab'

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
export default {
  paths: {
    sources: "./sol"
  },
  solidity: {
    version: '0.8.10',
    settings: {
      metadata: {
        bytecodeHash: 'none',
      },
      optimizer: {
        enabled: true,
        runs: 20000
      }
    }
  }
}
