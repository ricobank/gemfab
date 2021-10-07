const debug = require('debug')('gemfab:test')

const chai = require('chai')
chai.use(require('chai-as-promised'))
const want = chai.expect

const { ethers, artifacts, network } = require('hardhat')

async function send(...args) {
  const f = args[0];
  const fargs = args.slice(1);
  const tx = await f(...fargs);
  return await tx.wait()
}

async function fail(...args) {
  const err = args[0];
  const sargs = args.slice(1);
  await want(send(...sargs)).rejectedWith(
    `VM Exception while processing transaction: reverted with reason string '${err}'`
  );
}

describe('gemfab', ()=>{
  let ali, bob, cat;
  let ALI, BOB, CAT;
  let gem; let gem_type;
  let gemfab; let gemfab_type;
  before(async()=>{
    [ali, bob, cat] = await ethers.getSigners();
    [ALI, BOB, CAT] = [ali, bob, cat].map(signer => signer.address);
    gem_type = await ethers.getContractFactory('./src/gem.sol:Gem', ali);
    gemfab_type = await ethers.getContractFactory('./src/gem.sol:GemFab', ali);
  })
  beforeEach(async() => {
    gemfab = await gemfab_type.deploy();
    const gemaddr = await gemfab.callStatic.build("Mock Cash", "CASH");
    await send(gemfab.build, "Mock Cash", "CASH");
    gem = gem_type.attach(gemaddr);
  })

  it('mint ward', async () => {
    await send(gem.mint, ALI, 100);
    const bal = await gem.balanceOf(ALI);
    want(bal.toNumber()).equal(100)

    const gembob = gem.connect(bob);
    await fail('auth-mint', gembob.mint, BOB, 100);
  })

});


