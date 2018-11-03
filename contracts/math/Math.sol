pragma solidity 0.4.25;

library Math {
  function min(uint a, uint b) internal pure returns(uint) {
    if (a > b) {
      return b;
    }
    return a;
  }
}
