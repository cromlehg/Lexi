pragma solidity 0.4.25;

import './math/Math.sol';
import './PrivateEntrance.sol';
import './SpecStorage.sol';

library PrivateEntrance {
  using PrivateEntrance for privateEntrance;
  using Math for uint;
  struct privateEntrance {
    SpecStorage specStorage;
    uint investorMaxInvestment;
    uint endTimestamp;
    mapping(address=>bool) hasAccess;
  }

  function isActive(privateEntrance storage pe) internal view returns(bool) {
    return pe.endTimestamp > now;
  }

  function maxInvestmentFor(privateEntrance storage pe, address investorAddr) internal view returns(uint) {
    // check if investorAddr has access
    if (!pe.hasAccess[investorAddr]) {
      return 0;
    }

    uint maxInvestment = pe.investorMaxInvestment;

    // get current investment from revolution 2
    (uint currInvestment, ) = pe.specStorage.investorInfo(investorAddr);
    
    if (currInvestment >= maxInvestment) {
      return 0;
    }

    return maxInvestment-currInvestment;
  }

  function provideAccessFor(privateEntrance storage pe, address[] addrs) internal {
    for (uint16 i; i < addrs.length; i++) {
      pe.hasAccess[addrs[i]] = true;
    }
  }
}

