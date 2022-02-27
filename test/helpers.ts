import { constants, BigNumber, utils } from 'ethers'
import { chai, send, want } from 'minihat'
import {describe} from "mocha";

export { snapshot, revert, send, wad, ray, rad, apy, N, BANKYEAR, WAD, RAY, RAD, U256_MAX } from 'minihat'

const debug = require('debug')('rico:test')
const ramp_members = ['vel', 'rel', 'bel', 'cel']

export async function check_gas (gas, minGas, maxGas) {
  await want(gas.toNumber()).to.be.at.most(maxGas);
  if( gas.toNumber() < minGas ) {
    console.log("gas reduction: previous min=", minGas, " gas used=", gas.toNumber());
  }
}

//
// for move patterns
// verify takes previous dst value
export function test2D(
  name     : string,
  init     : () => void,
  fillDst  : (prev, next) => Promise<any>,
  fill     : (prev, next) => Promise<any>,
  clear    : (prev, next) => Promise<any>,
  stay     : (prev) => Promise<any>,
  one      : Buffer | boolean | BigNumber | number,
  two      : Buffer | boolean | BigNumber | number,
  bounds   : object,
  verify?  : (dstPrev) => (srcPrev, srcNext) => Promise<void>
) {
  let ZERO : any
  if( Buffer.isBuffer(one) ) {
    ZERO = Buffer.from('00'.repeat(32), 'hex')
  } else if( typeof(one) == 'boolean' ) {
    ZERO = false
  } else if( BigNumber.isBigNumber(one) ) {
    ZERO = constants.Zero
  } else if( typeof(one) == 'number' ) {
    ZERO = 0
  }

  const makeTests = (subTest, next) => {
    const initAndFill = async () => {
      await init()
      await fillDst(ZERO, next)
    }
    const testName = name + ' dst at ' + subTest
    if( verify ) {
      test1D(testName, initAndFill, fill, clear, stay, one, two, bounds[subTest], verify(next))
    } else {
      test1D(testName, initAndFill, fill, clear, stay, one, two, bounds[subTest])
    }
  }

  makeTests(0, constants.Zero)
  makeTests(1, one)
  makeTests(2, two)
}


// generate 1d tests
// takes three functions that manipulate state
// fill: increase value by one
// clear: decrease value by one
// stay: keep value the same, using the method being profiled
// fill, clear and stay should return undefined if they don't use the method being tested
// verify: verify the new src and dst values
export function test1D(
  name  : string,
  init  : () => void,
  fill  : (prev, next) => Promise<any>,
  clear : (prev, next) => Promise<any>,
  stay  : (prev) => Promise<any>,
  one   : Buffer | boolean | BigNumber | number,
  two   : Buffer | boolean | BigNumber | number,
  bounds : object,
  verify? : (srcPrev, srcNext) => Promise<void>
) {
  function assert_def(gas) {
    chai.assert(
      gas != undefined,
      "Testing fill/clear/stay, but it returned undefined.  This test can be removed."
    )
  }
  describe(name, () => {
    let ZERO : any
    if( Buffer.isBuffer(one) ) {
      ZERO = Buffer.from('00'.repeat(32), 'hex')
    } else if( typeof(one) == 'boolean' ) {
      ZERO = false
    } else if( BigNumber.isBigNumber(one) ) {
      ZERO = constants.Zero
    } else if( typeof(one) == 'number' ) {
      ZERO = 0
    }
    //let ZERO = typeof(one) == 'boolean' ? false : typeof(one) == 'Buffer' ? Buffer.from(0)
    //  : BigNumber.from(0)
    beforeEach(init)
    describe('no change', () => {
      if( bounds[0] != undefined && bounds[0][0] != undefined ) {
        it('0->0', async () => {
          const tx = await stay(ZERO)
          assert_def(tx)
          const gas = tx.gasUsed
          if( verify ) await verify(ZERO, ZERO)
          const bound = bounds[0][0]
          await check_gas(gas, bound[0], bound[1])
        })
      }
      if( bounds[1] != undefined && bounds[1][1] != undefined ) {
        it('1->1', async () => {
          await fill(ZERO, one)
          const tx = await stay(one)
          assert_def(tx)
          if( verify ) await verify(one, one)
          const gas = tx.gasUsed
          const bound = bounds[1][1]
          await check_gas(gas, bound[0], bound[1])
        })
      }
    })
    describe('change', () => {
      if( bounds[0] != undefined && bounds[0][1] != undefined ) {
        it('0->1', async () => {
          const tx = await fill(ZERO, one)
          assert_def(tx)
          const gas = tx.gasUsed
          if( verify ) await verify(ZERO, one)
          const bound = bounds[0][1]
          await check_gas(gas, bound[0], bound[1])
        })
      }
      if( bounds[1] != undefined && bounds[1][0] != undefined ) {
        it('1->0', async () => {
          await fill(ZERO, one)
          const tx = await clear(one, ZERO)
          assert_def(tx)
          const gas = tx.gasUsed
          if( verify ) await verify(one, ZERO)
          const bound = bounds[1][0]
          await check_gas(gas, bound[0], bound[1])
        })
      }
      if( bounds[1] != undefined && bounds[1][2] != undefined ) {
        it('1->2', async () => {
          // 1->2 invalid for bools
          want(one).to.not.be.a('boolean')
          await fill(ZERO, one)
          const tx = await fill(one, two)
          assert_def(tx)
          const gas = tx.gasUsed
          if( verify ) await verify(one, two)
          const bound = bounds[1][2]
          await check_gas(gas, bound[0], bound[1])
        })
      }
      if( bounds[2] != undefined && bounds[2][1] != undefined ) {
        it('2->1', async () => {
          // 1->2 invalid for bools
          want(one).to.not.be.a('boolean')
          await fill(ZERO, two)
          const tx = await clear(two, one)
          assert_def(tx)
          const gas = tx.gasUsed
          if( verify ) await verify(two, one)
          const bound = bounds[2][1]
          await check_gas(gas, bound[0], bound[1])
        })
      }
    })
  })
}
