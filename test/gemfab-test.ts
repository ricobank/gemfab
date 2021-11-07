import * as hh from 'hardhat'
import { ethers, artifacts, network } from 'hardhat'
import { want, send, fail, snapshot, revert } from 'minihat'

const debug = require('debug')('gemfab:test')

describe('gemfab', () => {
  let ali, bob, cat
  let ALI, BOB, CAT
  let gem; let gem_type
  let gemfab; let gemfab_type
  before(async () => {
    [ali, bob, cat] = await ethers.getSigners();
    [ALI, BOB, CAT] = [ali, bob, cat].map(signer => signer.address)
    gem_type = await ethers.getContractFactory('Gem', ali)
    gemfab_type = await ethers.getContractFactory('GemFab', ali)

    gemfab = await gemfab_type.deploy()
    const gemaddr = await gemfab.callStatic.build('Mock Cash', 'CASH')
    await send(gemfab.build, 'Mock Cash', 'CASH')
    gem = gem_type.attach(gemaddr)

    await snapshot(hh)
  })
  beforeEach(async () => {
    await revert(hh)
  })

  it('mint ward', async () => {
    await send(gem.mint, ALI, 100)
    const bal = await gem.balanceOf(ALI)
    want(bal.toNumber()).equal(100)

    const gembob = gem.connect(bob)
    await fail('ErrAuth', gembob.mint, BOB, 100)
  })
})
