const fs = require('fs')

const { task } = require('hardhat/config')
const { PackBuilder } = require('/Users/code/dpack')

task('deploy-gemfab', 'deploy GemFab')
.addParam('outfile', 'output file to save dpack (or use /dev/stdout to pipe)')
.setAction(async (args, hre) => {
  const { ethers, network } = hre

  const [acct] = await hre.ethers.getSigners()
  const deployer = acct.address

  console.log(`Deploying contracts using ${deployer} to ${network.name}`)

  const GemArtifact = await hre.artifacts.readArtifact('Gem')
  const GemFabArtifact = await hre.artifacts.readArtifact('GemFab')
  const GemFabDeployer = await hre.ethers.getContractFactory('GemFab')
  const gf = await GemFabDeployer.deploy()
  await gf.deployed()

  const pb = new PackBuilder(network.name);

  pb.addType({
    typename: 'Gem',
    artifact: GemArtifact
  });
  pb.addType({
    typename: 'GemFab',
    artifact: GemFabArtifact
  })

  pb.addObject({
    objectname: 'gemfab',
    address: gf.address,
    typename: 'GemFab',
    artifact: GemFabArtifact
  })

  const pack = await pb.pack();
  const json = JSON.stringify(pack, null, 2)

  fs.writeFileSync(args.outfile, json)
})
