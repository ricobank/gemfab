const debug = require('debug')('gemfab:test')

const { ethers, artifacts, network } = require('hardhat')

import { want, send, failRevert } from 'minihat'

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

  it('mint ward', async () => {
    await send(gem.mint, ALI, 100);
    const bal = await gem.balanceOf(ALI);
    want(bal.toNumber()).equal(100)

    const gembob = gem.connect(bob);
    await failRevert('ErrWard("0x40c10f19")', gembob.mint, BOB, 100);
  })

});


