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

    bytes32 public immutable PERMIT_TYPEHASH = keccak256(
        'Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)'
    );
    bytes32 public immutable DOMAIN_SEPARATOR = keccak256(abi.encode(
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
        keccak256("GemPermit"),
        keccak256(bytes("0")),
        block.chainid,
        address(this)
    ));

    event Approval(address indexed src, address indexed usr, uint wad);
    event Transfer(address indexed src, address indexed dst, uint wad);
    event Ward(address indexed caller, address indexed trusts, bool bit);
 
    error ErrPermitDeadline();
    error ErrPermitSignature();
    error ErrOverflow();
    error ErrUnderflow();
    error ErrAuth(bytes4 sig);

    modifier auth() {
        if (!wards[msg.sender]) revert ErrAuth(msg.sig);
        _;
    }

    constructor(string memory name_, string memory symbol_) {
        name = name_;
        symbol = symbol_;

        wards[msg.sender] = true;
        emit Ward(msg.sender, msg.sender, true);
    }

    function rely(address usr) external auth {
        wards[usr] = true;
        emit Ward(msg.sender, usr, true);
    }

    function deny(address usr) external auth {
        wards[usr] = false;
        emit Ward(msg.sender, usr, false);
    }

    function transfer(address dst, uint wad) external returns (bool) {
        unchecked {
            uint256 prev = balanceOf[msg.sender];
            if( prev < wad ) {
                revert ErrUnderflow();
            }
            balanceOf[msg.sender] = prev - wad;
            balanceOf[dst]       += wad;
            emit Transfer(msg.sender, dst, wad);
            return true;
        }
    }

    function transferFrom(address src, address dst, uint wad)
        external returns (bool)
    {
        unchecked {
            uint256 prev = allowance[src][msg.sender];
            if ( prev != type(uint256).max ) {
                if( prev < wad ) {
                    revert ErrUnderflow();
                }
                allowance[src][msg.sender] = prev - wad;
            }
            prev = balanceOf[src];
            if( prev < wad ) {
                revert ErrUnderflow();
            }
            balanceOf[src]  = prev - wad;
            balanceOf[dst] += wad;
            emit Transfer(src, dst, wad);
            return true;
        }
    }

    function mint(address usr, uint wad) external auth {
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

    function burn(address usr, uint wad) external auth {
        // only need to check balanceOf[usr] for underflow
        unchecked {
            uint256 prev = balanceOf[usr];
            uint256 next = prev - wad;
            if (next > prev) {
                revert ErrUnderflow();
            }
            balanceOf[usr] = next;
            totalSupply    -= wad;
            emit Transfer(usr, address(0), wad);
        }
    }

    function approve(address usr, uint wad) external returns (bool) {
        allowance[msg.sender][usr] = wad;
        emit Approval(msg.sender, usr, wad);
        return true;
    }

    // EIP-2612
    function permit(address owner, address spender, uint256 value, uint256 deadline,
                    uint8 v, bytes32 r, bytes32 s) external
    {
        uint nonce = nonces[owner];
        bytes32 digest = keccak256(abi.encodePacked( "\x19\x01", DOMAIN_SEPARATOR,
            keccak256(abi.encode( PERMIT_TYPEHASH, owner, spender, value, nonce, deadline ))));
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0) || owner != signer) { revert ErrPermitSignature(); }
        if (block.timestamp > deadline) { revert ErrPermitDeadline(); }
        unchecked {
            nonces[owner] = nonce + 1;
        }
        allowance[owner][spender] = value;
        emit Approval(owner, spender, value);
    }

}

contract GemFab {
    mapping(address=>bool) public built;

    event Build(address indexed caller, address indexed gem, string symbol);

    function build(string memory name, string memory symbol) public returns (Gem gem) {
        gem = new Gem(name, symbol);
        gem.rely(msg.sender);
        gem.deny(address(this));
        built[address(gem)] = true;
        emit Build(msg.sender, address(gem), symbol);
        return gem;
    }
}

