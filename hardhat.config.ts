import '@nomiclabs/hardhat-ethers'
import './task/deploy-gemfab'
import { HardhatUserConfig } from 'hardhat/types';

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
 const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.13',
    settings: {
      metadata: {
        bytecodeHash: 'none',
      },
      optimizer: {
        enabled: true,
        runs: 2_000,
        details: {
          yul: true,
        },
      },
    },
  },
  paths: {
    sources: './sol',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
};
export default config;
