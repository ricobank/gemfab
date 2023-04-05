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

rule transferSpec(address recip, uint amt) {

    env e;
    address sender = e.msg.sender;
    
    require(balanceOf(e.msg.sender) + balanceOf(recip) < totalSupply());

    // mathint type that represents an integer of any size;
    mathint balance_sender_before = balanceOf(sender);
    mathint balance_recip_before = balanceOf(recip);

    transfer(e, recip, amt);

    mathint balance_sender_after = balanceOf(sender);
    mathint balance_recip_after = balanceOf(recip);

    // operations on mathints can never overflow or underflow. 
    assert recip != sender => balance_sender_after == balance_sender_before - amt,
        "transfer must decrease sender's gem balance by amount sent";

    assert recip != sender => balance_recip_after == balance_recip_before + amt,
        "transfer must increase recipient's gem balance by amount sent";

    assert recip == sender => balance_sender_after == balance_sender_before,
        "transfer must not change sender's gem balance when recip is self";
}

rule mintSupplyBalanceSpec(address recip, uint amt) {
    
    env e;
    require(balanceOf(e.msg.sender) + balanceOf(recip) < totalSupply());
    mathint balance_recip_before = balanceOf(recip);
    mathint total_supply_before = totalSupply();

    mint(e, recip, amt);

    mathint balance_recip_after = balanceOf(recip);
    mathint total_supply_after = totalSupply();

    assert balance_recip_after == balance_recip_before + amt, "recip balance did not increase by mint amount";
    assert total_supply_after == total_supply_before + amt, "total supply did not increase by mint amount";

}

rule mintOverflowSpec(address recip, uint amt) {
    
    env e;
    mathint total_supply = totalSupply();
    require(total_supply + amt > max_uint256);

    mint@withrevert(e, recip, amt);
    assert lastReverted, "mint must revert if total supply overflows";
}

rule burnSupplyBalanceSpec(address burn, uint amt) {

    env e;
    require(balanceOf(burn) <= amt);
    require(balanceOf(burn) <= totalSupply());

    mathint total_supply_before = totalSupply();
    mathint balance_before = balanceOf(burn);
    burn(e, burn, amt);

    mathint total_supply_after = totalSupply();
    mathint balance_after = balanceOf(burn);

    assert total_supply_after == total_supply_before - amt, "totalSupply did not decrease by burn amount";
    assert balance_after == balance_before - amt, "usr balance did not decrease by burn amount";
}

rule burnUnderflowSpec(address recip, uint amt) {
    
    env e;
    require(balanceOf(recip) < amt);

    burn@withrevert(e, recip, amt);
    assert lastReverted, "burn must revert if total supply underflows";
}

rule mintAndBurnWardSpec(address other, uint amt) {

    env e;
    address sender = e.msg.sender;
    ward(e, sender, false);

    mint@withrevert(e, other, amt);
    assert lastReverted, "mint did not revert with non-ward sender";

    burn@withrevert(e, other, amt);
    assert lastReverted, "burn did not revert with non-ward sender";
}


rule totalSupplySpec(address target, uint amt) {

    env e; method f; calldataarg args;
    mathint total_supply_before = totalSupply();

    f@withrevert(e, args);

    mathint total_supply_after = totalSupply();

    assert total_supply_before != total_supply_after 
        => 
    (f.selector == mint(address,uint).selector || f.selector == burn(address,uint).selector)
    && wards(e.msg.sender) == true,
    "function other than warded mint or burn changed total supply!";
}

rule wardSpec(address other_ward) {
        
    env e;
    address sender = e.msg.sender;
    require(wards(sender) == true); // for this spec, assume sender is already a ward

    ward(e, other_ward, true);
    assert wards(other_ward) == true;

    ward(e, other_ward, false);
    assert wards(other_ward) == false;

}

rule approveSpec(address spender, uint amt) {
    
    env e;
    approve(e, spender, amt);
    assert allowance(e.msg.sender, spender) == amt, "spender allowance does not match intended amount";
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

rule transferFromRevertSpec(address src, address dst, uint amt) {

    env e;
    address sender = e.msg.sender;
    require(allowance(src, sender) < amt || balanceOf(src) < amt);
    require(amt > 0);
    require(allowance(src, sender) < max_uint256);

    transferFrom@withrevert(e, src, dst, amt);

    assert lastReverted, "transferFrom did not revert when expected to";


}

rule totalSupplyInvariant(method f) {
        calldataarg args;
    
    env e;
    mathint total_supply_before = totalSupply();
    require(total_supply_before == ghostSupply); // must be true at all times

    f@withrevert(e, args);

    mathint total_supply_after = totalSupply();
    assert total_supply_after == ghostSupply, "total_supply diverged from balanceOf storage writes";
  
}