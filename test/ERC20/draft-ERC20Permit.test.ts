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
const { constants, BigNumber } = ethers

const { fromRpcSig } = require('ethereumjs-util');
const ethSigUtil = require('eth-sig-util');
const Wallet = require('ethereumjs-wallet').default;

//const ERC20PermitMock = artifacts.require('Gem');

const { EIP712Domain, domainSeparator } = require('./eip712');

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


  const name = 'GemPermit';
  const symbol = 'GEM';
  const version = '0';

  const initialSupply = BigNumber.from(100);

  let chainId;
  let gem;
  let gem_type
  let gemfab;
  let gemfab_type

  before(async () => {
    const [ali, bob, cat, dan] = await ethers.getSigners();
    [initialHolder, spender, recipient, other] = [ali, bob, cat, dan].map(signer => signer.address)
    gem_type = await ethers.getContractFactory('Gem', ali)
    gemfab_type = await ethers.getContractFactory('GemFab', ali)

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
    expect(await this.token.nonces(initialHolder)).to.eql(constants.Zero);
  });

  /*
  it('domain separator', async function () {
    expect(
      await this.token.DOMAIN_SEPARATOR(),
    ).to.equal(
      await domainSeparator(name, version, this.chainId, this.token.address),
    );
  });
   */

  describe('permit', function () {
    const wallet = Wallet.generate();

    const owner = wallet.getAddressString();
    const value = new BN(42);
    const nonce = 0;
    //const maxDeadline = Math.floor(Date.now() / 1000) * 2;
    const maxDeadlineBN = new BN('2').pow(new BN('256')).sub(new BN('1'))
    const maxDeadline   = BigNumber.from(2)
      .pow(BigNumber.from(256))
      .sub(BigNumber.from(1))
    const buildData = (chainId, verifyingContract, deadline : any = maxDeadlineBN) => ({
      primaryType: 'Permit',
      types: { EIP712Domain, Permit },
      domain: { name, version, chainId, verifyingContract },
      message: { owner, spender, value, nonce, deadline },
    });

    it('accepts owner signature', async function () {
      const data = buildData(this.chainId, this.token.address);
      const signature = ethSigUtil.signTypedMessage(wallet.getPrivateKey(), { data });
      const { v, r, s } = fromRpcSig(signature);

      const receipt = await this.token.permit(owner, spender, value.toNumber(), maxDeadline, v, r, s);

      expect(await this.token.nonces(owner)).to.eql(ethers.constants.One);
      expect(await this.token.allowance(owner, spender)).to.eql(BigNumber.from(value.toNumber()));
    });

    it('rejects reused signature', async function () {
      const data = buildData(this.chainId, this.token.address);
      const signature = ethSigUtil.signTypedMessage(wallet.getPrivateKey(), { data });
      const { v, r, s } = fromRpcSig(signature);

      await this.token.permit(owner, spender, value.toNumber(), maxDeadline, v, r, s);

      await expectRevert(
        this.token.permit(owner, spender, value.toNumber(), maxDeadline, v, r, s),
        'ErrPermitSignature',
      );
    });

    it('rejects other signature', async function () {
      const otherWallet = Wallet.generate();
      const data = buildData(this.chainId, this.token.address);
      const signature = ethSigUtil.signTypedMessage(otherWallet.getPrivateKey(), { data });
      const { v, r, s } = fromRpcSig(signature);

      await expectRevert(
        this.token.permit(owner, spender, value.toNumber(), maxDeadline, v, r, s),
        'ErrPermitSignature',
      );
    });

    it('rejects expired permit', async function () {
      const deadline = Math.floor(Date.now() / 1000) - 10;

      const data = buildData(this.chainId, this.token.address, deadline);
      const signature = ethSigUtil.signTypedMessage(wallet.getPrivateKey(), { data });
      const { v, r, s } = fromRpcSig(signature);

      await expectRevert(
        this.token.permit(owner, spender, value.toNumber(), deadline, v, r, s),
        'ErrPermitDeadline',
      );
    });
  });
});
