pragma solidity ^0.4.24;

import "../InvestorsStorage.sol";
import "../PrivateEntrance.sol";


contract MockStorage2 is SpecStorage {
  mapping(address => InvestorsStorage.Investor) public investors;
  
  function investorInfo(address addr) public view returns(uint investment, uint paymentTime) {
    investment = investors[addr].investment;
    paymentTime = investors[addr].paymentTime;
  }

  function setInvestor(address addr, uint investment, uint payOut, uint paymentTime ) public {
    investors[addr] = InvestorsStorage.Investor(investment, payOut, paymentTime);
  }
}

