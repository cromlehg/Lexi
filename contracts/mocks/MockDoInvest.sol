pragma solidity ^0.4.24;

import "../Lexi.sol";


contract MockDoInvest {
  function doInvest(address LexiAddr, address referrerAddr) public payable {
    Lexi lexi = Lexi(LexiAddr);
    lexi.doInvest.value(msg.value)(referrerAddr);
  }
}