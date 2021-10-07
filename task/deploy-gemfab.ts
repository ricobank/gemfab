const debug = require('debug')('gemfab:task')

const dpack = require('dpack')

const { task } = require('hardhat/config')

task('deploy-gemfab', 'deploy GemFab')
  .addParam('dpack', 'output path for dpack')
  .setAction(async (args, hre) => {
    const { ethers, network } = hre

    const [acct] = await hre.ethers.getSigners()
    const deployer = acct.address

    console.log(`Deploying contracts using ${deployer} to ${network.name}`)

    await dpack.initPackFile(args.dpack)

    let gf

    await dpack.mutatePackFile(args.dpack, args.dpack, async (mutator: any) => {
      const GemFabDeployer = await hre.ethers.getContractFactory('GemFab')
      gf = await GemFabDeployer.deploy()
      await gf.deployed()
      console.log('GemFab deployed to : ', gf.address)
      const GemFabArtifact = await hre.artifacts.readArtifact('GemFab')

      await mutator.addType(GemFabArtifact)
      await mutator.addObject(
        'gemfab',
        gf.address,
        network.name,
        GemFabArtifact
      )

      const GemArtifact = await hre.artifacts.readArtifact('Gem');
      await mutator.addType(GemArtifact);
    })
  })

export {}
