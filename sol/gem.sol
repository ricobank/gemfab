// SPDX-License-Identifier: AGPL-3.0-or-later

// Copyright (C) 2021 kevin and his friends
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

pragma solidity 0.8.10;

contract Gem {
    string  public name;
    string  public symbol;
    uint256 public totalSupply;
    uint8   public constant decimals = 18;

    mapping (address => uint)                      public balanceOf;
    mapping (address => mapping (address => uint)) public allowance;
    mapping (address => uint)                      public nonces;
    mapping (address => bool)                      public wards;

    bytes32 immutable PERMIT_TYPEHASH = keccak256(
        'Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)'
    );
    bytes32 immutable DOMAIN_SEPARATOR = keccak256(abi.encode(
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
        keccak256("GemPermit"),
        keccak256(bytes("0")),
        block.chainid,
        address(this)
    ));

    event Approval(address indexed src, address indexed usr, uint wad);
    event Transfer(address indexed src, address indexed dst, uint wad);
    event Ward(address indexed setter, address indexed user, bool authed);
 
    error ErrPermitDeadline();
    error ErrPermitSignature();
    error ErrOverflow();
    error ErrUnderflow();
    error ErrWard();

    constructor(string memory name_, string memory symbol_)
      payable
    {
        name = name_;
        symbol = symbol_;

        wards[msg.sender] = true;
        emit Ward(msg.sender, msg.sender, true);
    }

    function ward(address usr, bool authed)
      payable external
    {
        if (!wards[msg.sender]) revert ErrWard();
        wards[usr] = authed;
        emit Ward(msg.sender, usr, authed);
    }

    function mint(address usr, uint wad)
      payable external
    {
        if (!wards[msg.sender]) revert ErrWard();
        // only need to check totalSupply for overflow
        unchecked {
            uint256 prev = totalSupply;
            if (prev + wad < prev) {
                revert ErrOverflow();
            }
            balanceOf[usr] += wad;
            totalSupply     = prev + wad;
            emit Transfer(address(0), usr, wad);
        }
    }

    function burn(address usr, uint wad)
      payable external
    {
        if (!wards[msg.sender]) revert ErrWard();
        // only need to check balanceOf[usr] for underflow
        unchecked {
            uint256 prev = balanceOf[usr];
            uint256 next = prev - wad;
            balanceOf[usr] = next;
            totalSupply    -= wad;
            emit Transfer(usr, address(0), wad);
            if (next > prev) {
                revert ErrUnderflow();
            }
        }
    }

    function transfer(address dst, uint wad)
      payable external returns (bool)
    {
        unchecked {
            uint256 prev = balanceOf[msg.sender];
            balanceOf[msg.sender] = prev - wad;
            balanceOf[dst]       += wad;
            emit Transfer(msg.sender, dst, wad);
            if( prev < wad ) {
                revert ErrUnderflow();
            }
            return true;
        }
    }

    function transferFrom(address src, address dst, uint wad)
      payable external returns (bool)
    {
        unchecked {
            uint256 prev = allowance[src][msg.sender];
            if ( prev != type(uint256).max ) {
                allowance[src][msg.sender] = prev - wad;
                if( prev < wad ) {
                    revert ErrUnderflow();
                }
            }
            prev = balanceOf[src];
            balanceOf[src]  = prev - wad;
            balanceOf[dst] += wad;
            emit Transfer(src, dst, wad);
            if( prev < wad ) {
                revert ErrUnderflow();
            }
            return true;
        }
    }

    function approve(address usr, uint wad)
      payable external returns (bool)
    {
        allowance[msg.sender][usr] = wad;
        emit Approval(msg.sender, usr, wad);
        return true;
    }

    // EIP-2612
    function permit(address owner, address spender, uint256 value, uint256 deadline,
                    uint8 v, bytes32 r, bytes32 s)
      payable external
    {
        uint nonce = nonces[owner];
        unchecked {
            nonces[owner] = nonce + 1;
        }
        allowance[owner][spender] = value;
        emit Approval(owner, spender, value);
        bytes32 digest = keccak256(abi.encodePacked( "\x19\x01", DOMAIN_SEPARATOR,
            keccak256(abi.encode( PERMIT_TYPEHASH, owner, spender, value, nonce, deadline ))));
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) { revert ErrPermitSignature(); }
        if (owner != signer) { revert ErrPermitSignature(); }
        if (block.timestamp > deadline) { revert ErrPermitDeadline(); }
    }
}

contract GemFab {
    mapping(address=>bool) public built;

    event Build(address indexed caller, address indexed gem);

    function build(string memory name, string memory symbol)
      payable external returns (Gem gem)
    {
        gem = new Gem(name, symbol);
        gem.ward(msg.sender, true);
        gem.ward(address(this), false);
        built[address(gem)] = true;
        emit Build(msg.sender, address(gem));
        return gem;
    }
}

