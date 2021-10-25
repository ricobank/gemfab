import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'

import './task/deploy-gemfab'

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
export default {
  solidity: '0.8.9',
  defaultNetwork: 'hardhat',
  paths: {
    sources: "./sol"
  },
  networks: {
    hardhat: {},
  },
}
