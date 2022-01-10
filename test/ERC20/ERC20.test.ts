// modified version of openzeppelin-contracts ERC20.test.js
//   https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/test/token/ERC20/ERC20.test.js
//
// The MIT License (MIT)
// Copyright (c) 2016-2020 zOS Global Limited
// https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/LICENSE

import {ethers} from "hardhat";
import * as hh from "hardhat";
import {snapshot, revert, send} from 'minihat'
import {Signer, constants} from "ethers";

const { expectEvent } = require('./helpers')
const { expect } = require('chai');
const expectRevert = async (f, msg) => { await expect(f).rejectedWith(msg) }
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const { BigNumber } = ethers

const {
  shouldBehaveLikeERC20,
  shouldBehaveLikeERC20Transfer,
  shouldBehaveLikeERC20Approve,
} = require('./ERC20.behavior');

//const Gem    = artifacts.require('Gem');
//const GemFab = artifacts.require('GemFab');
//const ERC20DecimalsMock = artifacts.require('ERC20DecimalsMock');
//
async function decreaseAllowance (token, ali, bob, amount) {
  const allowance = await token.allowance(ali.address, bob.address);
  const tx = await token.connect(ali).approve(bob.address, allowance.sub(amount));
  return tx;
}

async function increaseAllowance (token, ali, bob, amount) {
  const allowance = await token.allowance(ali.address, bob.address);
  const tx = await token.connect(ali).approve(bob.address, allowance.add(amount));
  return tx;
}

let _initialHolder, _recipient, _anotherAccount : Promise<Signer>;
let initialHolder, recipient, anotherAccount : Signer;

