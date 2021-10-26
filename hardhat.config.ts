import '@nomiclabs/hardhat-ethers'

import './task/deploy-gemfab'

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
export default {
  solidity: '0.8.9',
  paths: {
    sources: "./sol"
  },
}
