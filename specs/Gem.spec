methods {
    balanceOf(address)         returns(uint) envfree
    allowance(address,address) returns(uint) envfree
    totalSupply()              returns(uint) envfree
    wards(address)             returns(bool) envfree
    transferFrom(address,address,uint) returns(bool)
    mint(address,uint)
    burn(address,uint)
}

ghost uint ghostSupply;

hook Sstore balanceOf[KEY address own] uint256 new_balance (uint256 old_balance) STORAGE {
    // holds for transfers because net value of writes on balanceOf should be 0
    ghostSupply = ghostSupply + (new_balance - old_balance);
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

rule onlyMintAndBurnCanChangeTotalSupply(address target, uint amt) {

    env e; method f; calldataarg args;
    mathint total_supply_before = totalSupply();

    f@withrevert(e, args);

    mathint total_supply_after = totalSupply();

    assert total_supply_before != total_supply_after 
        => 
    (f.selector == mint(address,uint).selector || f.selector == burn(address,uint).selector),
    "function other than mint or burn changed total supply!";


}

rule burnMustNeverUnderflow {
        address recip; uint amount;
    
    env e;
    require(balanceOf(recip) < amount);

    burn@withrevert(e, recip, amount);
    assert lastReverted, "burn must revert if total supply underflows";
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

rule wardSpec {
        address other_ward;
    
    env e;
    address sender = e.msg.sender;
    require(wards(sender) == true); // for this spec, assume sender is already a ward

    ward(e, other_ward, true);
    assert wards(other_ward) == true;

    ward(e, other_ward, false);
    assert wards(other_ward) == false;

}

rule approveSpec {
        address spender; uint amount;
    
    env e;

    approve(e, spender, amount);

    assert allowance(e.msg.sender, spender) == amount, "spender allowance does not match intended amount";
}

rule transferFromSpec(address src, address dst, uint amt) {

    env e;
    address sender = e.msg.sender;
    require(allowance(src, sender) >= amt);
    require(balanceOf(src) >= amt);
    require(balanceOf(src) <= max_uint256);
    require(balanceOf(dst) <= max_uint256 - amt);
    
    mathint balance_src_before = balanceOf(src);
    mathint balance_dst_before = balanceOf(dst);
    mathint allowance_before = allowance(src, sender);

    transferFrom(e, src, dst, amt);

    // true to matter what
    assert allowance(src, sender) == allowance_before - amt 
            || (allowance_before == max_uint256 && allowance_before == allowance(src, sender)), 
        "allowance did not decrease by transferFrom amt";

    // conditionals
    if(src != dst){
        assert balanceOf(src) == balance_src_before - amt, "src balance did not decrease by transferFrom amt";
        assert balanceOf(dst) == balance_dst_before + amt, "dst balance did not increase by transferFrom amt";
    } else {
        assert balanceOf(src) == balanceOf(dst) 
            && balanceOf(src) == balance_src_before
            && balanceOf(dst) == balance_dst_before
            && balance_dst_before == balance_src_before, 
            "balances changed despite transferring to self";
    }
}

// TODO: investigate this spec
/*rule transferFromRevertSpec(address src, address dst, uint amt) {

    env e;
    address sender = e.msg.sender;
    require(allowance(src, sender) < amt || balanceOf(src) < amt);

    transferFrom@withrevert(e, src, dst, amt);

    assert lastReverted, "transferFrom did not revert when expected to";


}*/

rule totalSupplyInvariant(method f) {
        calldataarg args;
    
    env e;
    mathint total_supply_before = totalSupply();
    require(total_supply_before == ghostSupply); // must be true at all times

    f@withrevert(e, args);

    mathint total_supply_after = totalSupply();
    assert total_supply_after == ghostSupply, "total_supply diverged from balanceOf storage writes";
  
}