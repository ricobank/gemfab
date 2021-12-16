
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

// investigate potential issues from awesome-buggy-erc20-tokens and weird-erc20
// issues taken from:
// https://github.com/sec-bit/awesome-buggy-erc20-tokens/blob/master/ERC20_token_issue_list.md
//   commit: 3e86725136585a33b5315ce1bd455f1062661005
// https://github.com/d-xo/weird-erc20
//   commit: 438a180eb073fa451a8a9fc734942d6ad1874120
describe('common-erc20-issues', () => {
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
    domain.chainId = chainId;
    domain.verifyingContract = gem.address;
  })
  beforeEach(async () => {
    await revert(hh)
  })

  describe('awesome-buggy-erc20-tokens', () => {
    // TH = tested here
      // A13. approveProxy-keccak256
      // A14. constructor-case-insensitive
      // A17. setowner-anyone
      // A18. allowAnyone
      // A19. approve-with-balance-verify
      // A21. check-effect-inconsistency
      // A22. constructor-mistyping
      // A25. constructor-naming-error
      // B1. transfer-no-return
      // B2. approve-no-return
      // B3. transferFrom-no-return
    // AT = already tested
      // A2. totalSupply-overflow
      // A5. owner-overweight-token-by-overflow
      // A6. owner-decrease-balance-by-mint-overflow
      // A10. verify-reverse-in-transferFrom
      // A11. pauseTransfer-anyone
      // B4. no-decimals
      // B5. no-name
      // B6. no-symbol
      // B7. no-Approval
    // NA = not applicable
      // A1. batchTransfer-overflow
      // A3. verify-invalid-by-overflow
      // A4. owner-control-sell-price-for-overflow
      // A7. excess-allocation-by-overflow
      // A8. excess-mint-token-by-overflow
      // A9. excess-buy-token-by-overflow
      // A12. transferProxy-keccak256
      // A15. custom-fallback-bypass-ds-auth
      // A23. fake-burn
      // A24. getToken-anyone
      // C1. centralAccount-transfer-anyone
    // wontfix
      // A20. re-approve
    // ------------------------------------------------------------------

    describe('A. List of Bugs in Implementation', () => {
      // A1. batchTransfer-overflow (NA)
      //   batchTransfer() makes multiple transactions simultaneously. After passing several transferring addresses and
      //   amounts by the caller, the function would conduct some checks then transfer tokens by modifying balances, while
      //   overflow might occur in uint256 amount = uint256(cnt) * _value if _value is a huge number. It results in
      //   passing the sender's balance check in require( _value > 0 && balances[msg.sender] >= amount) due to making
      //   amount become a small value rather than cnt times of _value, then transfers out tokens exceeding
      //   balances[msg.sender]. (CVE-2018-10299)
      //
      //   Gem does not implement batch transfer

      // A2. totalSupply-overflow (AT)
      //   totalSupply usually represents the sum of all tokens in the contract. The contract would add or decrease
      //   totalSupply without any check or using SafeMath when the sum of tokens changes, making overflow possible in
      //   totalSupply.
      //
      //   test: gemfab->coverage->mint->overflow (gemfab-test.ts)

      // A3. verify-invalid-by-overflow (NA)
      //   The contract checks the balance when doing operations like transferring and the hacker could bypass this check
      //   making use of overflow by passing a great value.
      //
      //   burn (NA)
      //     balance underflow check does not use addition or subtraction
      //   mint (NA)
      //     no overflow check on balance (checks totalSupply instead (A2))
      //   transfer (NA)
      //     balance underflow check does not use addition or subtraction

      // A4. owner-control-sell-price-for-overflow (NA)
      //   Some contracts let owner control the price of transferring between ethers and tokens by users, yet owner could
      //   maliciously set a huge sellPrice to make an overflow in computing equivalent ethers. The original number of
      //   ethers becomes a small value, causing the user receiving insufficient ethers. (CVE-2018-11811)
      //
      //   no price mechanics

      // A5. owner-overweight-token-by-overflow (AT)
      //   owner could bring about an underflow to increase its holding arbitrarily by transferring tokens more than its
      //   remaining tokens when transferring to other accounts. (CVE-2018-11687)
      //
      //   by definition only applies to warded functions
      //   mint (NA)
      //     doesn't use subtraction
      //   burn (AT)
      //     gemfab->burn underflow
      //   rely/deny (NA)
      //     doesn't modify any uint values

      // A6. owner-decrease-balance-by-mint-overflow (AT)
      //   owner with minting authority could control an account's balance at will by sending numerous tokens to the
      //   account and leading its balance overflowing to a small figure. (CVE-2018-11812)
      //
      //   test: gemfab->coverage->mint->overflow proves balance can't overflow
      //     test checks totalSupply overflow
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

      // A7. excess-allocation-by-overflow (NA)
      //   owner could allocate more tokens to an address via bypassing the upper bound with overflow when allocate tokens
      //   to accounts. (CVE-2018-11810)
      //
      //   mint doesn't set any upper bounds on balances to bypass, only checks totalSupply overflow (A2)

      // A8. excess-mint-token-by-overflow (NA)
      //   owner can bring about an overflow and issue random amounts of tokens by passing a great value and pass the
      //   check of max minting value. (CVE-2018-11809)
      //
      //   mint doesn't set any upper bounds on balances to bypass, only checks totalSupply overflow (A2)

      // A9. excess-buy-token-by-overflow (NA)
      //   If the user possesses an enormous amount of ethers when transferring to tokens, he or she could buy so many
      //   tokens as an overflow would occur to pass TOTAL_SOLD_TOKEN_SUPPLY_LIMIT, thus gets more tokens.
      //   (CVE-2018-11809)
      //
      //   Gem has no price data, doesn't support buying/selling tokens

      // A10. verify-reverse-in-transferFrom (AT)
      //   The developer wrote the opposite comparing sign when checking allowance in transferFrom(), thus there would be
      //   an overflow or anyone could transfer out balances of any accounts. (CVE-2018-10468)
      //
      //   test: ERC20->transfer from->when the token owner is not the zero address
      //   ->when the receipient is not the zero address->when the spender does not have enough approved balance

      // A11. pauseTransfer-anyone (AT)
      //   onlyFromWallet mistakingly replaced == with !=, causing anyone except walletAddress could call
      //   enableTokenTransfer() and disableTokenTransfer().
      //
      //   test: gemfab->rely/deny

      // A12. transferProxy-keccak256 (NA)
      //   Both keccak256() and ecrecover() are built-in functions. keccak256() computes the signature of public key and ecrecover recovers public key with signature. If the passed value is correct, we can verify the address by these two functions. (CVE-2018-10376)
      //   bytes32 hash = keccak256(_from,_spender,_value,nonce,name);
      //   if(_from != ecrecover(hash,_v,_r,_s)) revert();
      //   When the parameter of ecrecover() is incorrect, it would return the address of 0x0. Suppose _from passes
      //   0x0 address as well, the check got bypassed, meaning that anyone could transfer out the balance of 0x0 address.
      //
      //   Gem does not have a transfer proxy, only approve proxy through EIP-2612 permit

      // A13. approveProxy-keccak256 (TH)
      //   Both keccak256() and ecrecover() are built-in functions. keccak256() computes the signature of public key and
      //   ecrecover recovers public key with signature. If the passed value is correct, we can verify the address by
      //   these two functions. (CVE-2018-10376)
      //   bytes32 hash = keccak256(_from,_spender,_value,nonce,name);
      //   if(_from != ecrecover(hash,_v,_r,_s)) revert();
      //   When the parameter of ecrecover() is incorrect, it would return the address of 0x0. Suppose _from passes 0x0
      //   address as well, the check got bypassed, meaning that anyone could get approved by 0x0 address.
      //
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
        const sig = ethers.utils.splitSignature(signature)

        await fail('ErrPermitSignature', gem.permit, value.owner, value.spender, value.value, value.deadline,
          sig.v, sig.r, sig.s);
      })

      // A14. constructor-case-insensitive (TH)
      //   The developer made a mistake spelling the constructor's name, making it inconsistent with the contract's name
      //   such that anyone could call this function.
      //
      //   As of Solidity 0.4.22, constructors are named constructor.  Gem uses Solidity version 0.8.10.
      //
      it('A14. constructor-case-insensitive', async () => {
        const constructor = gem.interface.deploy
        want(constructor.type).to.equal('constructor')
        want(constructor.payable).to.equal(true)
        want(constructor.inputs.length).to.equal(2)
        want(constructor.inputs[0].type).to.equal('string')
        want(constructor.inputs[1].type).to.equal('string')
        want(gem.functions.Gem).to.equal(undefined)
        want(gem.functions.gem).to.equal(undefined)
      })

      // A15. custom-fallback-bypass-ds-auth (NA)
      //   Token contract calls ERC223's Recommended branch code and ds-auth library simultaneously, thus the hacker could
      //   make use of passing custom fallback functions in ERC223 contracts along with ds-auth approving check. When the
      //   fallback function in ERC223 contracts gets triggered, the hacker could call the contract itself to deactivate
      //   internal authorization control.
      //
      //   Gem accepts no custom callbacks to exploit

      // A16. custom-call-abuse (N/A)
      //   It is a really bad practice to allow the abuse of CUSTOM_CALL in token standard.
      //   Attackers could call any contract in the name of vulnerable contract with CUSTOM_CALL.
      //   This vulnerability will make these attacking scenarios possible:
      //   Attackers could steal almost each kind of tokens belong to the vulnerable contract
      //   Attackers could steal almost each kind of tokens approved to the vulnerable contract
      //   Attackers could bypass the auth check in vulnerable contract by proxy of contract itself in special situation
      //   Attackers could pass fake values as parameter to cheat with receiver contract
      //
      //   Gem has no custom calls

      // A17. setowner-anyone (TH)
      //   setOwner() could change owner and only the current owner may call it usually. However, the snippet below allows
      //   anyone calling setOwner() to set contract's owner. (CVE-2018-10705)
      //
      it('A17. setowner-anyone', async () => {
        await fail('ErrWard', gem.connect(bob).ward, BOB, true);
        await send(gem.ward, BOB, true);
      })

      // A18. allowAnyone (TH)
      //   Description transferFrom() missed a check on allowed, then anyone could transfer balances from any accounts. A
      //   hacker could make use of it to grab others' tokens. In the mean time, if the transferred sum surpasses allowed,
      //   allowed[_from][msg.sender] -= _value; would lead to an underflow.
      //
      //   same as A10 (spender does not have enough approved balance)

      // A19. approve-with-balance-verify (TH)
      //   Several Token contracts add balance check in standard approve() requiring _amount not greater than the current
      //   balance.
      //   In one way, this check cannot assure that the approved account would transfer out tokens of this amount:
      //   The token holder transfers out tokens after approval, making the balance smaller than allowance.
      //   After approving multiple users, one of them calls transferFrom() and the balance could be smaller than the approved value.
      //   On the another way, this check might prevent external contracts(e.g. decentralized exchanges based on 0x protocol) from normal calling, before the Token developing team transferring a tremendous amount of tokens to the intermediate account.
      //
      it('A19. approve-with-balance-verify', async () => {
        // nothing minted
        await send(gem.approve, BOB, 1);
      })

      // A20. re-approve wontfix
      //   approve() allows the spender account using a given number of tokens by updating the value of allowance.
      //   Suppose the spender account is able to control miners' confirming order of transferring, then spender could use
      //   up all allowance before approve comes into effect. After approve() is effective, spender has access to the new
      //   allowance, causing total tokens spent greater than expected and resulting in Re-approve attack.
      //   This attack is only possible when the spender has approval, the approved account changes the approved amount,
      //   the balance is sufficient and the spender could control confirming order of transferring.
      //   It would only cause the spender using more tokens than expected or the approved tokens less than expectation,
      //   not affecting the account balance and sum of tokens.
      //
      //   Applies to most ERC20 tokens, it's app dev/user's problem.  wontfix.

      // A21. check-effect-inconsistency (TH)
      //   The condition verification and the variable modification logic is inconsistent, which fails the verification
      //   and could further leads to other vulnerabilities like integer underflow. For example, the contract checks the
      //   balance of A but updates the balance of B.
      //
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

      // A22. constructor-mistyping (TH)
      //   Description When declaring function constructors, one should write code like constructor(). However, some
      //   mistyped this declaration, using function constructor(), thus the Solidity compiler would view it as an average
      //   public function that anyone could access, not a constructor called just once when deploying.
      //
      //   gem has its own defined constructor (as shown in A14)
      //
      it('A22. constructor-mistyping', async () => {
        // if gem uses a public `function constructor`, it should be part of its interface
        let constructor = gem.interface.functions["constructor(string,string)"]
        want(constructor).to.equal(undefined)
        constructor = gem.interface.functions["constructor()"]
        want(constructor).to.equal(undefined)
      })

      // A23. fake-burn (NA)
      //   Some token contracts have integer overflow bugs (CVE-2018-13151 fake-burn). The power method in burning might
      //   lead to an integer overflow by passing specific parameters, resulting in burning 0 token, not the intended
      //   value.
      //
      //   burn does not use power, burn takes the exact amount to burn (wad) as an argument

      // A24. getToken-anyone (NA)
      //   Function getToken() is used to add value to caller's token balance. The amount value is defined by caller as
      //   input argument. This function works as mint token but allows anyone to call it. As a result, anyone could add
      //   arbitrary amount of token to one's own balance by calling getToken(). This is very ridiculous to ERC20 token
      //   contract.
      //
      //   Gem does not have a getToken function

      // A25. constructor-naming-error (TH)
      //   When declaring the constructor, neither did the developer used constructor() or the function with the contract
      //   name. Instead, the developer mistakingly declared it with another method name, causing that anyone has access
      //   to it.
      //
      //   Gem's constructor is correctly named (shown in A14)
    })

    describe('B. List of Incompatibilities', () => {
      // B1. transfer-no-return (TH)
      //   transfer() should return a bool value according to ERC20, while it is left out in many deployed Token
      //   contracts, not following EIP20. Suppose an external contract following EIP20 uses an ABI interface(with a
      //   return value) to call transfer() without a return value, the Solidity compiler would not throw an exception
      //   in versions before 0.4.22. However, transfer() calls would revert after the compiler is upgraded to 0.4.22
      //   version.
      //
      it('B1. transfer-no-return', async () => {
        const ok = await gem.callStatic.transfer(BOB, 0);
        want(ok).to.be.equal(true);
        const outputs = gem.interface.functions["transfer(address,uint256)"].outputs;
        want(outputs.length).to.equal(1);
        want(outputs[0].type).to.equal('bool');
      })

      // B2. approve-no-return (TH)
      //   approve() should return a bool value according to ERC20, while it is left out in many deployed Token
      //   contracts, not following EIP20. Suppose an external contract following EIP20 uses an ABI interface(with a
      //   return value) to call approve() without a return value, the Solidity compiler would not throw an exception in
      //   versions before 0.4.22. However, approve() calls would revert after the compiler is upgraded to 0.4.22
      //   version.
      //
      it('B2. approve-no-return', async () => {
        const ok = await gem.callStatic.approve(BOB, 0);
        want(ok).to.be.equal(true);
        const outputs = gem.interface.functions["approve(address,uint256)"].outputs;
        want(outputs.length).to.equal(1);
        want(outputs[0].type).to.equal('bool');
      })

      // B3. transferFrom-no-return (TH)
      //   transferFrom() should return a bool value according to ERC20, while it is left out in many deployed Token
      //   contracts, not following EIP20. Suppose an external contract following EIP20 uses an ABI interface(with a
      //   return value) to call transferFrom() without a return value, the Solidity compiler would not throw an
      //   exception in versions before 0.4.22. However, transferFrom() calls would revert after the compiler is
      //   upgraded to 0.4.22 version.
      //
      it('B3. transferFrom-no-return', async () => {
        const ok = await gem.callStatic.transferFrom(ALI, BOB, 0);
        want(ok).to.be.equal(true);
        const outputs = gem.interface.functions["transferFrom(address,address,uint256)"].outputs;
        want(outputs.length).to.equal(1);
        want(outputs[0].type).to.equal('bool');
      })

      // B4. no-decimals (AT)
      //   Usually a token contract employs decimals to represent digits after the token's decimal point, while some of
      //   them does not define this variable properly, e.g. a case-insensitive decimals, making them incompatible with
      //   external contract calls.
      //
      //   test: ERC20->has 18 decimals (ERC20.test.js)

      // B5. no-name (AT)
      //   Usually a token contract employs name as a token name, while some of them does not define this variable
      //   properly, e.g. a case-insensitive name, making them incompatible with external contract calls.
      //
      //   test: ERC20->has a name (ERC20.test.js)

      // B6. no-symbol (AT)
      //   Usually a token contract employs symbol as a token alias, while some of them does not define this variable
      //   properly, e.g. a case-insensitive symbol, making them incompatible with external contract calls.
      //
      //   test: ERC20->no-symbol (ERC20.test.js)

      // B7. no-Approval (AT)
      //   Two events - Transfer and Approval should get fired under certain circumstances as described by ERC20
      //   specification. However, many Token contracts missed Approval event triggering, referred to an implementation
      //   on official Ethereum website (which has been fixed).
      //
      //   test: ERC20->approve->when the spender is not the zero address
      //     ->when the sender has enough balance->emits an approval event (ERC20.behavior.js)
      //   test: ERC20->approve->when the spender is not the zero address
      //     ->when the sender does not have enough balance->emits an approval event (ERC20.behavior.js)
    })

    // C. List of Excessive Authorities
    // C1. centralAccount-transfer-anyone N/A
    //   onlycentralAccount could transfer out other account's balances randomly. (CVE-2018-1000203)
    //
    //   wards can mint and burn but not transfer out
  })
  describe('weird-erc20', async () => {
    // TH = tested here
      // Approval Race Protections
      // Revert on Approval to Zero Address
      // Revert on Zero Value Transfers
      // transferFrom with src == msg.sender
      // Non string metadata
      // Revert on Transfer to the Zero Address
      // Revert on Large Approvals & Transfers
    // AT = already tested
      // Missing Return Values
      // Low Decimals
      // High Decimals
      // No Revert on Failure
    // NA = not applicable
      // Reentrant calls
      // Fee on Transfer
      // Upgradable Tokens
      // Flash Mintable Tokens
      // Pausable Tokens
      // Multiple Token Addresses
      // Code Injection Via Token Name
      // Tokens with Blocklists
    // wontfix
      // Balance Modifications Outside of Transfers (rebasing / airdrops)
    // ------------------------------------------------------------------

    // Reentrant calls (NA)
    //   Some tokens allow reentract calls on transfer (e.g. ERC777 tokens).
    //   This has been exploited in the wild on multiple occasions (e.g. imBTC uniswap pool drained, lendf.me drained)
    //
    //   Gem has no external contract calls

    // Missing Return Values (AT)
    //   Some tokens do not return a bool (e.g. USDT, BNB, OMG) on ERC20 methods. see here for a comprehensive (if
    //   somewhat outdated) list.
    //   Some tokens (e.g. BNB) may return a bool for some methods, but fail to do so for others. This resulted in stuck
    //   BNB tokens in Uniswap v1 (details).
    //   Some particulary pathological tokens (e.g. Tether Gold) declare a bool return, but then return false even when
    //   the transfer was successful (code).
    //
    //   see awesome-erc20 B1-B3, approval transfer and transferFrom return true or revert

    // Fee on Transfer (NA)
    //   Some tokens take a transfer fee (e.g. STA, PAXG), some do not currently charge a fee but may do so in the
    //   future (e.g. USDT, USDC).
    //
    //   Gem has no fees

    // Balance Modifications Outside of Transfers (rebasing / airdrops) (wontfix)
    //   Some tokens may make arbitrary balance modifications outside of transfers (e.g. Ampleforth style rebasing
    //   tokens, Compound style airdrops of governance tokens, mintable / burnable tokens).
    //   Some smart contract systems cache token balances (e.g. Balancer, Uniswap-V2), and arbitrary modifications to
    //   underlying balances can mean that the contract is operating with outdated information.
    //
    //   Need to make sure gem controller can't burn balances for some kinds of apps

    // Upgradable Tokens (NA)
    //   Some tokens (e.g. USDC, USDT) are upgradable, allowing the token owners to make arbitrary modifications to the
    //   logic of the token at any point in time.
    //   A change to the token semantics can break any smart contract that depends on the past behaviour.
    //
    //   Gem is not upgradable

    // Flash Mintable Tokens (NA)
    //   Some tokens (e.g. DAI) allow for so called "flash minting", which allows tokens to be minted for the duration
    //   of one transaction only, provided they are returned to the token contract by the end of the transaction.
    //   This is similar to a flash loan, but does not require the tokens that are to be lent to exist before the start
    //   of the transaction. A token that can be flash minted could potentially have a total supply of max uint256.
    //
    //   Gem has no flash mint

    // Tokens with Blocklists (NA)
    //   Some tokens (e.g. USDC, USDT) have a contract level admin controlled address blocklist. If an address is
    //   blocked, then transfers to and from that address are forbidden.
    //   Malicious or compromised token owners can trap funds in a contract by adding the contract address to the
    //   blocklist. This could potentially be the result of regulatory action against the contract itself, against a
    //   single user of the contract (e.g. a Uniswap LP), or could also be a part of an extortion attempt against users
    //   of the blocked contract.
    //
    //   Gem has no blocklist

    // Pausable Tokens (NA)
    //   Some tokens can be paused by an admin (e.g. BNB, ZIL).
    //   Similary to the blocklist issue above, an admin controlled pause feature opens users of the token to risk from
    //   a malicious or compromised token owner.
    //
    //   Gem is not not pausable

    // Approval Race Protections (TH)
    //   Some tokens (e.g. USDT, KNC) do not allow approving an amount M > 0 when an existing amount N > 0 is already
    //   approved. This is to protect from an ERC20 attack vector described here.
    //
    //   test: awesome-erc20 A19

    // Revert on Approval to Zero Address (TH)
    //   Some tokens (e.g. OpenZeppelin) will revert if trying to approve the zero address to spend tokens (i.e. a call
    //   to approve(address(0), amt)).
    //
    it('don\'t revert on Approval to Zero Address', async () => {
      await send(gem.approve, ethers.constants.AddressZero, 1);
    })

    // Revert on Zero Value Transfers (TH)
    //   Some tokens (e.g. LEND) revert when transfering a zero value amount.
    //
    it('don\'t revert on Zero Value Transfers', async () => {
      await send(gem.transfer, BOB, 0);
    })

    // Multiple Token Addresses (NA)
    //   Some proxied tokens have multiple addresses
    //   calling transfer on either affects your balance on both
    //
    //   Gem has one address

    // Low Decimals (AT)
    //   Some tokens have low decimals (e.g. USDC has 6). Even more extreme, some tokens like Gemini USD only have
    //   2 decimals.
    //   This may result in larger than expected precision loss.
    //
    //   test: ERC20->has 18 decimals (ERC20.test.js)

    // High Decimals (AT)
    //   Some tokens have more than 18 decimals (e.g. YAM-V2 has 24).
    //   This may result in larger than expected precision loss.
    //
    //   test: ERC20->has 18 decimals (ERC20.test.js)

    // transferFrom with src == msg.sender (TH)
    //   Some token implementations (e.g. DSToken) will not attempt to decrease the caller's allowance if the sender is
    //   the same as the caller. This gives transferFrom the same semantics as transfer in this case. Other
    //   implementations (e.g. OpenZeppelin, Uniswap-v2) will attempt to decrease the caller's allowance from the sender
    //   in transferFrom even if the caller and the sender are the same address, giving transfer(dst, amt) and
    //   transferFrom(address(this), dst, amt) a different semantics in this case.
    //
    it('transferFrom with src == msg.sender', async () => {
      await send(gem.mint, ALI, 1);
      await send(gem.approve, ALI, 1);
      want((await gem.balanceOf(ALI)).toNumber()).to.equal(1);
      want((await gem.balanceOf(BOB)).toNumber()).to.equal(0);
      want((await gem.allowance(ALI, ALI)).toNumber()).to.equal(1);
      await send(gem.transferFrom, ALI, BOB, 1);
      want((await gem.balanceOf(ALI)).toNumber()).to.equal(0);
      want((await gem.balanceOf(BOB)).toNumber()).to.equal(1);
      want((await gem.allowance(ALI, ALI)).toNumber()).to.equal(0);
    })

    // Non string metadata (TH)
    //   Some tokens (e.g. MKR) have metadata fields (name / symbol) encoded as bytes32 instead of the string prescribed
    //   by the ERC20 specification.
    //   This may cause issues when trying to consume metadata from these tokens.
    //
    describe('string metadata', () => {
      it('name', async () => {
        const outputs = gem.interface.functions["name()"].outputs;
        want(outputs.length).to.equal(1);
        want(outputs[0].type).to.equal('string');
      })
      it('symbol', async () => {
        const outputs = gem.interface.functions["symbol()"].outputs;
        want(outputs.length).to.equal(1);
        want(outputs[0].type).to.equal('string');
      })
    })

    // No Revert on Failure (AT)
    //   Some tokens do not revert on failure, but instead return false (e.g. ZRX).
    //   While this is technicaly compliant with the ERC20 standard, it goes against common solidity coding practices
    //   and may be overlooked by developers who forget to wrap their calls to transfer in a require.
    //
    //   OZ ERC20 tests use expectRevert rather than testing for false (ERC20.test.js, ERC20.behavior.js)

    // Revert on Transfer to the Zero Address (TH)
    //   Some tokens (e.g. openzeppelin) revert when attempting to transfer to address(0).
    //   This may break systems that expect to be able to burn tokens by transfering them to address(0).
    //
    it('doesn\'t revert on transfer to zero address', async () => {
      await send(gem.mint, ALI, 1);
      want((await gem.balanceOf(ALI)).toNumber()).to.equal(1);
      await send(gem.transfer, ethers.constants.AddressZero, 1);
      want((await gem.balanceOf(ALI)).toNumber()).to.equal(0);
    })


    // Revert on Large Approvals & Transfers (TH)
    //   Some tokens (e.g. UNI, COMP) revert if the value passed to approve or transfer is larger than uint96.
    //   Both of the above tokens have special case logic in approve that sets allowance to type(uint96).max if the
    //   approval amount is uint256(-1), which may cause issues with systems that expect the value passed to approve
    //   to be reflected in the allowances mapping.
    //
    it('doesn\'t revert on Large Approvals and Transfers', async () => {
      await send(gem.mint, ALI, ethers.constants.MaxUint256)
      await send(gem.approve, BOB, ethers.constants.MaxUint256)
      await send(gem.connect(bob).transferFrom, ALI, BOB, ethers.constants.MaxUint256)
      want(await gem.allowance(ALI, BOB)).to.eql(ethers.constants.MaxUint256)
      want(await gem.balanceOf(ALI)).to.eql(ethers.constants.Zero)
      want(await gem.balanceOf(BOB)).to.eql(ethers.constants.MaxUint256)
      await send(gem.connect(bob).transfer, ALI, ethers.constants.MaxUint256)
      want(await gem.balanceOf(ALI)).to.eql(ethers.constants.MaxUint256)
      want(await gem.balanceOf(BOB)).to.eql(ethers.constants.Zero)
    })

    // Code Injection Via Token Name (NA)
    //   Some malicious tokens have been observed to include malicious javascript in their name attribute, allowing
    //   attackers to extract private keys from users who choose to interact with these tokens via vulnerable frontends.
    //
    //   Gem will have a normal name
  })
})