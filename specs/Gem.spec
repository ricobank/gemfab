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
    ward(e, ward, true);
    mint(e, recip, amount);
    mathint balance_recip_after = balanceOf(recip);

    assert balance_recip_after == balance_recip_before + amount, "did not increase on mint";

}

