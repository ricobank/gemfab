const path = require('path')
const dpack = require('dpack')

export let dapp;

export async function init() {
  console.log('WARN loading dpack from file')
  const packfile = path.join(__dirname, './dpacks/gemfab.json');
  dapp = await dpack.loadFromFile(packfile);
}

export async function makePermitDigest(obj: any) {
}
