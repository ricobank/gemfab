import * as hh from 'hardhat'
import { ethers, artifacts, network } from 'hardhat'
import { want, send, fail, snapshot, revert } from 'minihat'

import { TypedDataUtils } from 'ethers-eip712'



const debug = require('debug')('gemfab:test')

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

  describe('gas cost', () => {
    let gas, maxGas, minGas;
    afterEach(async () => {
      await want(gas.toNumber()).to.be.at.most(maxGas);
      if( gas.toNumber() < minGas ) {
        console.log("gas reduction: previous min=", minGas, " gas used=", gas.toNumber());
      }
    });

    it('mint 0', async() => {
      gas    = await gem.estimateGas.mint(ALI, 0);
      maxGas = 31416;
      minGas = 31416;
    })

    it('mint', async () => {
      gas    = await gem.estimateGas.mint(ALI, 100);
      maxGas = 70985;
      minGas = 70985;
    });

    it('transfer', async () => {
      const amt = 100;
      await gem.mint(ALI, amt);
      gas = await gem.estimateGas.transfer(BOB, amt);
      maxGas = 52117;
      minGas = 52117;
    });

    describe('transferFrom', () => {
      it('allowance < UINT256_MAX', async () => {
        const amt = 100;
        await gem.mint(ALI, amt);
        await gem.approve(BOB, amt);
        gas    = await gem.connect(bob).estimateGas.transferFrom(ALI, BOB, amt);
        maxGas = 58539;
        minGas = 58539;
      });

      it('allowance == UINT256_MAX', async () => {
        const amt = Buffer.from('ff'.repeat(32), 'hex');
        await gem.mint(ALI, amt);
        await gem.approve(BOB, amt);
        gas    = await gem.connect(bob).estimateGas.transferFrom(ALI, BOB, amt);
        maxGas = 55556;
        minGas = 55556;
      });
    });

    it('burn', async () => {
        const amt = 100;
        await gem.mint(ALI, amt);
        gas = await gem.estimateGas.burn(ALI, amt);
        maxGas = 36708;
        minGas = 36708;
    });

    it('approve', async () => {
        const amt = 100;
        await gem.mint(ALI, amt);
        gas    = await gem.estimateGas.approve(BOB, amt);
        maxGas = 46693;
        minGas = 46693;
    });

    it('permit', async () => {
      const amt = 42;
      const nonce = 0;
      const deadline = Math.floor(Date.now() / 1000) * 2;

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
          chainId: chainId,
          verifyingContract: gem.address
      };
      const value = {
        owner:    ALI,
        spender:  BOB,
        value:    amt,
        nonce:    nonce,
        deadline: deadline
      };

      const signature = await ali._signTypedData(domain, types, value);
      const sig       = ethers.utils.splitSignature(signature)

      gas = await gem.connect(ali).estimateGas.permit(ALI, BOB, amt, deadline, sig.v, sig.r, sig.s);
      maxGas = 76821; // ? variable sig size?
      minGas = 76797;
    });
  });
})
