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

  describe('gas cost', () => {
    async function check (gas, minGas, maxGas) {
      await want(gas.toNumber()).to.be.at.most(maxGas);
      if( gas.toNumber() < minGas ) {
        console.log("gas reduction: previous min=", minGas, " gas used=", gas.toNumber());
      }
    }

    describe('mint', () => {
      describe('change', () => {
        it('zero to nonzero', async () => {
          const gas = await gem.estimateGas.mint(ALI, 1);
          await check(gas, 70293, 70293);
        })

        it('nonzero to nonzero', async () => {
          await send(gem.mint, ALI, 1);
          const gas = await gem.estimateGas.mint(ALI, 1);
          await check(gas, 36093, 36093);
        });
      })

      describe('no change', () => {
        it('no change zero', async () => {
          const gas = await gem.estimateGas.mint(ALI, 0);
          await check(gas, 30957, 30957);
        })

        it('no change nonzero', async () => {
          await send(gem.mint, ALI, 1);
          const gas = await gem.estimateGas.mint(ALI, 0);
          await check(gas, 30957, 30957);
        })
      })
    });

    describe('transfer ali->bob', () => {
      describe('change', () => {
        // change 00
        it('nonzero to zero ali, zero to nonzero bob', async () => {
          await send(gem.mint, ALI, 1);
          const gas = await gem.estimateGas.transfer(BOB, 1);
          await check(gas, 51350, 51350);
        })
        // change 01
        it('nonzero to zero ali, nonzero to nonzero bob', async () => {
          await send(gem.mint, ALI, 1);
          await send(gem.mint, BOB, 1);
          const gas = await gem.estimateGas.transfer(BOB, 1);
          await check(gas, 34204, 34204);
        })
        // change 10
        it('nonzero to nonzero ali, zero to nonzero bob', async () => {
          await send(gem.mint, ALI, 2);
          const gas = await gem.estimateGas.transfer(BOB, 1);
          await check(gas, 51088, 51088);
        })
        // change 11
        it('nonzero to nonzero ali, nonzero to nonzero bob', async () => {
          await send(gem.mint, ALI, 2);
          await send(gem.mint, BOB, 1);
          const gas = await gem.estimateGas.transfer(BOB, 1);
          await check(gas, 33988, 33988);
        })
      })

      describe('no change', () => {
        // 00
        it('zero ali, zero bob', async () => {
          const gas = await gem.estimateGas.transfer(BOB, 0);
          await check(gas, 28708, 28708);
        })
        // 01
        it('zero ali, nonzero bob', async () => {
          await send(gem.mint, BOB, 1);
          const gas = await gem.estimateGas.transfer(BOB, 0);
          await check(gas, 28708, 28708);
        })
        // 10
        it('nonzero ali, zero bob', async () => {
          await send(gem.mint, ALI, 1);
          const gas = await gem.estimateGas.transfer(BOB, 0);
          await check(gas, 28708, 28708);
        })
        // 11
        it('nonzero ali, nonzero bob', async () => {
          await send(gem.mint, ALI, 1);
          await send(gem.mint, BOB, 1);
          const gas = await gem.estimateGas.transfer(BOB, 0);
          await check(gas, 28708, 28708);
        })
      })
    })

    describe('transferFrom ali->bob', () => {
      describe('allowance < UINT256_MAX', () => {
        describe('change', () => {
          const allowance = 1;
          // 00
          it('nonzero to zero ali, zero to nonzero bob', async () => {
            await send(gem.mint, ALI, 1);
            await send(gem.approve, BOB, allowance);
            const gas = await gem.connect(bob).estimateGas.transferFrom(ALI, BOB, 1);
            await check(gas, 56907, 56907);
          })
          // 01
          it('nonzero to zero ali, nonzero to nonzero bob', async () => {
            await send(gem.mint, ALI, 1);
            await send(gem.mint, BOB, 1);
            await send(gem.approve, BOB, allowance);
            const gas = await gem.connect(bob).estimateGas.transferFrom(ALI, BOB, 1);
            await check(gas, 39800, 39800);
          })
          // 10
          it('nonzero to nonzero ali, zero to nonzero bob', async () => {
            await send(gem.mint, ALI, 2);
            await send(gem.approve, BOB, allowance);
            const gas = await gem.connect(bob).estimateGas.transferFrom(ALI, BOB, 1);
            await check(gas, 56984, 56984);
          })
          // 11
          it('nonzero to nonzero ali, nonzero to nonzero bob', async () => {
            await send(gem.mint, ALI, 2);
            await send(gem.mint, BOB, 1);
            await send(gem.approve, BOB, allowance);
            const gas = await gem.connect(bob).estimateGas.transferFrom(ALI, BOB, 1);
            await check(gas, 39921, 39921);
          })
        })
      })
      describe('allowance == UINT256_MAX', () => {
        describe('change', () => {
          const allowance = Buffer.from('ff'.repeat(32), 'hex');
          // 00
          it('nonzero to zero ali, zero to nonzero bob', async () => {
            await send(gem.mint, ALI, 1);
            await send(gem.approve, BOB, allowance);
            const gas = await gem.connect(bob).estimateGas.transferFrom(ALI, BOB, 1);
            await check(gas, 53991, 53991);
          })
          // 01
          it('nonzero to zero ali, nonzero to nonzero bob', async () => {
            await send(gem.mint, ALI, 1);
            await send(gem.mint, BOB, 1);
            await send(gem.approve, BOB, allowance);
            const gas = await gem.connect(bob).estimateGas.transferFrom(ALI, BOB, 1);
            await check(gas, 36900, 36900);
          })
          // 10
          it('nonzero to nonzero ali, zero to nonzero bob', async () => {
            await send(gem.mint, ALI, 2);
            await send(gem.approve, BOB, allowance);
            const gas = await gem.connect(bob).estimateGas.transferFrom(ALI, BOB, 1);
            await check(gas, 53814, 53814);
          })
          // 11
          it('nonzero to nonzero ali, nonzero to nonzero bob', async () => {
            await send(gem.mint, ALI, 2);
            await send(gem.mint, BOB, 1);
            await send(gem.approve, BOB, allowance);
            const gas = await gem.connect(bob).estimateGas.transferFrom(ALI, BOB, 1);
            await check(gas, 36714, 36714);
          })
        })
      })
    });

    describe('burn', () => {
      describe('change', () => {
        it('nonzero to zero', async () => {
          await send(gem.mint, ALI, 1);
          const gas = await gem.estimateGas.burn(ALI, 1);
          await check(gas, 36093, 36093);
        })
        it('nonzero to nonzero', async () => {
          await send(gem.mint, ALI, 2);
          const gas = await gem.estimateGas.burn(ALI, 1);
          await check(gas, 36093, 36093);
        })
      })
      describe('no change', () => {
        it('nonzero to nonzero', async () => {
          await send(gem.mint, ALI, 1);
          const gas = await gem.estimateGas.burn(ALI, 0);
          await check(gas, 30957, 30957);
        })
        it('zero to zero', async () => {
          const gas = await gem.estimateGas.burn(ALI, 0);
          await check(gas, 30957, 30957);
        })
      })
    });

    describe('approve', () => {
      describe('change', () => {
        it('zero to nonzero', async () => {
          const gas = await gem.estimateGas.approve(BOB, 1);
          await check(gas, 46069, 46069);
        })
        it('nonzero to zero', async () => {
          await send(gem.approve, BOB, 1);
          const gas = await gem.estimateGas.approve(BOB, 0);
          await check(gas, 29063, 29063);
        })
        it('nonzero to nonzero', async () => {
          await send(gem.approve, BOB, 1);
          const gas = await gem.estimateGas.approve(BOB, 2);
          await check(gas, 28969, 28969);
        })
      })
      describe('no change', () => {
        it('zero to zero', async () => {
          const gas = await gem.estimateGas.approve(BOB, 0);
          await check(gas, 26157, 26157);
        })
        it('nonzero to nonzero', async () => {
          await send(gem.approve, BOB, 1);
          const gas = await gem.estimateGas.approve(BOB, 1);
          await check(gas, 26169, 26169);
        })
      })
    });

    describe('permit', () => {
      const nonce    = 0;
      const deadline = Math.floor(Date.now() / 1000) * 2;
      let   value;
      before(async () => {
        value = {
          owner: ALI,
          spender: BOB,
          value: undefined,
          nonce: nonce,
          deadline: deadline
        };
      })

      async function doPermit() : Promise<number> {
        const signature = await ali._signTypedData(domain, types, value);
        const sig       = ethers.utils.splitSignature(signature)

        return await gem.estimateGas.permit(ALI, BOB, value.value, deadline, sig.v, sig.r, sig.s);
      }

      describe('change', () => {
        it('zero to nonzero', async () => {
          value.value = 1;
          const gas   = await doPermit();
          await check(gas, 73947, 73971); // ? variable sig size?
        });
        it('nonzero to zero', async () => {
          await send(gem.approve, BOB, 1)
          value.value = 0;
          const gas   = await doPermit();
          await check(gas, 56913, 56939); // ? variable sig size?
        });
        it('nonzero to nonzero', async () => {
          await send(gem.approve, BOB, 1)
          value.value = 2;
          const gas   = await doPermit();
          await check(gas, 56859, 56871); // ? variable sig size?
        });
      })
      describe('no change', () => {
        it('zero to zero', async () => {
          value.value = 0;
          const gas   = await doPermit();
          await check(gas, 54035, 54059); // ? variable sig size?
        });
        it('nonzero to nonzero', async () => {
          await send(gem.approve, BOB, 1);
          value.value = 1;
          const gas   = await doPermit();
          await check(gas, 54047, 54071); // ? variable sig size?
        });
      })
    })

    describe('rely', () => {
      it('change', async () => {
        const gas = await gem.estimateGas.ward(BOB, true);
        await check(gas, 48214, 48214);
      })
      it('no change', async () => {
        await send(gem.ward, BOB, true);
        const gas = await gem.estimateGas.ward(BOB, true);
        await check(gas, 28756, 28756);
      })
    });

    describe('deny', () => {
      it('change', async () => {
        await send(gem.ward, BOB, true);
        const gas = await gem.estimateGas.ward(BOB, false);
        await check(gas, 31233, 31233);
      })
      it('no change', async () => {
        const gas = await gem.estimateGas.ward(BOB, false);
        await check(gas, 28744, 28744);
      })
    });
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

})
