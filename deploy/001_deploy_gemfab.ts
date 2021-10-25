import { HardhatRuntimeEnvironment } from 'hardhat/types'

export default async function deploy (hre: HardhatRuntimeEnvironment) {
  const deploy = hre.deployments.deploy
  const [ALI] = await hre.getUnnamedAccounts()
  await deploy('gemfab', {
    from: ALI,
    contract: 'GemFab',
    log: true
  })
}
