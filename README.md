# How to interact with this smart contract
In order to interact with this escrow contract there has to be two parts:
 *  a buyer, the one that wants to buy the token with Matic
 *  a seller, the one that wants to exchange its token with Matic

This smart contract operates in the following way:
1) the seller makes one or more offer by calling the updateOffer method
2) once the offer is defined, the seller can confirm it by calling the concludeOffer. From now on it's impossible to change the offer
3) now the buyer can transfer the defined amount of Matic to the contract, then he can call the buyerPay method to confirm the payment
4) the seller can now transfer the tokens to the contract and call the sellerDepositsTokensAndReceivePayment in order start the vesting period and receive the payment
5) after a period of 6 months after point (4) the buyer can now claim the first half of his tokens
6) after a period of a year after point (4) the buyer can claim the second half of his tokens