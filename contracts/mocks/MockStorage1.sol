pragma solidity ^0.4.24;

import "../PrivateEntrance.sol";


contract MockStorage1 is SpecStorage {
  struct Investor {
    uint value;
    uint refBonus;
  }
  mapping(address => Investor) public investors;

  function investorInfo(address addr) public view returns(uint value, uint refBonus) {
    value = investors[addr].value;
    refBonus = investors[addr].refBonus;
  }

  function setInvestor(address addr, uint value, uint refBonus ) public {
    investors[addr] = Investor(value, refBonus);
  }
}

