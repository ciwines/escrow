const {
    ether,
    expectRevert,
} = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');
const {
    assert
} = require('chai');

const timeMachine = require('ganache-time-traveler');

const Escrow = artifacts.require("Escrow");
const Token = artifacts.require("Token");

contract ('Escrow', (accounts) => {
    const seller = accounts[0];
    const buyer = accounts[1];
    const notAuth = accounts[4];

    let token;
    let escrow;

    const tokenAmount = ether("100000");
    const halfTokenAmount = ether("50000");
    const maticAmount = ether("40");
    const halfMaticAmount = ether("20");

    describe("Initial setup", async () => {
        it("retreive deployed instances", async () => {
            token = await Token.deployed();
            escrow = await Escrow.deployed();
        });
    });

    describe("Offer decision phase", async () => {
        it("inital state is OFFER_DECISION", async () => {
            let state = await escrow.state.call();
            assert(state.toString() == '0', "Incorrect state");
        })

        it("seller place an offer", async () => {
            await expectRevert(escrow.updateOffer(tokenAmount, maticAmount, {from: notAuth}), "Escrow: invalid caller");
            await escrow.updateOffer(tokenAmount, maticAmount, {from: seller});
        });

        it("seller can update the offer", async () =>  {
            await expectRevert(escrow.updateOffer(tokenAmount, maticAmount, {from: notAuth}), "Escrow: invalid caller");
            await escrow.updateOffer(tokenAmount, maticAmount, {from: seller});
        });

        it("seller can confirm the offer", async () => {
            await expectRevert(escrow.concludeOffer({from: notAuth}), "Escrow: invalid caller");
            await escrow.concludeOffer({from: seller});

            let state = await escrow.state.call();
            assert(state.toString() == '1', "Incorrect state");
        });

        it("seller cannot modify offer", async () => {
            await expectRevert(escrow.updateOffer(tokenAmount, maticAmount, {from: seller}), "Escrow: invalid state.");
        });

        it("Cannot call other methods", async () => {
            await expectRevert(escrow.sellerDepositsTokensAndReceivePayment({from: seller}), "Escrow: invalid state");
            await expectRevert(escrow.buyerClaimFirstVestedTokens({from: buyer}), "Escrow: invalid state");
            await expectRevert(escrow.buyerClaimSecondVestedTokens({from: buyer}), "Escrow: invalid state");
        });
    });

    describe("buyer pays in Matic", async () => {
        it("inital state is AWATING_PAYMENT", async () => {
            let state = await escrow.state.call();
            assert(state.toString() == '1', "Incorrect state");
        });

        it("buyer sends too few Matic to the contract", async () => {
            await escrow.sendTransaction({from: buyer, value: halfMaticAmount});

            await expectRevert(escrow.buyerPay({from: notAuth}), "Escrow: invalid caller");
            await expectRevert(escrow.buyerPay({from: buyer}), "Escrow: not enough Matic");
        });

        it("buyer sends other Matic", async () => {
            await escrow.sendTransaction({from: buyer, value: halfMaticAmount});
            await escrow.buyerPay({from: buyer});
        });

        it("escrow contract has the right amount of Matic", async () => {
            let balance = await web3.eth.getBalance(escrow.address);

            assert(balance == maticAmount, "Invalid Matic amount in escrow contract");
        })

        it("state is now AWATING_DELIVERY", async () => {
            let state = await escrow.state.call();
            assert(state.toString() == '2', "Incorrect state");
        });

        it("Cannot call other methods", async () => {
            await expectRevert(escrow.updateOffer(tokenAmount, maticAmount, {from: seller}), "Escrow: invalid state.");
            await expectRevert(escrow.buyerPay({from: buyer}), "Escrow: invalid state");
            await expectRevert(escrow.buyerClaimFirstVestedTokens({from: buyer}), "Escrow: invalid state");
            await expectRevert(escrow.buyerClaimSecondVestedTokens({from: buyer}), "Escrow: invalid state");
        });
    });

    describe("seller deposits token and receive payment", async () => {
        it("inital state is AWATING_DELIVERY", async () => {
            let state = await escrow.state.call();
            assert(state.toString() == '2', "Incorrect state");
        });

        it("seller deposits not enough tokens", async () => {
            await token.transfer(escrow.address, halfTokenAmount, {from: seller});

            await expectRevert(escrow.sellerDepositsTokensAndReceivePayment({from: notAuth}), "Escrow: invalid caller");
            await expectRevert(escrow.sellerDepositsTokensAndReceivePayment({from: seller}), "Escrow: not enough tokens");
        });

        it("seller deposits the right amount of tokens", async () => {
            await token.transfer(escrow.address, halfTokenAmount, {from: seller});
        });

        it("seller can now claim payment", async () => {
            let balanceBefore = await web3.eth.getBalance(seller);
            await escrow.sellerDepositsTokensAndReceivePayment({from: seller});
            let balanceAfter = await web3.eth.getBalance(seller);

            let balanceDiff = balanceAfter - balanceBefore
            console.log("Before: ", balanceBefore, " | After: ", balanceAfter);
            console.log("Payment amount is -> ", balanceDiff);

            let escrowBalance = await web3.eth.getBalance(escrow.address);
            console.log("Escrow balance: ", escrowBalance);
            assert(escrowBalance == 0, "Escrow still has Matic");
        });

        it("state is now VESTING", async () => {
            let state = await escrow.state.call();
            assert(state.toString() == '3', "Incorrect state");
        });

        it("Cannot call other methods", async () => {
            await expectRevert(escrow.updateOffer(tokenAmount, maticAmount, {from: seller}), "Escrow: invalid state.");
            await expectRevert(escrow.buyerPay({from: buyer}), "Escrow: invalid state");
            await expectRevert(escrow.sellerDepositsTokensAndReceivePayment({from: seller}), "Escrow: invalid state.");
        });
    });

    describe("buyer can claim his tokens with a vesting period", async () => {
        it("inital state is VESTING", async () => {
            let state = await escrow.state.call();
            assert(state.toString() == '3', "Incorrect state");
        });

        it("print vesting timestamps", async () => {
            let firstTimestamp = await escrow.firstBuyerClaim.call();
            let secondTimestamp = await escrow.secondBuyerClaim.call();

            console.log("First timestamp -> ", firstTimestamp.toString());
            console.log("Second timestamp -> ", secondTimestamp.toString());
        });

        it("buyer cannot claim tokens before the vesting period", async () => {
            await expectRevert(escrow.buyerClaimFirstVestedTokens({from: notAuth}), "Escrow: invalid caller");
            await expectRevert(escrow.buyerClaimSecondVestedTokens({from: notAuth}), "Escrow: invalid caller");

            await expectRevert(escrow.buyerClaimFirstVestedTokens({from: buyer}), "Escrow: too early");
            await expectRevert(escrow.buyerClaimSecondVestedTokens({from: buyer}), "Escrow: too early");
        });

        it("6 months passes...", async () => {
            const time = 60 * 60 * 24 * 182;
            await timeMachine.advanceTimeAndBlock(time);
        });

        it("buyer can claim tokens after the vesting period", async () => {
            let balanceBefore = await token.balanceOf(buyer);
            await escrow.buyerClaimFirstVestedTokens({from: buyer});
            let balanceAfter = await token.balanceOf(buyer);

            let balanceDiff = balanceAfter.sub(balanceBefore);
            assert(balanceDiff.toString() == halfTokenAmount.toString(), "Incorrect token amount");

            await expectRevert(escrow.buyerClaimFirstVestedTokens({from: buyer}), "Escrow: already claimed");
            await expectRevert(escrow.buyerClaimSecondVestedTokens({from: buyer}), "Escrow: too early");
        });

        it("Cannot call other methods", async () => {
            await expectRevert(escrow.updateOffer(tokenAmount, maticAmount, {from: seller}), "Escrow: invalid state.");
            await expectRevert(escrow.buyerPay({from: buyer}), "Escrow: invalid state");
            await expectRevert(escrow.sellerDepositsTokensAndReceivePayment({from: seller}), "Escrow: invalid state.");
        });

        it("buyer cannot claim tokens before the vesting period", async () => {
            await expectRevert(escrow.buyerClaimFirstVestedTokens({from: notAuth}), "Escrow: invalid caller");
            await expectRevert(escrow.buyerClaimSecondVestedTokens({from: notAuth}), "Escrow: invalid caller");

            await expectRevert(escrow.buyerClaimFirstVestedTokens({from: buyer}), "Escrow: already claimed");
            await expectRevert(escrow.buyerClaimSecondVestedTokens({from: buyer}), "Escrow: too early");
        });

        it("6 months passes...", async () => {
            const time = 60 * 60 * 24 * 183;
            await timeMachine.advanceTimeAndBlock(time);
        });

        it("buyer can claim tokens after the vesting period", async () => {
            let balanceBefore = await token.balanceOf(buyer);
            await escrow.buyerClaimSecondVestedTokens({from: buyer});
            let balanceAfter = await token.balanceOf(buyer);

            let balanceDiff = balanceAfter.sub(balanceBefore);
            assert(balanceDiff.toString() == halfTokenAmount.toString(), "Incorrect token amount");

            await expectRevert(escrow.buyerClaimSecondVestedTokens({from: buyer}), "Escrow: already claimed");
        });

        it("Cannot call other methods", async () => {
            await expectRevert(escrow.updateOffer(tokenAmount, maticAmount, {from: seller}), "Escrow: invalid state.");
            await expectRevert(escrow.buyerPay({from: buyer}), "Escrow: invalid state");
            await expectRevert(escrow.sellerDepositsTokensAndReceivePayment({from: seller}), "Escrow: invalid state.");
        });
    })
});