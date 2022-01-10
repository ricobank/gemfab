import '@nomiclabs/hardhat-ethers'

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
      optimizer: {
        enabled: true,
        runs: 20000
      }
    }
  }
}
