const debug = require('debug')('gemfab:task')

const dpack = require('@etherpacks/dpack')

const { task } = require('hardhat/config')

task('deploy-gemfab', 'deploy GemFab')
  .addFlag('stdout', 'print the dpack to stdout')
  .addOptionalParam('writepack', 'save the pack')
  .addOptionalParam('gasLimit', 'gemfab deploy tx gas limit')
  .setAction(async (args, hre) => {
    const { ethers, network } = hre

    const [acct] = await hre.ethers.getSigners()
    const deployer = acct.address

    debug(`Deploying contracts using ${deployer} to ${network.name}`)

    const GemArtifact = require('../artifacts/src/gem.sol/Gem.json')
    const GemFabArtifact = require('../artifacts/src/gem.sol/GemFab.json')
    const GemFabDeployer = ethers.ContractFactory.fromSolidity(GemFabArtifact, acct)
    const gf = await GemFabDeployer.deploy({gasLimit: args.gasLimit})
    await gf.deployed()
    debug('GemFab deployed to : ', gf.address)

    const pb = new dpack.PackBuilder(network.name)
    await pb.packObject({
      objectname: 'gemfab',
      typename: 'GemFab',
      artifact: GemFabArtifact,
      address: gf.address
    }, true) // alsoPackType
    await pb.packType({
      typename: 'Gem',
      artifact: GemArtifact
    })

    const pack = await pb.build()
    const str = JSON.stringify(pack, null, 2)
    if (args.stdout) {
        console.log(str)
    }
    if (args.writepack) {
        const outfile = require('path').join(
            __dirname, `../pack/gemfab_${hre.network.name}.dpack.json`
        )
        const packstr = JSON.stringify(pack, null, 2)
        require('fs').writeFileSync(outfile, packstr)
    }
    return pack
  })
