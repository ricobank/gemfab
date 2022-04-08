import * as hh from 'hardhat'
import { ethers, artifacts, network } from 'hardhat'
import { want, send, fail, snapshot, revert } from 'minihat'
const { constants, BigNumber } = ethers

import { test1D, test2D } from './helpers'
import { bounds as _bounds } from './bounds'
const bounds = _bounds.gem
import { TypedDataUtils } from 'ethers-eip712'

const { expectEvent } = require('./ERC20/helpers')

const debug = require('debug')('gemfab:test')

const types = {
   Permit: [
      { name: 'owner',    type: 'address' },
      { name: 'spender',  type: 'address' },
      { name: 'value',    type: 'uint256' },
      { name: 'nonce',    type: 'uint256' },
      { name: 'deadline', type: 'uint256' }
    ]
};

const domain = {
    name: 'GemPermit',
    version: '0',
    chainId: undefined,
    verifyingContract: undefined
};

describe('gemfab', () => {
  let chainId;
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

    chainId = await hh.network.config.chainId;

    domain.chainId           = chainId;
    domain.verifyingContract = gem.address;

  })
  beforeEach(async () => {
    await revert(hh)
  })

  it('mint ward', async () => {
    await send(gem.mint, ALI, 100)
    const bal = await gem.balanceOf(ALI)
    want(bal.toNumber()).equal(100)

    const gembob = gem.connect(bob)
    await fail('ErrWard', gembob.mint, BOB, 100)
  })

  it('burn underflow', async () => {
      await send(gem.mint, ALI, 100);
      await send(gem.mint, BOB, 100); // totalSupply wont be cause of underflow
      await fail('ErrUnderflow', gem.burn, ALI, 101);
  });

  describe('coverage', () => {
    describe('mint', () => {
      it('overflow', async function () {
        await send(gem.mint, ALI, constants.MaxUint256.div(2));
        await send(gem.mint, BOB, constants.MaxUint256.div(2))
        await send(gem.mint, CAT, 1)
        await fail('ErrOverflow', gem.mint, CAT, 1);
      });
    });

    describe('approve', () => {
      it('nonzero', async function () {
        await send(gem.approve, BOB, 0);
        want((await gem.allowance(ALI, BOB)).toNumber()).to.equal(0);
        await send(gem.approve, BOB, 1);
        want((await gem.allowance(ALI, BOB)).toNumber()).to.equal(1);
      });
    });
  });

  describe(' gas cost', () => {
    async function check(gas, minGas, maxGas) {
      await want(gas.toNumber()).to.be.at.most(maxGas);
      if (gas.toNumber() < minGas) {
        console.log("gas reduction: previous min=", minGas, " gas used=", gas.toNumber());
      }
    }

    it('decimals', async () => { // checking constant vs immutable -- no difference
      const gas = await gem.estimateGas.decimals();
      await check(gas, bounds.decimals[0], bounds.decimals[1])
    });

    const NOP = async () => {
    }
    {
      const fill = async (prev, next) => {
        return send(gem.mint, ALI, next - prev)
      }
      const clear = async (prev, next) => {
        await send(gem.burn, ALI, prev - next)
      }
      const stay = async (prev) => {
        return fill(prev, prev)
      }
      test1D('mint', NOP, fill, clear, stay, 1, 2, bounds.mint)
    }

    {
      const fillDst = async (prev, next) => {
        await send(gem.mint, BOB, next - prev)
      }
      const fill = async (prev, next) => {
        await send(gem.mint, ALI, next - prev)
      }
      const clear = async (prev, next) => {
        return send(gem.transfer, BOB, prev - next)
      }
      const stay = async (prev) => {
        return clear(prev, prev)
      }
      test2D('transfer', NOP, fillDst, fill, clear, stay, 1, 2, bounds.transfer)
    }

    {
      const fillDst = async (prev, next) => {
        await send(gem.mint, BOB, next - prev)
      }
      const fill = async (prev, next) => {
        await send(gem.mint, ALI, next - prev)
      }
      const clear = (maxAllow) => async (prev, next) => {
        const max = constants.MaxUint256
        // approve is always nonzero->nonzero for now
        await send(gem.approve, BOB, maxAllow ? max : max.sub(1));
        // tx with msg.sender == bob to account for tokens that treat allowance(a, a) == inf
        return send(gem.connect(bob).transferFrom, ALI, BOB, prev - next)
      }
      const stay = async (prev) => {
        return send(gem.connect(bob).transferFrom, ALI, BOB, 0)
      }
      test2D(
        'transferFrom sub-max allowance', NOP, fillDst,
        fill, clear(false), stay,
        1, 2, bounds.transferFrom.notMaxAllowance
      )
      test2D(
        'transferFrom max allowance', NOP, fillDst,
        fill, clear(true), stay,
        1, 2, bounds.transferFrom.maxAllowance
      )
    }

    {
      const fill = async (prev, next) => {
        await send(gem.mint, ALI, next - prev)
      }
      const clear = async (prev, next) => {
        return send(gem.burn, ALI, prev - next)
      }
      const stay = async (prev) => {
        return clear(prev, prev)
      }
      test1D('burn', NOP, fill, clear, stay, 1, 2, bounds.burn)
    }

    {
      const fill = async (prev, next) => {
        return send(gem.approve, ALI, next)
      }
      const clear = fill
      const stay = async (prev) => {
        return fill(prev, prev)
      }
      test1D('approve', NOP, fill, clear, stay, 1, 2, bounds.approve)
    }

    {
      const deadline = Math.floor(Date.now() / 1000) * 2;
      const fill = async (prev, next) => {
        const value = {
          owner: ALI,
          spender: BOB,
          value: next,
          nonce: await gem.nonces(ALI),
          deadline: deadline
        };
        const signature = await ali._signTypedData(domain, types, value);
        const sig = ethers.utils.splitSignature(signature)

        return send(gem.permit, ALI, BOB, value.value, deadline, sig.v, sig.r, sig.s);
      }
      const clear = fill
      const stay = async (prev) => {
        return fill(prev, prev)
      }
      test1D('permit', NOP, fill, clear, stay, 1, 2, bounds.permit)
    }

    {
      const fill = async (prev, next) => {
        return send(gem.ward, BOB, next)
      }
      const clear = fill
      const stay = async (prev) => {
        return fill(prev, prev)
      }
      test1D('ward', NOP, fill, clear, stay, true, undefined, bounds.ward)
    }
  });

  describe('rely/deny', () => {
    it('rely/deny permissions', async function () {
      await fail('ErrWard', gem.connect(bob).ward, ALI, false);
      await fail('ErrWard', gem.connect(bob).ward, BOB, false);
      await fail('ErrWard', gem.connect(bob).ward, ALI, true);
      await fail('ErrWard', gem.connect(bob).ward, BOB, true);
      want(await gem.wards(ALI)).to.equal(true);
      await send(gem.ward, BOB, false);
      want(await gem.wards(ALI)).to.equal(true);
      want(await gem.wards(BOB)).to.equal(false);
      await send(gem.ward, BOB, true);
      want(await gem.wards(ALI)).to.equal(true);
      want(await gem.wards(BOB)).to.equal(true);
      await send(gem.ward, BOB, false);
      want(await gem.wards(ALI)).to.equal(true);
      want(await gem.wards(BOB)).to.equal(false);
      await send(gem.ward, ALI, false);
      //lockout
      want(await gem.wards(ALI)).to.equal(false);
      want(await gem.wards(BOB)).to.equal(false);
      await fail('ErrWard', gem.ward, ALI, true);
      await fail('ErrWard', gem.connect(bob).ward, ALI, true);
    });

    it('lockout example', async function () {
      await send(gem.mint, ALI, 1);
      await gem.connect(bob).ward(ALI, false).then((res) => {}, (err) => {});
      await send(gem.mint, ALI, 1);
    });

    it('burn', async function () {
      await send(gem.mint, ALI, 1);
      await fail('ErrWard', gem.connect(bob).burn, ALI, 1);
      await send(gem.ward, BOB, true);
      await send(gem.connect(bob).burn, ALI, 1);
    });

    it('mint', async function () {
      await fail('ErrWard', gem.connect(bob).burn, ALI, 1);
      await send(gem.ward, BOB, true);
      await send(gem.connect(bob).mint, ALI, 1);
    });

    it('public methods', async function () {
      const amt = 42;
      const nonce = 0;
      const deadline = Math.floor(Date.now() / 1000) * 2;
      const value = {
        owner:    ALI,
        spender:  BOB,
        value:    amt,
        nonce:    nonce,
        deadline: deadline
      };
      await send(gem.mint, ALI, 100);
      await send(gem.transfer, BOB, 100);
      const gembob = gem.connect(bob);

      // pass with bob denied
      await send(gem.ward, BOB, false);
      await send(gembob.transfer, ALI, 1);
      await send(gembob.approve, ALI, 1);
      await send(gembob.approve, BOB, 1);
      await send(gembob.transferFrom, BOB, ALI, 1);
      let signature = await ali._signTypedData(domain, types, value);
      let sig       = ethers.utils.splitSignature(signature)
      await send(gem.connect(bob).permit, ALI, BOB, amt, deadline, sig.v, sig.r, sig.s);

      // pass with bob relied
      await send(gem.ward, BOB, true);
      await send(gembob.transfer, ALI, 1);
      await send(gembob.approve, ALI, 1);
      await send(gembob.approve, BOB, 1);
      await send(gembob.transferFrom, BOB, ALI, 1);
      value.nonce++;
      signature = await ali._signTypedData(domain, types, value);
      sig       = ethers.utils.splitSignature(signature)
      await send(gem.connect(bob).permit, ALI, BOB, amt, deadline, sig.v, sig.r, sig.s);
    });

  });

  it('code doesnt change bc we dont use any immutable (in-code) vars', async()=>{
    const gem2addr = await gemfab.callStatic.build('other', 'OTHER')
    await send(gemfab.build, 'other', 'OTHER')
    const gem2 = gem_type.attach(gem2addr)
    const gem_code = await ethers.provider.getCode(gem.address);
    const gem2_code = await ethers.provider.getCode(gem2.address);
    want(gem_code).eq(gem2_code);
  })

  it('transferFrom emits anonymous caller event', async () => {
    await send(gem.mint, ALI, 1)
    await send(gem.approve, BOB, 1)
    const rx = await send(gem.connect(bob).transferFrom, ALI, BOB, 1)
    expectEvent(rx, undefined, [ethers.utils.hexZeroPad(BOB, 32).toLowerCase()], '0x')
  })
})
