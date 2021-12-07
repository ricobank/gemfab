import * as hh from 'hardhat'
import { ethers, artifacts, network } from 'hardhat'
import { want, send, fail, snapshot, revert } from 'minihat'
const { constants, BigNumber } = ethers

import { TypedDataUtils } from 'ethers-eip712'

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

    chainId = await hh.web3.eth.getChainId();

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
    await fail('ErrAuth', gembob.mint, BOB, 100)
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

  describe('gas cost', () => {
    async function check (gas, minGas, maxGas) {
      await want(gas.toNumber()).to.be.at.most(maxGas);
      if( gas.toNumber() < minGas ) {
        console.log("gas reduction: previous min=", minGas, " gas used=", gas.toNumber());
      }
    }

    it('mint 0', async() => {
      const gas = await gem.estimateGas.mint(ALI, 0);
      await check(gas, 30935, 30935);
    })

    it('mint', async () => {
      const gas = await gem.estimateGas.mint(ALI, 100);
      await check(gas, 70272, 70272);
    });

    it('transfer', async () => {
      const amt = 100;
      await gem.mint(ALI, amt);
      const gas = await gem.estimateGas.transfer(BOB, amt);
      await check(gas, 51428, 51428);
    });

    describe('transferFrom', () => {
      it('allowance < UINT256_MAX', async () => {
        const amt = 100;
        await gem.mint(ALI, amt);
        await gem.approve(BOB, amt);
        const gas = await gem.connect(bob).estimateGas.transferFrom(ALI, BOB, amt);
        await check(gas, 57016, 57016);
      });

      it('allowance == UINT256_MAX', async () => {
        const amt = Buffer.from('ff'.repeat(32), 'hex');
        await gem.mint(ALI, amt);
        await gem.approve(BOB, amt);
        const gas = await gem.connect(bob).estimateGas.transferFrom(ALI, BOB, amt);
        await check(gas, 54501, 54501);
      });
    });

    it('burn', async () => {
        const amt = 1;
        await gem.mint(ALI, amt);
        const gas = await gem.estimateGas.burn(ALI, amt);
        await check(gas, 36157, 36157);
    });

    it('approve', async () => {
        const amt = 100;
        await gem.mint(ALI, amt);
        const gas = await gem.estimateGas.approve(BOB, amt);
        await check(gas, 46093, 46093);
    });

    it('permit', async () => {
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

      const signature = await ali._signTypedData(domain, types, value);
      const sig       = ethers.utils.splitSignature(signature)

      const gas = await gem.connect(ali).estimateGas.permit(ALI, BOB, amt, deadline, sig.v, sig.r, sig.s);
      await check(gas, 74078, 74090); // ? variable sig size?
    });

    it('rely', async () => {
      const gas = await gem.estimateGas.rely(BOB);
      await check(gas, 48009, 48009);
    });

    it('deny', async () => {
      await send(gem.rely, BOB);
      const gas = await gem.estimateGas.deny(BOB);
      await check(gas, 30992, 30992);
    });
  });

  describe('rely/deny', () => {
    it('deny permissions', async function () {
      await fail('ErrAuth', gem.connect(bob).deny, ALI);
      await fail('ErrAuth', gem.connect(bob).deny, BOB);
      want(await gem.wards(ALI)).to.equal(true);
      await send(gem.deny, BOB);
      want(await gem.wards(ALI)).to.equal(true);
      want(await gem.wards(BOB)).to.equal(false);
      await send(gem.rely, BOB);
      want(await gem.wards(ALI)).to.equal(true);
      want(await gem.wards(BOB)).to.equal(true);
      await send(gem.deny, BOB);
      want(await gem.wards(ALI)).to.equal(true);
      want(await gem.wards(BOB)).to.equal(false);
      await send(gem.deny, ALI);
      //lockout
      want(await gem.wards(ALI)).to.equal(false);
      want(await gem.wards(BOB)).to.equal(false);
      await fail('ErrAuth', gem.rely, ALI);
      await fail('ErrAuth', gem.connect(bob).rely, ALI);
    });

    it('lockout example', async function () {
      await send(gem.mint, ALI, 1);
      await gem.connect(bob).deny(ALI).then((res) => {}, (err) => {});
      await send(gem.mint, ALI, 1);
    });

    it('burn', async function () {
      await send(gem.mint, ALI, 1);
      await fail('ErrAuth', gem.connect(bob).burn, ALI, 1);
      await send(gem.rely, BOB);
      await send(gem.connect(bob).burn, ALI, 1);
    });

    it('mint', async function () {
      await fail('ErrAuth', gem.connect(bob).burn, ALI, 1);
      await send(gem.rely, BOB);
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
      await send(gem.deny, BOB);
      await send(gembob.transfer, ALI, 1);
      await send(gembob.approve, ALI, 1);
      await send(gembob.approve, BOB, 1);
      await send(gembob.transferFrom, BOB, ALI, 1);
      let signature = await ali._signTypedData(domain, types, value);
      let sig       = ethers.utils.splitSignature(signature)
      await send(gem.connect(bob).permit, ALI, BOB, amt, deadline, sig.v, sig.r, sig.s);

      // pass with bob relied
      await send(gem.rely, BOB);
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

})
