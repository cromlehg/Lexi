pragma solidity 0.4.24;

import './Zero.sol';

contract Accessibility {

  using Zero for *;

  address private owner;

  modifier onlyOwner() {
    require(msg.sender == owner, "access denied");
    _;
  }

  constructor() public {
    owner = msg.sender;
  }

  function disown() internal {
    delete owner;
  }

  function transferOwnership(address newOwner) public onlyOwner {
    newOwner.requireNotZero();
    owner = newOwner;
  }

}
