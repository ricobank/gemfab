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

rule mintMustAlwaysIncreaseBalanceAndTotalSupply {
        address recip; uint amount;
    
    env e;
    require(balanceOf(e.msg.sender) + balanceOf(recip) < totalSupply());
    mathint balance_recip_before = balanceOf(recip);
    mathint total_supply_before = totalSupply();

    mint(e, recip, amount);

    mathint balance_recip_after = balanceOf(recip);
    mathint total_supply_after = totalSupply();

    assert balance_recip_after == balance_recip_before + amount, "recip balance did not increase by mint amount";
    assert total_supply_after == total_supply_before + amount, "total supply did not increase by mint amount";

}

rule mintAndBurnMustAlwaysRequireWard {
        address other; uint amount;

    env e;
    address sender = e.msg.sender;
    ward(e, sender, false);

    mint@withrevert(e, other, amount);
    assert lastReverted, "mint did not revert with non-ward sender";

    burn@withrevert(e, other, amount);
    assert lastReverted, "burn did not revert with non-ward sender";
}

rule mintMustNeverOverflow {
        address recip; uint amount;
    
    env e;
    mathint total_supply = totalSupply();
    require(total_supply + amount > max_uint256);

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

    mathint total_supply_after = totalSupply();
    mathint balance_after = balanceOf(burn);

    assert total_supply_after == total_supply_before - amount, "totalSupply did not decrease by burn amount";
    assert balance_after == balance_before - amount, "usr balance did not decrease by burn amount";
}

rule burnMustNeverUnderflow {
        address recip; uint amount;
    
    env e;
    require(balanceOf(recip) < amount);

    burn@withrevert(e, recip, amount);
    assert lastReverted, "burn must revert if total supply underflows";
}

