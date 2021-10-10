// SPDX-License-Identifier: None
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
    /**
     * @dev Constructor that gives msg.sender all of existing tokens.
     */
    constructor() ERC20("TEST Ibiza Token", "TIBZ") {
        uint initialSupply = 1000000000 ether;
        
        _mint(msg.sender, initialSupply);
    }
}