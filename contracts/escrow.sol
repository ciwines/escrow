// SPDX-License-Identifier: MIT
// Author: Emanuele Civini | me@emanuelecivini.it
// File: contracts/escrow.sol
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Escrow {
    using SafeERC20 for IERC20;

    // States definition
    enum State { OFFER_DECISION, AWAITING_PAYMENT, AWAITING_DELIVERY, VESTING }

    // Variables
    address payable public seller;
    address public buyer;
    address public token;
    State public state;

    uint256 public firstBuyerClaim;
    uint256 public secondBuyerClaim;

    uint256 public tokenAmount;
    uint256 public maticAmount;

    bool public firstClaimDone;
    bool public secondClaimDone;

    // Constructor
    constructor (address  _seller, address _buyer, address _token) {
        seller = payable(_seller);
        buyer = _buyer;
        token = _token;

        firstClaimDone = false;
        secondClaimDone = false;

        state = State.OFFER_DECISION;
    }   

    // Methods

    /**
     * @notice Let the seller specify the offer
     * @param _tokenAmount The amount of token to sell
     * @param _maticAmount The amount of Matic to receive
     */
    function updateOffer(uint256 _tokenAmount, uint256 _maticAmount) external {
        require(msg.sender == seller, "Escrow: invalid caller");
        require(state == State.OFFER_DECISION, "Escrow: invalid state.");

        tokenAmount = _tokenAmount;
        maticAmount = _maticAmount;
    }

    /**
     * @notice Confirm an offer. After beign called, it's impossible to change the offer.
     */
    function concludeOffer() external {
        require(msg.sender == seller, "Escrow: invalid caller");

        state = State.AWAITING_PAYMENT;
    }

    /**
     * @notice Update the state of the escrow only if the payment has arrived.
     */
    function buyerPay() external {
        require(msg.sender == buyer, "Escrow: invalid caller");
        require(state == State.AWAITING_PAYMENT, "Escrow: invalid state");

        uint256 maticBalance = address(this).balance;
        require(maticBalance >= maticAmount, "Escrow: not enough Matic");

        state = State.AWAITING_DELIVERY;
    }

    /**
     * @notice Checks that the contract has the right amount of tokens, then transfers payment amount 
                of Matic to the seller and then starts the vesting period.
     */
    function sellerDepositsTokensAndReceivePayment() external {
        require(msg.sender == seller, "Escrow: invalid caller");
        require(state == State.AWAITING_DELIVERY, "Escrow: invalid state");

        // Check if there are enough tokens in the contract
        uint256 tokenBalance = IERC20(token).balanceOf(address(this));
        require(tokenBalance >= tokenAmount, "Escrow: not enough tokens");

        // Claim the payment
        seller.transfer(address(this).balance);

        // Set the vesting dates
        firstBuyerClaim = block.timestamp + (182 days);
        secondBuyerClaim = block.timestamp + (365 days);

        // Update the state
        state = State.VESTING;
    }

    /**
     * @notice Let the buyer claim half of his tokens after a vesting period of 6 months.
     */
    function buyerClaimFirstVestedTokens() external {
        require(msg.sender == buyer, "Escrow: invalid caller");
        require(state == State.VESTING, "Escrow: invalid state");
        require(block.timestamp >= firstBuyerClaim, "Escrow: too early");
        require(!firstClaimDone, "Escrow: already claimed");

        uint256 transferQuantity = tokenAmount / 2;
        IERC20 tokenObj = IERC20(token);
        SafeERC20.safeTransfer(tokenObj, buyer, transferQuantity);

        firstClaimDone = true;
    }   

    /**
     * @notice Let the buyer claim half of his tokens after a vesting period of a year.
     */
    function buyerClaimSecondVestedTokens() external {
        require(msg.sender == buyer, "Escrow: invalid caller");
        require(state == State.VESTING, "Escrow: invalid state");
        require(block.timestamp >= secondBuyerClaim, "Escrow: too early");
        require(!secondClaimDone, "Escrow: already claimed");

        IERC20 tokenObj = IERC20(token);
        uint256 transferQuantity = tokenObj.balanceOf(address(this));
        SafeERC20.safeTransfer(tokenObj, buyer, transferQuantity);

        secondClaimDone = true;
    }   

    ///////////////////////////////////////////////////////////////////////////////////////////////
    // Receive Matic
    fallback() external payable {
    }

    receive() external payable {
    }
}