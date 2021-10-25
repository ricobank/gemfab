import * as path from 'path'
import * as dpack from 'dpack'

import { TypedDataUtils } from 'ethers-eip712'

export let dapp

export async function init () {
  console.log('WARN loading dpack from file')
  const packfile = path.join(__dirname, './dpacks/gemfab.json')
  dapp = await dpack.loadFromFile(packfile)
}

// obj: {
//   chainId: u256,
//   gem: address,
//   owner: address,
//   spender: address,
//   value: u256,
//   nonce: u256,
//   deadline: u256,
// }
export async function makeGemPermitDigest (obj: any) {
  const typedData = {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' }
      ],
      GemPermit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'bytes32' }
      ]
    },
    primaryType: 'GemPermit',
    domain: {
      name: 'GemPermit',
      version: '0',
      chainId: obj.chainId,
      verifyingContract: obj.gem
    },
    message: {
      owner: obj.owner,
      spender: obj.spender,
      value: obj.value,
      nonce: obj.nonce,
      deadline: obj.deadline
    }
  }
  // debug('encoding digest...')
  return Buffer.from(TypedDataUtils.encodeDigest(typedData))
}
