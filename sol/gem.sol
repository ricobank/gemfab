// SPDX-License-Identifier: AGPL-3.0-or-later

// Copyright (C) monospace
// Copyright (C) 2017, 2018, 2019 dbrock, rain, mrchico

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

pragma solidity 0.8.9;

contract Warded {
    mapping (address => bool) public wards;
    event SetWard(address indexed caller, address indexed trusts, bool bit);
    error ErrWard(bytes4 sig);
    constructor() {
        wards[msg.sender] = true;
        emit SetWard(msg.sender, msg.sender, true);
    }
    function rely(address usr) external {
        ward();
        emit SetWard(msg.sender, usr, true);
        wards[usr] = true;
    }
    function deny(address usr) external {
        ward();
        emit SetWard(msg.sender, usr, false);
        wards[usr] = false;
    }
    function ward() internal view {
        if (!wards[msg.sender]) revert ErrWard(msg.sig);
    }
}

contract GemFab {
    mapping(address=>uint) public built;
    event Build(address indexed caller, address indexed gem);
    function build(
      string memory name,
      string memory symbol
    ) public returns (Gem gem) {
        gem = new Gem(name, symbol);
        gem.rely(msg.sender);
        gem.deny(address(this));
        built[address(gem)] = block.timestamp;
        emit Build(msg.sender, address(gem));
        return gem;
    }
}

contract Gem is Warded {
    string  public name;
    string  public symbol;
    uint256 public totalSupply;
    uint8   public constant decimals = 18;

    mapping (address => uint)                      public balanceOf;
    mapping (address => mapping (address => uint)) public allowance;
    mapping (address => uint)                      public nonces;

    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 public constant  PERMIT_TYPEHASH = 0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;
      //= keccak256('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)');

    event Approval(address indexed src, address indexed usr, uint wad);
    event Transfer(address indexed src, address indexed dst, uint wad);

    error ErrPermitSig();
    error ErrPermitTime();

    constructor(string memory name_, string memory symbol_) {
        name = name_;
        symbol = symbol_;
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f,
              //= keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            0x7e93b3de711138b10fadfa22024b96a0a3a08f812d3afdf331786949e62c5c5a,
              //= keccak256("GemPermit"),  //bytes(name)),
            0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470, 
              //= keccak256(bytes("0")),    // TODO gas regression test
            block.chainid,
            address(this)
        ));
    }

    function transfer(address dst, uint wad) public returns (bool) {
        balanceOf[msg.sender] -= wad;
        balanceOf[dst] += wad;
        emit Transfer(msg.sender, dst, wad);
        return true;
    }
    function transferFrom(address src, address dst, uint wad)
        public returns (bool)
    {
        if (allowance[src][msg.sender] != type(uint256).max) {
            allowance[src][msg.sender] -= wad;
        }
        balanceOf[src] -= wad;
        balanceOf[dst] += wad;
        emit Transfer(src, dst, wad);
        return true;
    }
    function mint(address usr, uint wad) external {
        ward();
        balanceOf[usr] += wad;
        totalSupply    += wad;
        emit Transfer(address(0), usr, wad);
    }
    function burn(address usr, uint wad) external {
        ward();
        balanceOf[usr] -= wad;
        totalSupply    -= wad;
        emit Transfer(usr, address(0), wad);
    }
    function approve(address usr, uint wad) external returns (bool) {
        allowance[msg.sender][usr] = wad;
        emit Approval(msg.sender, usr, wad);
        return true;
    }

    function push(address usr, uint wad) external {
        transfer(usr, wad);
    }
    function pull(address usr, uint wad) external {
        transferFrom(usr, msg.sender, wad);
    }
    function move(address src, address dst, uint wad) external {
        transferFrom(src, dst, wad);
    }

    // EIP-2612
    function permit(address owner, address spender, uint256 value, uint256 deadline,
                    uint8 v, bytes32 r, bytes32 s) external
    {
        uint nonce = nonces[owner];
        nonces[owner]++;
        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            DOMAIN_SEPARATOR,
            keccak256(abi.encode(
                PERMIT_TYPEHASH,
                owner,
                spender,
                value,
                nonce,
                deadline
            ))
        ));
        address signer = ecrecover(digest, v, r, s);
        if (!(signer != address(0) && owner == signer)) revert ErrPermitSig();
        if (!(block.timestamp <= deadline)) revert ErrPermitTime();
        allowance[owner][spender] = value;
        emit Approval(owner, spender, value);
    }
}
