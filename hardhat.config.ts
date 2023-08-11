import '@nomiclabs/hardhat-ethers'

import './task/deploy-gemfab'

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
export default {
  paths: {
    sources: "./src"
  },
  solidity: {
    version: '0.8.19',
    settings: {
      optimizer: {
        enabled: true,
        runs: 20000
      },
    }
  },
  networks: {
      arbitrum_goerli: {
          url: process.env["ARB_GOERLI_RPC_URL"],
          accounts: {
            mnemonic: process.env["ARB_GOERLI_MNEMONIC"]
          },
          chainId: 421613
      },
      arbitrum: {
          url: process.env["ARB_RPC_URL"],
          accounts: {
            mnemonic: process.env["ARB_MNEMONIC"]
          },
          chainId: 42161
      }
  }
}
