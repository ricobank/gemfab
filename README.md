`Gem` is an ERC20 implementation. `GemFab` builds `Gem`s.

"ERC20" is an ABI definition masquerading as a semantic spec. There is no "standard ERC20".

If you check `gemfab.built(object)`, you know that `object` is a `Gem` -- no further audit needed.

`Gem` is *not safe for extension via inheritance*.
The Solidity expression `contract MyGem is Gem { ... }` is a paradox; no it is not a Gem, because it will have different code, unless you don't add anything!
An independently deployed `Gem` will also not appear in the factory's record of valid gems, which will complicate verification slightly for no reason.

Instead of customizing your gem via inheritance, `Gem` exposes `mint` and `burn`, with multi-root `rely` and `deny` for authentication.
Minting and burning from a controller contract which defines the rules for when those can occur is the most 'hygenic' way to implement all forms of tokenomics.

Here are the implementation choices made for `Gem`. These reflect all our best knowledge about real-world token usage.

* Infinite allowance via `approve(code, type(uint256).max);` is kept. This avoids a useless store and is a major gas savings that everyone on the network benefits from.
* `permit` is kept. There are several minor variations in the wild; this one uses the same as in Uniswap V2 LP tokens (notably, not the same one as Dai).
* Custom error types for all possible error conditions, with a consistent error API.
* Invariants preserved with controlled mint/burn means `unchecked` blocks can be used to save gas in every function. *This makes `Gem` the most gas-efficient ERC20 with sane semantics.*
