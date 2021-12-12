const debug = require('debug')('gemfab:task')
const fs = require('fs')

const { task } = require('hardhat/config')

task('deploy-gemfab', 'deploy GemFab')
  .addOptionalParam('outfile', 'output file to save export json (default: stdout)')
  .setAction(async (args, hre) => {
    if (args.outfile && fs.existsSync(args.outfile)) {
      console.error("Output file already exists, aborting")
      process.exit(1)
    }

    const { ethers, network } = hre

    const [acct] = await hre.ethers.getSigners()
    const deployer = acct.address

    debug(`Deploying contracts using ${deployer} to ${network.name}`)

    const GemArtifact = await hre.artifacts.readArtifact('Gem')
    const GemFabArtifact = await hre.artifacts.readArtifact('GemFab')
    const GemFabDeployer = await hre.ethers.getContractFactory('GemFab')
    const gf = await GemFabDeployer.deploy()
    await gf.deployed()
    debug('GemFab deployed to : ', gf.address)

    const out = {
      format: 'dpack-1',
      network: network.name,
      types: {},
      objects: {}
    }
    out.types['Gem'] = {
      typename: 'Gem',
      artifact: {"/": "<...>"}, //GemArtifact
    }
    out.types['GemFab'] = {
      typename: 'GemFab',
      artifact: {"/": "<...>"}, //GemFabArtifact
    }
    out.objects['gemfab'] = {
      name: 'gemfab',
      typename: 'GemFab',
      artifact: {"/": "<...>"}, //GemFabArtifact,
      address: gf.address
    }
    const json = JSON.stringify(out, null, 2)

    debug('WARN force writing file -- uprade to dpack later')
    if (args.outfile) {
      fs.writeFileSync(args.outfile, json)
    } else {
      console.log(json)
    }

    return out;
  })
