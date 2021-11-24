// modified version of openzeppelin-contracts ERC20.test.js
//   https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/test/token/ERC20/ERC20.test.js
//
// The MIT License (MIT)
// Copyright (c) 2016-2020 zOS Global Limited
// https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/LICENSE

const { BN, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { ZERO_ADDRESS } = constants;

const {
  shouldBehaveLikeERC20,
  shouldBehaveLikeERC20Transfer,
  shouldBehaveLikeERC20Approve,
} = require('./ERC20.behavior');

const Gem    = artifacts.require('Gem');
const GemFab = artifacts.require('GemFab');
//const ERC20DecimalsMock = artifacts.require('ERC20DecimalsMock');
//
async function decreaseAllowance (token, ali, bob, amount) {
  const allowance = await token.allowance(ali, bob);
  const { logs }  = await token.approve(bob, allowance.sub(amount), { from: ali });
  return { logs };
}

async function increaseAllowance (token, ali, bob, amount) {
  const allowance = await token.allowance(ali, bob);
  const { logs }  = await token.approve(bob, allowance.add(amount), { from: ali });
  return { logs };
}

contract('ERC20', function (accounts) {
  const [ initialHolder, recipient, anotherAccount ] = accounts;

  const name = 'Gem';
  const symbol = 'GEM';

  const initialSupply = new BN(1000);

  beforeEach(async function () {
    //this.token = await Gem.new(name, symbol, initialHolder, initialSupply);
    this.token = await Gem.new(name, symbol, {from:initialHolder});
    await this.token.mint(initialHolder, initialSupply);
  });

  it('has a name', async function () {
    expect(await this.token.name()).to.equal(name);
  });

  it('has a symbol', async function () {
    expect(await this.token.symbol()).to.equal(symbol);
  });

  it('has 18 decimals', async function () {
    expect(await this.token.decimals()).to.be.bignumber.equal('18');
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

  shouldBehaveLikeERC20('ERC20', initialSupply, initialHolder, recipient, anotherAccount);

  describe('decrease allowance', function () {
    describe('when the spender is not the zero address', function () {
      const spender = recipient;


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
            ({ logs: this.logs } = await this.token.approve(spender, approvedAmount));
          });

          it('emits an approval event', async function () {
            const { logs } = await decreaseAllowance(this.token, initialHolder, spender, approvedAmount);

            expectEvent.inLogs(logs, 'Approval', {
              src: initialHolder,
              usr: spender,
              wad: new BN(0),
            });
          });

          it('decreases the spender allowance subtracting the requested amount', async function () {
            await decreaseAllowance(this.token, initialHolder, spender, approvedAmount.subn(1));

            expect(await this.token.allowance(initialHolder, spender)).to.be.bignumber.equal('1');
          });

          it('sets the allowance to zero when all allowance is removed', async function () {
            await decreaseAllowance(this.token, initialHolder, spender, approvedAmount);
            expect(await this.token.allowance(initialHolder, spender)).to.be.bignumber.equal('0');
          });

          /* // no decreaseAllowance contract method
          it('reverts when more than the full allowance is removed', async function () {
            await expectRevert(
              decreaseAllowance(this.token, initialHolder, spender, approvedAmount.addn(1), { from: initialHolder }),
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
        const amount = initialSupply.addn(1);

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
      const spender = recipient;

      describe('when the sender has enough balance', function () {
        it('emits an approval event', async function () {
          const { logs } = await increaseAllowance(this.token, initialHolder, spender, amount);

          expectEvent.inLogs(logs, 'Approval', {
            src: initialHolder,
            usr: spender,
            wad: amount,
          });
        });

        describe('when there was no approved amount before', function () {
          it('approves the requested amount', async function () {
            await increaseAllowance(this.token, initialHolder, spender, amount);

            expect(await this.token.allowance(initialHolder, spender)).to.be.bignumber.equal(amount);
          });
        });

        describe('when the spender had an approved amount', function () {
          beforeEach(async function () {
            await this.token.approve(spender, new BN(1), { from: initialHolder });
          });

          it('increases the spender allowance adding the requested amount', async function () {
            await increaseAllowance(this.token, initialHolder, spender, amount);

            expect(await this.token.allowance(initialHolder, spender)).to.be.bignumber.equal(amount.addn(1));
          });
        });
      });

      describe('when the sender does not have enough balance', function () {
        const amount = initialSupply.addn(1);

        it('emits an approval event', async function () {
          const { logs } = await increaseAllowance(this.token, initialHolder, spender, amount);

          expectEvent.inLogs(logs, 'Approval', {
            src: initialHolder,
            usr: spender,
            wad: amount,
          });
        });

        describe('when there was no approved amount before', function () {
          it('approves the requested amount', async function () {
            await increaseAllowance(this.token, initialHolder, spender, amount);

            expect(await this.token.allowance(initialHolder, spender)).to.be.bignumber.equal(amount);
          });
        });

        describe('when the spender had an approved amount', function () {
          beforeEach(async function () {
            await this.token.approve(spender, new BN(1), { from: initialHolder });
          });

          it('increases the spender allowance adding the requested amount', async function () {
            await increaseAllowance(this.token, initialHolder, spender, amount);

            expect(await this.token.allowance(initialHolder, spender)).to.be.bignumber.equal(amount.addn(1));
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
    const amount = new BN(50);
    /* // null checks not part of spec
    it('rejects a null account', async function () {
      await expectRevert(
        this.token.mint(ZERO_ADDRESS, amount), 'VM Exception while processing transaction: revert unimplemented',
      );
    });
    */

    describe('for a non zero account', function () {
      beforeEach('minting', async function () {
        const { logs } = await this.token.mint(recipient, amount);
        this.logs = logs;
      });

      it('increments totalSupply', async function () {
        const expectedSupply = initialSupply.add(amount);
        expect(await this.token.totalSupply()).to.be.bignumber.equal(expectedSupply);
      });

      it('increments recipient balance', async function () {
        expect(await this.token.balanceOf(recipient)).to.be.bignumber.equal(amount);
      });

      it('emits Transfer event', async function () {
        const event = expectEvent.inLogs(this.logs, 'Transfer', {
          src: ZERO_ADDRESS,
          dst: recipient,
        });

        expect(event.args.wad).to.be.bignumber.equal(amount);
      });
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
          initialHolder, initialSupply.addn(1)), 'ErrUnderflow',
        );
      });

      const describeBurn = function (description, amount) {
        describe(description, function () {
          beforeEach('burning', async function () {
            const { logs } = await this.token.burn(initialHolder, amount, {from: initialHolder});
            this.logs = logs;
          });

          it('decrements totalSupply', async function () {
            const expectedSupply = initialSupply.sub(amount);
            expect(await this.token.totalSupply()).to.be.bignumber.equal(expectedSupply);
          });

          it('decrements initialHolder balance', async function () {
            const expectedBalance = initialSupply.sub(amount);
            expect(await this.token.balanceOf(initialHolder)).to.be.bignumber.equal(expectedBalance);
          });

          it('emits Transfer event', async function () {
            const event = expectEvent.inLogs(this.logs, 'Transfer', {
              src: initialHolder,
              dst: ZERO_ADDRESS,
            });

            expect(event.args.wad).to.be.bignumber.equal(amount);
          });
        });
      };

      describeBurn('for entire balance', initialSupply);
      describeBurn('for less amount than balance', initialSupply.subn(1));
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
