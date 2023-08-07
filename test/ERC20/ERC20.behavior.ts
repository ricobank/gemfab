// modified version of openzeppelin-contracts ERC20.behavior.js
//   https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/test/token/ERC20/ERC20.behavior.js
//
// The MIT License (MIT)
// Copyright (c) 2016-2020 zOS Global Limited
// https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/LICENSE

const { expect } = require('chai');
const expectRevert = async (f, msg) => { await expect(f).rejectedWith(msg) }
const { expectEvent } = require('./helpers')
import {BigNumber, constants} from 'ethers'

function shouldBehaveLikeERC20 (errorPrefix, initialSupply, _initialHolder, _recipient, _anotherAccount) {
  {
    let initialHolder, recipient, anotherAccount
    beforeEach(async function () {
      initialHolder  = await _initialHolder
      recipient      = await _recipient
      anotherAccount = await _anotherAccount
    })

    describe('total supply', function () {
      it('returns the total amount of tokens', async function () {
        expect(await this.token.totalSupply()).to.eql(initialSupply);
      });
    });

    describe('balanceOf', function () {
      describe('when the requested account has no tokens', function () {
        it('returns zero', async function () {
          expect(await this.token.balanceOf(anotherAccount.address)).to.eql(constants.Zero);
        });
      });

      describe('when the requested account has some tokens', function () {
        it('returns the total amount of tokens', async function () {
          expect(await this.token.balanceOf(initialHolder.address)).to.eql(initialSupply);
        });
      });
    });

    describe('transfer', function () {
      shouldBehaveLikeERC20Transfer(errorPrefix, _initialHolder, _recipient, initialSupply,
          function (from, to, value) {
            return this.token.connect(from).transfer(to.address, value);
          },
      );
    });

    describe('transfer from', function () {
      let spender;
      beforeEach(async function () {
        spender = await _recipient
      })

      describe('when the token owner is not the zero address', function () {
        let tokenOwner
        beforeEach(async function () {
          tokenOwner = await _initialHolder
        })

        describe('when the recipient is not the zero address', function () {
          let to
          beforeEach(async function () {
            to = await _anotherAccount
          })

          describe('when the spender has enough approved balance', function () {
            beforeEach(async function () {
              await this.token.connect(initialHolder).approve(spender.address, initialSupply);
            });

            describe('when the token owner has enough balance', function () {
              const amount = initialSupply;

              it('transfers the requested amount', async function () {
                await this.token.connect(spender).transferFrom(tokenOwner.address, to.address, amount);

                expect(await this.token.balanceOf(tokenOwner.address)).to.eql(constants.Zero);

                expect(await this.token.balanceOf(to.address)).to.eql(amount);
              });

              it('decreases the spender allowance', async function () {
                await this.token.connect(spender).transferFrom(tokenOwner.address, to.address, amount);

                expect(await this.token.allowance(tokenOwner.address, spender.address)).to.eql(constants.Zero);
              });

              it('emits a transfer event', async function () {
                const tx = await this.token.connect(spender).transferFrom(tokenOwner.address, to.address, amount);
                const rx = await tx.wait()

                expectEvent(rx, 'Transfer', {
                  src: tokenOwner.address,
                  dst: to.address,
                  wad: amount,
                });
              });

              it('emits an approval event', async function () {
                const tx = await this.token.connect(spender).transferFrom(tokenOwner.address, to.address, amount);
                const rx = await tx.wait()

                expectEvent(rx, 'Approval', {
                  src: tokenOwner.address,
                  usr: spender.address,
                  wad: await this.token.allowance(tokenOwner.address, spender.address),
                });
              });
            });

            describe('when the token owner does not have enough balance', function () {
              const amount = initialSupply.add(1);

              it('reverts', async function () {
                await expectRevert(this.token.connect(spender).transferFrom(
                    tokenOwner.address, to.address, amount), `ErrUnderflow`,
                );
              });
            });
          });

          describe('when the spender does not have enough approved balance', function () {
            beforeEach(async function () {
              await this.token.connect(tokenOwner).approve(spender.address, initialSupply.sub(1));
            });

            describe('when the token owner has enough balance', function () {
              const amount = initialSupply;

              it('reverts', async function () {
                await expectRevert(this.token.connect(spender).transferFrom(
                    tokenOwner.address, to.address, amount), `ErrUnderflow`,
                );
              });
            });

            describe('when the token owner does not have enough balance', function () {
              const amount = initialSupply.add(1);

              it('reverts', async function () {
                await expectRevert(this.token.connect(spender).transferFrom(
                    tokenOwner.address, to.address, amount), `ErrUnderflow`,
                );
              });
            });
          });
        });

        /*
        describe('when the recipient is the zero address', function () {
          const amount = initialSupply;
          const to = ZERO_ADDRESS;

          beforeEach(async function () {
            await this.token.approve(spender, amount, { from: tokenOwner });
          });

          it('reverts', async function () {
            await expectRevert(this.token.transferFrom(
              tokenOwner, to, amount, { from: spender }), `${errorPrefix}: transfer to the zero address`,
            );
          });
        });
        */
      });

      /*
      describe('when the token owner is the zero address', function () {
        const amount = 0;
        const tokenOwner = ZERO_ADDRESS;
        const to = recipient;

        it('reverts', async function () {
          await expectRevert(this.token.transferFrom(
            tokenOwner, to, amount, { from: spender }), `${errorPrefix}: transfer from the zero address`,
          );
        });
      });
      */
    });

    describe('approve', function () {
      shouldBehaveLikeERC20Approve(errorPrefix, _initialHolder, _recipient, initialSupply,
          function (owner, spender, amount) {
            return this.token.connect(owner).approve(spender.address, amount);
          },
      );
    });
  }
}

