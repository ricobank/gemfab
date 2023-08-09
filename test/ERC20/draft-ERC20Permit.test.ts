// modified version openzeppelin-contracts draft-ERC20Permit.test.js
//   https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/test/token/ERC20/extensions/draft-ERC20Permit.test.js
//
// The MIT License (MIT)
// Copyright (c) 2016-2020 zOS Global Limited
// https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/LICENSE

/* eslint-disable */
import {ethers} from "hardhat";
import * as hh from "hardhat";
import {snapshot, revert, send} from 'minihat'

const { expect } = require('chai');
const expectRevert = async (f, msg) => { await expect(f).rejectedWith(msg) }
const { BN } = require('bn.js')
const { constants, BigNumber, utils } = ethers

const Permit = [
  { name: 'owner', type: 'address' },
  { name: 'spender', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
];

const hre = require('hardhat');

describe('ERC20Permit', () => {
  let initialHolder, spender, recipient, other;

  const name = utils.formatBytes32String('GoodCoin');
  const symbol = utils.formatBytes32String('GCN');
  const version = '0';

  const initialSupply = BigNumber.from(100);

  let chainId;
  let gem;
  let gem_type
  let gemfab;
  let gemfab_type

  before(async () => {
    [initialHolder, spender, recipient, other] = await ethers.getSigners();
    gem_type = await ethers.getContractFactory('Gem', initialHolder)
    gemfab_type = await ethers.getContractFactory('GemFab', initialHolder)

    gemfab = await gemfab_type.deploy()
    const gemaddr = await gemfab.callStatic.build(name, symbol)
    await send(gemfab.build, name, symbol)
    gem = gem_type.attach(gemaddr)

    await snapshot(hh)

    chainId = await hh.network.config.chainId;
    //domain.chainId = chainId;
    //domain.verifyingContract = gem.address;
  })


  beforeEach(async function () {
    await revert(hh)
    this.token = gem;

    // We get the chain id from the contract because Ganache (used for coverage) does not return the same chain id
    // from within the EVM as from the JSON RPC interface.
    // See https://github.com/trufflesuite/ganache-core/issues/515

    //this.chainId = await this.token.getChainId();
    //Gem doesn't have getChainId...hh env has same chainid
    this.chainId = await hh.network.config.chainId;
  });

  it('initial nonce is 0', async function () {
    expect(await this.token.nonces(initialHolder.address)).to.eql(constants.Zero);
  });

  it('domain separator', async function () {
    expect(
      await this.token.DOMAIN_SEPARATOR(),
    ).to.equal(
      ethers.utils._TypedDataEncoder.hashDomain(
        {
          name: 'GemPermit',
          version,
          chainId: this.chainId,
          verifyingContract: this.token.address
        }
      )
    );
  });

  describe('permit', function () {
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

    const nonce    = 0;
    const deadline = constants.MaxUint256;
    let value;
    before(async () => {
      value = {
        owner: initialHolder.address,
        spender: spender.address,
        value: 42,
        nonce: nonce,
        deadline: deadline
      };
      domain.chainId = chainId;
      domain.verifyingContract = gem.address;
    })

    it('accepts owner signature', async function () {
      const signature = await initialHolder._signTypedData(domain, types, value)
      const { v, r, s } = ethers.utils.splitSignature(signature);

      const receipt = await this.token.permit(initialHolder.address, spender.address, value.value, value.deadline, v, r, s);

      expect(await this.token.nonces(initialHolder.address)).to.eql(ethers.constants.One);
      expect(await this.token.allowance(initialHolder.address, spender.address)).to.eql(BigNumber.from(value.value));
    });

    it('rejects reused signature', async function () {
      const signature = await initialHolder._signTypedData(domain, types, value)
      const { v, r, s } = ethers.utils.splitSignature(signature);

      await this.token.permit(initialHolder.address, spender.address, value.value, value.deadline, v, r, s);

      await expectRevert(
        this.token.permit(initialHolder.address, spender.address, value.value, value.deadline, v, r, s),
        'ErrPermitSignature',
      );
    });

    it('rejects other signature', async function () {
      const signature = await other._signTypedData(domain, types, value)
      const { v, r, s } = ethers.utils.splitSignature(signature);

      await expectRevert(
        this.token.permit(initialHolder.address, spender.address, value.value, value.deadline, v, r, s),
        'ErrPermitSignature',
      );
    });

    it('rejects expired permit', async function () {
      value.deadline = Math.floor(Date.now() / 1000) - 10;

      const signature = await initialHolder._signTypedData(domain, types, value)
      const { v, r, s } = ethers.utils.splitSignature(signature);

      await expectRevert(
        this.token.permit(initialHolder.address, spender.address, value.value, value.deadline, v, r, s),
        'ErrPermitDeadline',
      );
    });
  });
});
