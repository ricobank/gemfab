const debug = require('debug')('gemfab:test')

const chai = require('chai')
chai.use(require('chai-as-promised'))
const want = chai.expect

const { ethers, artifacts, network } = require('hardhat')

import * as hre from 'hardhat'

const pkg = require('..')
debug(pkg)

async function send(...args) {
  const f = args[0];
  const fargs = args.slice(1);
  const tx = await f(...fargs);
  return await tx.wait()
}

async function fail(...args) {
  const err = args[0];
  const sargs = args.slice(1);
  await want(send(...sargs)).rejectedWith(
    `VM Exception while processing transaction: reverted with custom error '${err}'`
  );
}

describe('gemfab', ()=>{
  let ali, bob, cat;
  let ALI, BOB, CAT;
  let gem; let gem_type;
  let gemfab; let gemfab_type;
  before(async()=>{
    [ali, bob, cat] = await ethers.getSigners();
    [ALI, BOB, CAT] = [ali, bob, cat].map(signer => signer.address);
    gem_type = await ethers.getContractFactory('Gem', ali);
    gemfab_type = await ethers.getContractFactory('GemFab', ali);
  })
  beforeEach(async() => {
    gemfab = await gemfab_type.deploy();
    const gemaddr = await gemfab.callStatic.build("Mock Cash", "CASH");
    await send(gemfab.build, "Mock Cash", "CASH");
    gem = gem_type.attach(gemaddr);
  })

  it('fixture', async () => {
    await hre.deployments.fixture(['gemfab']);
    debug(Object.keys(hre.deployments));
  })

  it('mint ward', async () => {
    await send(gem.mint, ALI, 100);
    const bal = await gem.balanceOf(ALI);
    want(bal.toNumber()).equal(100)

    const gembob = gem.connect(bob);
    await fail('ErrWard("0x40c10f19")', gembob.mint, BOB, 100);
  })

});