function shouldBehaveLikeERC20Transfer (errorPrefix, _from, _to, balance, transfer) {
  {
    let from, to
    beforeEach(async function () {
      from = await _from
      to   = await _to
    })

    describe('when the recipient is not the zero address', function () {
      describe('when the sender does not have enough balance', function () {
        const amount = balance.add(1);

        it('reverts', async function () {
          await expectRevert(transfer.call(this, from, to, amount), `ErrUnderflow`,
          );
        });
      });

      describe('when the sender transfers all balance', function () {
        const amount = balance;

        it('transfers the requested amount', async function () {
          await transfer.call(this, from, to, amount);

          expect(await this.token.balanceOf(from.address)).to.eql(constants.Zero);

          expect(await this.token.balanceOf(to.address)).to.eql(amount);
        });

        it('emits a transfer event', async function () {
          const tx = await transfer.call(this, from, to, amount);
          const rx = await tx.wait()

          expectEvent(rx, 'Transfer', {
            src: from.address,
            dst: to.address,
            wad: amount,
          });
        });
      });

      describe('when the sender transfers zero tokens', function () {
        const amount = constants.Zero;

        it('transfers the requested amount', async function () {
          await transfer.call(this, from, to, amount);

          expect(await this.token.balanceOf(from.address)).to.eql(balance);

          expect(await this.token.balanceOf(to.address)).to.eql(constants.Zero);
        });

        it('emits a transfer event', async function () {
          const tx = await transfer.call(this, from, to, amount);
          const rx = await tx.wait()

          expectEvent(rx, 'Transfer', {
            src: from.address,
            dst: to.address,
            wad: amount,
          });
        });
      });
    });
  }

  /*
  describe('when the recipient is the zero address', function () {
    it('reverts', async function () {
      await expectRevert(transfer.call(this, from, ZERO_ADDRESS, balance),
        `${errorPrefix}: transfer to the zero address`,
      );
    });
  });
  */
}

function shouldBehaveLikeERC20Approve (errorPrefix, _owner, _spender, supply, approve) {
  {
    let owner, spender
    beforeEach(async function () {
      owner   = await _owner
      spender = await _spender
    })

    describe('when the spender is not the zero address', function () {
      describe('when the sender has enough balance', function () {
        const amount = supply;

        it('emits an approval event', async function () {
          const tx = await approve.call(this, owner, spender, amount);
          const rx = await tx.wait()

          expectEvent(rx, 'Approval', {
            src: owner.address,
            usr: spender.address,
            wad: amount,
          });
        });

        describe('when there was no approved amount before', function () {
          it('approves the requested amount', async function () {
            await approve.call(this, owner, spender, amount);

            expect(await this.token.allowance(owner.address, spender.address)).to.eql(amount);
          });
        });

        describe('when the spender had an approved amount', function () {
          beforeEach(async function () {
            await approve.call(this, owner, spender, BigNumber.from(1));
          });

          it('approves the requested amount and replaces the previous one', async function () {
            await approve.call(this, owner, spender, amount);

            expect(await this.token.allowance(owner.address, spender.address)).to.eql(amount);
          });
        });
      });

      describe('when the sender does not have enough balance', function () {
        const amount = supply.add(1);

        it('emits an approval event', async function () {
          const tx = await approve.call(this, owner, spender, amount);
          const rx = await tx.wait()

          expectEvent(rx, 'Approval', {
            src: owner.address,
            usr: spender.address,
            wad: amount,
          });
        });

        describe('when there was no approved amount before', function () {
          it('approves the requested amount', async function () {
            await approve.call(this, owner, spender, amount);

            expect(await this.token.allowance(owner.address, spender.address)).to.eql(amount);
          });
        });

        describe('when the spender had an approved amount', function () {
          beforeEach(async function () {
            await approve.call(this, owner, spender, constants.One);
          });

          it('approves the requested amount and replaces the previous one', async function () {
            await approve.call(this, owner, spender, amount);

            expect(await this.token.allowance(owner.address, spender.address)).to.eql(amount);
          });
        });
      });
    });
  }

  /*
  describe('when the spender is the zero address', function () {
    it('reverts', async function () {
      await expectRevert(approve.call(this, owner, ZERO_ADDRESS, supply),
        `${errorPrefix}: approve to the zero address`,
      );
    });
  });
  */
}

module.exports = {
  shouldBehaveLikeERC20,
  shouldBehaveLikeERC20Transfer,
  shouldBehaveLikeERC20Approve,
};
