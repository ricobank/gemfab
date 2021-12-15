// investigation of potential issues from awesome-buggy-erc20-tokens
// issues taken from:
// https://github.com/sec-bit/awesome-buggy-erc20-tokens/blob/master/ERC20_token_issue_list.md
// commit: 3e86725136585a33b5315ce1bd455f1062661005

import * as hh from 'hardhat'
import { ethers, artifacts, network } from 'hardhat'
import { want, send, fail, snapshot, revert } from 'minihat'
const { constants, BigNumber } = ethers

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


describe('erc20-common-issues', () => {
  let chainId;
  let ali, bob, cat
  let ALI, BOB, CAT
  let gem;
  let gem_type
  let gemfab;
  let gemfab_type
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

  // A1. batchTransfer-overflow
  //   N/A (no batch transfer)
  // A2. totalSupply-overflow
  //   gemfab->coverage->mint->overflow
  // A3. verify-invalid-by-overflow
  //   burn
  //     N/A (uses underflow checks instead)
  // A4. owner-control-sell-price-for-overflow
  //   N/A (no price mechanics)
  // A5. owner-overweight-token-by-overflow
  //   mint
  //     N/A (no subtraction)
  //   burn
  //     gemfab->burn underflow
  // A6. owner-decrease-balance-by-mint-overflow
  //   gemfab->coverage->mint->overflow
  //     checks totalSupply overflow
  //     balance is always <= totalSupply
  //       assume at start of call sum(balances) <= totalSupply
  //       mint
  //         balance' = balance + wad
  //         totalSupply' = totalSupply + wad
  //         balance <= totalSupply --> balance + wad <= totalSupply + wad
  //         totalSupply ErrOverflow check
  //         --> sum(balances') = sum(balances) + wad <= totalSupply + wad = totalSupply'
  //       burn
  //         balance' = balance - wad
  //         totalSupply' = totalSupply - wad
  //         balance <= totalSupply --> balance - wad < totalSupply - wad
  //         balance ErrUnderflow check
  //         --> sum(balances') = sum(balances) - wad <= totalSupply - wad = totalSupply'
  //       transfer
  //         balance[src]' = balance[src] - wad
  //         balance[dst]' = balance[dst] + wad
  //         totalSupply' = totalSupply
  //         sum(balances') = sum(balances) - balance[src] + balance[src]' - balance[dst] + balance[dst]'
  //                        = sum(balances) - wad + wad = sum(balances)
  //         --> sum(balances') < totalSupply'
  //       transferFrom
  //         same as transfer
  //       --> sum(balances) <= totalSupply
  //       --> balance <= totalSupply
  //     --> balance can't overflow in mint
  //
  // A7. excess-allocation-by-overflow
  //   N/A no upper bound
  // A8. excess-mint-token-by-overflow
  //   N/A no upper bound
  // A9. excess-buy-token-by-overflow
  //   N/A no pricing
  // A10. verify-reverse-in-transferFrom
  //   ERC20
  //     transfer from
  //       when the token owner is not the zero address
  //         when the receipient is not the zero address
  //           when the spender does not have enough approved balance
  // A11. pauseTransfer-anyone
  //   gemfab->rely/deny
  // A12. transferProxy-keccak256
  //   N/A no transfer proxy
  it('A13. approveProxy-keccak256', async () => {
    // already cover the same code with repeated nonce test
    // however, this is a case where permit would pass if not for
    // signer == address(0)
    // note that current implementation differs from recommended implementation,
    // which would handle 0 address owner as its own failure case
    // (meaning, if(owner == address(0)) revert ErrPermitSignature;)
    // however, it still handles the case where ecrecover(...) == owner == 0
    const value = {
      owner: ethers.constants.AddressZero,
      spender: BOB,
      value: 1,
      nonce: 0,
      deadline: Math.floor(Date.now() / 1000) * 2
    };

    const signature = await ali._signTypedData(domain, types, value);
    const sig       = ethers.utils.splitSignature(signature)

    await fail('ErrPermitSignature', gem.permit, value.owner, value.spender, value.value, value.deadline, sig.v, sig.r, sig.s);
  })
  // A14. constructor-case-insensitive
  //   N/A (as of Solidity 0.4.22, constructors are named constructor)
  // A15. custom-fallback-bypass-ds-auth
  //   N/A (no callbacks)
  // A16. custom-call-abuse
  //   N/A (no custom calls)
  // A17. setowner-anyone
  it('A18. setowner-anyone', async () => {
    await fail('ErrWard', gem.connect(bob).ward, BOB, true);
    await send(gem.ward, BOB, true);
  })
  // A18. allowAnyone
  //   same as A10 (spender does not have enough approved balance)
  it('A19. approve-with-balance-verify', async () => {
    // nothing minted
    await send(gem.approve, BOB, 1);
  })
  // A20. re-approve
  //   N/A (TODO applies to most ERC20 tokens, don't approve funds to miners)
  describe('A21. check-effect-inconsistency', () => {
    async function checkUnchanged() {
      want((await gem.allowance(ALI, ALI)).toNumber()).to.be.equal(100);
      want((await gem.allowance(ALI, BOB)).toNumber()).to.be.equal(42);
      want((await gem.allowance(BOB, ALI)).toNumber()).to.be.equal(0);
      want((await gem.allowance(BOB, BOB)).toNumber()).to.be.equal(0);
      want((await gem.allowance(BOB, CAT)).toNumber()).to.be.equal(0);
      want((await gem.allowance(CAT, ALI)).toNumber()).to.be.equal(0);
      want((await gem.allowance(CAT, BOB)).toNumber()).to.be.equal(0);
      want((await gem.allowance(CAT, CAT)).toNumber()).to.be.equal(0);
      want((await gem.balanceOf(CAT)).toNumber()).to.be.equal(0);
    }
    beforeEach(async () => {
      await send(gem.mint, ALI, 1);
      await send(gem.approve, ALI, 100);
      await send(gem.approve, BOB, 42);
      await send(gem.approve, CAT, 1);
      await checkUnchanged();
      want((await gem.allowance(ALI, CAT)).toNumber()).to.be.equal(1);
      want((await gem.balanceOf(ALI)).toNumber()).to.be.equal(1);
      want((await gem.balanceOf(BOB)).toNumber()).to.be.equal(0);
    })

    it('transferFrom', async () => {
      await send(gem.connect(cat).transferFrom, ALI, BOB, 1);
      await checkUnchanged();
      want((await gem.allowance(ALI, CAT)).toNumber()).to.be.equal(0);
      want((await gem.balanceOf(ALI)).toNumber()).to.be.equal(0);
      want((await gem.balanceOf(BOB)).toNumber()).to.be.equal(1);
    })
    it('transfer', async () => {
      await send(gem.transfer, BOB, 1)
      await checkUnchanged();
      want((await gem.allowance(ALI, CAT)).toNumber()).to.be.equal(1);
      want((await gem.balanceOf(ALI)).toNumber()).to.be.equal(0);
      want((await gem.balanceOf(BOB)).toNumber()).to.be.equal(1);
    })
  })
  // A22. constructor-mistyping
  //   gem does not use `function constructor()`
  // A23. fake-burn
  //   N/A (burn does not use power, takes wad as arg)
  // A24. getToken-anyone
  //   N/A (gem does not have getToken)
  // A25. constructor-naming-error
  //   gem's constructor is called constructor(name, symbol)


  // B. List of Incompatibilities
  it('B1. transfer-no-return', async () => {
    const ok = await gem.callStatic.transfer(BOB, 0);
    want(ok).to.be.equal(true);
  })
  it('B2. approve-no-return', async () => {
    const ok = await gem.callStatic.approve(BOB, 0);
    want(ok).to.be.equal(true);
  })
  it('B3. transferFrom-no-return', async () => {
    const ok = await gem.callStatic.transferFrom(ALI, BOB, 0);
    want(ok).to.be.equal(true);
  })
  // B4. no-decimals
  //   ERC20->has 18 decimals
  // B5. no-name
  //   ERC20->has a name
  // B6. no-symbol
  //   ERC20->no-symbol
  // B7. no-Approval
  //   ERC20->approve->when the spender is not the zero address
  //     ->when the sender has enough balance->emits an approval event
  //   ERC20->approve->when the spender is not the zero address
  //     ->when the sender does not have enough balance->emits an approval event

  // C. List of Excessive Authorities
  // C1. centralAccount-transfer-anyone
  //   TODO owner can always mint and burn
})
