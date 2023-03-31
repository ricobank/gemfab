methods {
    balanceOf(address)         returns(uint) envfree
    allowance(address,address) returns(uint) envfree
    totalSupply()              returns(uint) envfree
}

rule basicTransferSpec {
     address recip; uint amount;

    env e;
    address sender = e.msg.sender;
    
    require(balanceOf(e.msg.sender) + balanceOf(recip) < totalSupply());

    // mathint type that represents an integer of any size;
    mathint balance_sender_before = balanceOf(sender);
    mathint balance_recip_before = balanceOf(recip);

    transfer(e, recip, amount);

    mathint balance_sender_after = balanceOf(sender);
    mathint balance_recip_after = balanceOf(recip);

    // operations on mathints can never overflow or underflow. 
    assert recip != sender => balance_sender_after == balance_sender_before - amount,
        "transfer must decrease sender's gem balance by amount sent";

    assert recip != sender => balance_recip_after == balance_recip_before + amount,
        "transfer must increase recipient's gem balance by amount sent";

    assert recip == sender => balance_sender_after == balance_sender_before,
        "transfer must not change sender's gem balance when recip is self";
}

rule basicMintSpec {
        address recip; uint amount;
    
    env e;
    require(balanceOf(e.msg.sender) + balanceOf(recip) < totalSupply());
    address ward = e.msg.sender;
    mathint balance_recip_before = balanceOf(recip);
    mathint total_supply_before = totalSupply();

    ward(e, ward, true);
    mint(e, recip, amount);

    mathint balance_recip_after = balanceOf(recip);
    mathint total_supply_after = totalSupply();

    assert balance_recip_after == balance_recip_before + amount, "recip balance did not increase on mint";
    assert total_supply_after == total_supply_before + amount, "total supply did not increase correctly";

}

rule mintMustNeverOverflow {
        address recip; uint amount;
    
    env e;
    require(totalSupply() + amount > max_uint256);

    mint@withrevert(e, recip, amount);
    assert lastReverted, "mint must revert if total supply overflows";
}

rule burnMustAlwaysDecreaseBalanceAndTotalSupply() {
        address burn; uint amount;
    env e;
    require(balanceOf(burn) <= amount);
    require(balanceOf(burn) <= totalSupply());

    mathint total_supply_before = totalSupply();
    mathint balance_before = balanceOf(burn);
    burn(e, burn, amount);

    assert totalSupply() == total_supply_before - amount, "totalSupply did not decrease by burn amount";
    assert balanceOf(burn) == balance_before - amount, "usr balance did not decrease by burn amount";
}

rule burnMustNeverUnderflow {
        address recip; uint amount;
    
    env e;
    require(balanceOf(recip) < amount);

    burn@withrevert(e, recip, amount);
    assert lastReverted, "burn must revert if total supply underflows";
}

