pragma solidity 0.4.24;

import './utils/Accessibility.sol';

contract InvestorsStorage is Accessibility {
  struct Investor {
    uint investment;
    uint payOut;
    uint paymentTime;
  }
  uint public size;

  mapping (address => Investor) private investors;

  function isInvestor(address addr) public view returns (bool) {
    return investors[addr].investment > 0;
  }

  function investorInfo(address addr) public view returns(uint investment, uint paymentTime, uint payOut) {
    investment = investors[addr].investment;
    paymentTime = investors[addr].paymentTime;
    payOut = investors[addr].payOut;
  }

  function newInvestor(address addr, uint investment, uint paymentTime) public onlyOwner returns (bool) {
    Investor storage inv = investors[addr];
    if (inv.investment != 0 || investment == 0) {
      return false;
    }
    inv.investment = investment;
    inv.paymentTime = paymentTime;
    size++;
    return true;
  }

  function deleteInvestor(address addr) public onlyOwner returns (bool) {
    Investor storage inv = investors[addr];
    inv.investment = 0;
    inv.payOut = 0;
    inv.paymentTime = 0;
    return true;
  }

  function addInvestment(address addr, uint investment) public onlyOwner returns (bool) {
    if (investors[addr].investment == 0) {
      return false;
    }
    investors[addr].investment += investment;
    return true;
  }

  function getPayOut(address addr) public view returns(uint) {
    return investors[addr].payOut;
  }

  function addPayOut(address addr, uint toAddPayOut) public onlyOwner returns (bool) {
    investors[addr].payOut += toAddPayOut;
    return true;
  }

  function setPaymentTime(address addr, uint paymentTime) public onlyOwner returns (bool) {
    if (investors[addr].investment == 0) {
      return false;
    }
    investors[addr].paymentTime = paymentTime;
    return true;
  }
}


