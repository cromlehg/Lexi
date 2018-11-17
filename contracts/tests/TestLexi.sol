pragma solidity ^0.4.24;

import "../Lexi.sol";


contract TestLexi is Lexi {
  function receiveEther() public payable {}

  function testGetMemInvestor(address investorAddr) public view returns(uint, uint, uint) {
    InvestorsStorage.Investor memory inv = getMemInvestor(investorAddr);
    return (inv.investment, inv.payOut, inv.paymentTime);
  }

  function testCanPayOut(address investorAddr) public view returns(uint canPayOutDividents) {
    return canPayOut(investorAddr);
  }
}