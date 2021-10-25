const debug = require('debug')('gemfab:task')

const { task } = require('hardhat/config')

task('deploy-gemfab', 'deploy GemFab')
  .addOptionalParam('outfile', 'output file to save export json')
  .setAction(async (args, hre) => {
    const { ethers, network } = hre

    const [acct] = await hre.ethers.getSigners()
    const deployer = acct.address

    debug(`Deploying contracts using ${deployer} to ${network.name}`)

    const GemArtifact = require('../artifacts/sol/gem.sol/Gem.json')//await hre.artifacts.readArtifact('Gem')
    const GemFabArtifact = require('../artifacts/sol/gem.sol/GemFab.json')//await hre.artifacts.readArtifact('GemFab')
    const GemFabDeployer = new hre.ethers.ContractFactory(GemFabArtifact.abi, GemFabArtifact.bytecode, acct)//await hre.ethers.getContractFactory('GemFab')
    const gf = await GemFabDeployer.deploy()
    await gf.deployed()
    debug('GemFab deployed to : ', gf.address)

    const out = { types: {}, objects: {} }
    out.types['Gem'] = {
      typename: 'Gem',
      artifact: GemArtifact
    }
    out.types['GemFab'] = {
      typename: 'GemFab',
      artifact: GemFabArtifact
    }
    out.objects['gemfab'] = {
      name: 'gemfab',
      typename: 'GemFab',
      artifact: GemFabArtifact,
      address: gf.address
    }
    const json = JSON.stringify(out)

    debug('WARN force writing file -- uprade to dpack later')
    if (args.outfile) {
      const fs = require('fs')
      fs.writeFileSync(args.outfile, json)
    } else {
      console.log(json)
    }
  })
