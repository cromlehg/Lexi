pragma solidity ^0.4.24;

import "../PrivateEntrance.sol";


contract TestPrivateEntrance {
  using PrivateEntrance for PrivateEntrance.privateEntrance;
  PrivateEntrance.privateEntrance public pe;

  function setStorage(address StorageAddr) public {
    pe.specStorage = SpecStorage(StorageAddr);
  }

  function setInvestorMaxInvestment(uint investorMaxInvestment) public {
    pe.investorMaxInvestment = investorMaxInvestment;
  }

  function setEndTimestamp(uint endTimestamp) public {
    pe.endTimestamp = endTimestamp;
  }

  function setHasAccess(address addr, bool access) public {
    pe.hasAccess[addr] = access;
  }

  function hasAccess(address addr) public view returns(bool access) {
    access = pe.hasAccess[addr];
  }

  function testIsActive() public view returns(bool) {
    return pe.isActive();
  }

  function testMaxInvestmentFor(address addr) public view returns(uint) {
    return pe.maxInvestmentFor(addr);
  }
  
  function testProvideAccessFor(address[] addrs) public {
    return pe.provideAccessFor(addrs);
  }
}
