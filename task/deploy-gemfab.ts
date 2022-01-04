const debug = require('debug')('gemfab:task')

const dpack = require('dpack')

const { task } = require('hardhat/config')

task('deploy-gemfab', 'deploy GemFab')
  .setAction(async (args, hre) => {
    const { ethers, network } = hre

    const [acct] = await hre.ethers.getSigners()
    const deployer = acct.address

    debug(`Deploying contracts using ${deployer} to ${network.name}`)

    const GemArtifact = require('../artifacts/sol/gem.sol/Gem.json')
    const GemFabArtifact = require('../artifacts/sol/gem.sol/GemFab.json')
    const GemFabDeployer = ethers.ContractFactory.fromSolidity(GemFabArtifact, acct)
    const gf = await GemFabDeployer.deploy()
    await gf.deployed()
    debug('GemFab deployed to : ', gf.address)

    const pb = new dpack.PackBuilder(network.name)
    await pb.packType({
      typename: 'Gem',
      artifact: GemArtifact
    })
    await pb.packType({
      typename: 'GemFab',
      artifact: GemFabArtifact
    })
    await pb.packObject({
      objectname: 'gemfab',
      typename: 'GemFab',
      artifact: GemFabArtifact,
      address: gf.address
    })

    const pack = await pb.build()

    console.log(JSON.stringify(pack, null, 2))
    return pack
  })
