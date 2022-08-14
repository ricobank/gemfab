`Gem` is an ERC20 token implementation. `GemFab` is a token factory that builds `Gem`s.

The idea is to stop deploying tokens directly, and use a factory for all tokens.

`Gem` is *not safe for extension via inheritance*. Instead of customizing your gem via inheritance, you should use the built-in `mint` and `burn`, with multi-owner `ward` for authentication.

Minting and burning from a controller contract which defines the rules for when those can occur is the most 'hygenic' way to implement all forms of tokenomics.

If you check `gemfab.built(gem)`, you know that `gem` is a `Gem` -- no further audit needed.
An independently deployed `Gem` will not appear in the factory's record of valid gems, which will complicate verification for no reason.
More importantly, having a record that the gem was built from the factory allows *other contracts* to infer that certain invariants are maintained,
which a codehash check cannot satisfy because contracts can write to their state during construction time.


Here are some other implementation choices made for `Gem`.

* `name` and `symbol` are `bytes32` instead of `string`, this prevents "return data bombs" when gemfab is composed into other systems
* Infinite allowance via `approve(code, type(uint256).max);`. This avoids a useless store and is a major gas savings.
* `permit` -- There are several minor variations in the wild; this one uses EIP-2612 (notably, has a small difference from earlier permit in Dai).
* `halt`, allowing control contracts to freeze individual balances. You can still define un-haltable gems with an appropriate controller contract.
* Custom error types for all possible error conditions, with a consistent error API.
* Invariants preserved with controlled mint/burn means `unchecked` blocks can be used to save gas in every function.
* Functions are `payable`, saving a little bit of gas. The contract as a whole will still reject ether sent to invalid ABIs, including regular ether "send" (call with no calldata), which covers the most common mistake.

Working with gemfab
---

(*Note: No packs are published yet -- watch for 'release' branch*). See `pack/gemfab_<network>.dpack.json` to get the `gemfab` object plus `Gem` and `GemFab` types. See [`dpack`](https://github.com/dapphub/dpack) for docs on how to use these packs.

Discussion
---

"ERC20" is an ABI definition masquerading as a semantic spec. There is no "standard ERC20".
As a result, the token ecosystem is a disaster. In an ideal world, this would have been the lesson that taught EIP enthusiasts to stop doing design by committee.
