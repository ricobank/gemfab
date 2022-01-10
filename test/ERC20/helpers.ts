// redo expectEvent to work with web3
//     https://github.com/OpenZeppelin/openzeppelin-test-helpers/blob/master/src/expectEvent.js
//
// The MIT License (MIT)
// Copyright (c) 2018 OpenZeppelin
// https://github.com/OpenZeppelin/openzeppelin-test-helpers/blob/master/LICENSE

const {expect} = require("chai");
function expectEvent (receipt, eventName, eventArgs = {}) {
    const args = Object.keys(eventArgs).map((key) => {return eventArgs[key]})
    let found = false
    receipt.events.forEach(event => {
        if( event.event == eventName ) {
            let match = true
            Object.keys(eventArgs).forEach(key => {
                try {
                    expect(eventArgs[key]).to.eql(event.args[key])
                } catch {
                    match = false
                }
            })
            found = found || match
        }
    })

    expect(found).to.equal(true, `No '${eventName}' events found with args ${args}`);
}

module.exports = { expectEvent }