describe('ERC20', () => {

  const name = 'Gem';
  const symbol = 'GEM';

  const initialSupply = BigNumber.from(1000);

  let gem;
  let gem_type
  let gemfab;
  let gemfab_type
  const signers   = ethers.getSigners();
  _initialHolder  = signers.then((s) => {return s[0]})
  _recipient      = signers.then((s) => {return s[1]})
  _anotherAccount = signers.then((s) => {return s[2]})
  before(async function () {
    //[initialHolder, recipient, anotherAccount] = [ali, bob, cat].map(signer => signer.address)
    initialHolder  = await _initialHolder
    recipient      = await _recipient
    anotherAccount = await _anotherAccount

    const ali = initialHolder
    gem_type = await ethers.getContractFactory('Gem', ali)
    gemfab_type = await ethers.getContractFactory('GemFab', ali)

    gemfab = await gemfab_type.deploy()
    const gemaddr = await gemfab.callStatic.build(name, symbol)
    await send(gemfab.build, name, symbol)
    gem = gem_type.attach(gemaddr)

    await snapshot(hh)
  })


  beforeEach(async function () {
    await revert(hh)
    this.token = gem;
    await this.token.mint(initialHolder.address, initialSupply);
  });

  it('has a name', async function () {
    expect(await this.token.name()).to.equal(name);
  });

  it('has a symbol', async function () {
    expect(await this.token.symbol()).to.equal(symbol);
  });

  it('has 18 decimals', async function () {
    expect(await this.token.decimals()).to.equal(18);
  });

    /*
  describe('set decimals', function () {
    const decimals = new BN(6);

    it('can set decimals during construction', async function () {
      const token = await ERC20DecimalsMock.new(name, symbol, decimals);
      expect(await token.decimals()).to.be.bignumber.equal(decimals);
    });
  });
  */

  shouldBehaveLikeERC20('ERC20', initialSupply, _initialHolder, _recipient, _anotherAccount);

  describe('decrease allowance', function () {
    describe('when the spender is not the zero address', function () {
      let spender;
      beforeEach(async function () {
        spender = await _recipient
      })

      function shouldDecreaseApproval (amount) {
        /* // no decreaseAllowance contract method
        describe('when there was no approved amount before', function () {
          it('reverts', async function () {
            await expectRevert(decreaseAllowance(this.token, initialHolder, spender, amount), 'GEM/allowance underflow.',
            );
          });
        });
        */

        describe('when the spender had an approved amount', function () {
          const approvedAmount = amount;

          beforeEach(async function () {
            ({ logs: this.logs } = await this.token.approve(spender.address, approvedAmount));
          });

          it('emits an approval event', async function () {
            const tx = await decreaseAllowance(this.token, initialHolder, spender, approvedAmount);
            const rx = await tx.wait()

            expectEvent(rx, 'Approval', {
              src: initialHolder.address,
              usr: spender.address,
              wad: constants.Zero,
            });
          });

          it('decreases the spender allowance subtracting the requested amount', async function () {
            await decreaseAllowance(this.token, initialHolder, spender, approvedAmount.sub(1));

            expect(await this.token.allowance(initialHolder.address, spender.address)).to.eql(constants.One);
          });

          it('sets the allowance to zero when all allowance is removed', async function () {
            await decreaseAllowance(this.token, initialHolder, spender, approvedAmount);
            expect(await this.token.allowance(initialHolder.address, spender.address)).to.eql(constants.Zero);
          });

          /* // no decreaseAllowance contract method
          it('reverts when more than the full allowance is removed', async function () {
            await expectRevert(
              decreaseAllowance(this.token, initialHolder, spender, approvedAmount.add(1), { from: initialHolder }),
              'Reverted, check reason',
            );
          });
          */
        });
      }

      describe('when the sender has enough balance', function () {
        const amount = initialSupply;

        shouldDecreaseApproval(amount);
      });

      describe('when the sender does not have enough balance', function () {
        const amount = initialSupply.add(1);

        shouldDecreaseApproval(amount);
      });
    });

    /* // null checks not part of spec
    describe('when the spender is the zero address', function () {
      const amount = initialSupply;
      const spender = ZERO_ADDRESS;

      it('reverts', async function () {
        await expectRevert(decreaseAllowance(
          this.token, initialHolder, spender, amount), 'Reverted, check reason',
        );
      });
    });
    */
  });

  describe('increase allowance', function () {
    const amount = initialSupply;

    describe('when the spender is not the zero address', function () {
      let spender
      beforeEach(async function () {
        spender = await _recipient
      })

      describe('when the sender has enough balance', function () {
        it('emits an approval event', async function () {
          const tx = await increaseAllowance(this.token, initialHolder, spender, amount);
          const rx = await tx.wait()

          expectEvent(rx, 'Approval', {
            src: initialHolder.address,
            usr: spender.address,
            wad: amount,
          });
        });

        describe('when there was no approved amount before', function () {
          it('approves the requested amount', async function () {
            await increaseAllowance(this.token, initialHolder, spender, amount);

            expect(await this.token.allowance(initialHolder.address, spender.address)).to.eql(amount);
          });
        });

        describe('when the spender had an approved amount', function () {
          beforeEach(async function () {
            await this.token.connect(initialHolder).approve(spender.address, constants.One);
          });

          it('increases the spender allowance adding the requested amount', async function () {
            await increaseAllowance(this.token, initialHolder, spender, amount);

            expect(await this.token.allowance(initialHolder.address, spender.address)).to.eql(amount.add(1));
          });
        });
      });

      describe('when the sender does not have enough balance', function () {
        const amount = initialSupply.add(1);

        it('emits an approval event', async function () {
          const tx = await increaseAllowance(this.token, initialHolder, spender, amount);
          const rx = await tx.wait()

          expectEvent(rx, 'Approval', {
            src: initialHolder.address,
            usr: spender.address,
            wad: amount,
          });
        });

        describe('when there was no approved amount before', function () {
          it('approves the requested amount', async function () {
            await increaseAllowance(this.token, initialHolder, spender, amount);

            expect(await this.token.allowance(initialHolder.address, spender.address)).to.eql(amount);
          });
        });

        describe('when the spender had an approved amount', function () {
          beforeEach(async function () {
            await this.token.connect(initialHolder).approve(spender.address, constants.One);
          });

          it('increases the spender allowance adding the requested amount', async function () {
            await increaseAllowance(this.token, initialHolder, spender, amount);

            expect(await this.token.allowance(initialHolder.address, spender.address)).to.eql(amount.add(1));
          });
        });
      });
    });

    /* // null checks not part of spec
    describe('when the spender is the zero address', function () {
      const spender = ZERO_ADDRESS;

      it('reverts', async function () {
        await expectRevert(
          increaseAllowance(this.token, initialHolder, spender, amount), 'ERC20: approve to the zero address',
        );
      });
    });
    */
  });

  describe('_mint', function () {
    const amount = BigNumber.from(50);
    /* // null checks not part of spec
    it('rejects a null account', async function () {
      await expectRevert(
        this.token.mint(ZERO_ADDRESS, amount), 'VM Exception while processing transaction: revert unimplemented',
      );
    });
    */

    describe('for a non zero account', function () {
      beforeEach('minting', async function () {
        const tx = await this.token.mint(recipient.address, amount);
        this.rx = await tx.wait();
      });

      it('increments totalSupply', async function () {
        const expectedSupply = initialSupply.add(amount);
        expect(await this.token.totalSupply()).to.eql(expectedSupply);
      });

      it('increments recipient balance', async function () {
        expect(await this.token.balanceOf(recipient.address)).to.eql(amount);
      });

      it('emits Mint event', async function () {
        const event = expectEvent(this.rx, 'Mint', {
          caller: initialHolder.address,
          user: recipient.address,
          wad: amount
        });

        //expect(event.args.wad).to.eql(amount);
      });

/*
      it('emits Transfer event', async function () {
        const event = expectEvent(this.rx, 'Transfer', {
          src: ZERO_ADDRESS,
          dst: recipient,
        });

        expect(event.args.wad).to.be.bignumber.equal(amount);
      });
*/
    });
  });

  describe('_burn', function () {
    /* // null checks not part of spec
    it('rejects a null account', async function () {
      await expectRevert(this.token.burn(ZERO_ADDRESS, new BN(1)),
        'ERC20: burn from the zero address');
    });
    */

    describe('for a non zero account', function () {
      it('rejects burning more than balance', async function () {
        await expectRevert(this.token.burn(
          initialHolder.address, initialSupply.add(1)), 'ErrUnderflow',
        );
      });

      const describeBurn = function (description, amount) {
        describe(description, function () {
          beforeEach('burning', async function () {
            const tx = await this.token.connect(initialHolder).burn(initialHolder.address, amount);
            this.rx = await tx.wait();
          });

          it('decrements totalSupply', async function () {
            const expectedSupply = initialSupply.sub(amount);
            expect(await this.token.totalSupply()).to.eql(expectedSupply);
          });

          it('decrements initialHolder balance', async function () {
            const expectedBalance = initialSupply.sub(amount);
            expect(await this.token.balanceOf(initialHolder.address)).to.be.eql(expectedBalance);
          });

          it('emits Burn event', async function () {
            const event = expectEvent(this.rx, 'Burn', {
              caller: initialHolder.address,
              user: initialHolder.address,
              wad: amount
            });

            //expect(event.args.wad).to.eql(amount);
          });
/*
          it('emits Transfer event', async function () {
            const event = expectEvent(this.rx, 'Transfer', {
              src: initialHolder,
              dst: ZERO_ADDRESS,
            });

            expect(event.args.wad).to.be.bignumber.equal(amount);
          });
*/
        });
      };

      describeBurn('for entire balance', initialSupply);
      describeBurn('for less amount than balance', initialSupply.sub(1));
    });
  });

  /*
  describe('_transfer', function () {
    shouldBehaveLikeERC20Transfer('ERC20', initialHolder, recipient, initialSupply, function (from, to, amount) {
      return this.token.transferInternal(from, to, amount, {from: initialHolder});
    });

    describe('when the sender is the zero address', function () {
      it('reverts', async function () {
        await expectRevert(this.token.transferInternal(ZERO_ADDRESS, recipient, initialSupply),
          'ERC20: transfer from the zero address',
        );
      });
    });
  });
  */

  /*
  describe('_approve', function () {
    shouldBehaveLikeERC20Approve('ERC20', initialHolder, recipient, initialSupply, function (owner, spender, amount) {
      return this.token.approveInternal(owner, spender, amount, {from: initialHolder});
    });

    describe('when the owner is the zero address', function () {
      it('reverts', async function () {
        await expectRevert(this.token.approveInternal(ZERO_ADDRESS, recipient, initialSupply),
          'ERC20: approve from the zero address',
        );
      });
    });
  });
  */
});
