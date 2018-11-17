pragma solidity ^0.4.24;

import "../Lexi.sol";


contract MockGetMyDividends {
  function() public payable {}
  
  function getMyDividends(address LexiAddr) public {
    Lexi lexi = Lexi(LexiAddr);
    lexi.getMyDividends();
  }
}