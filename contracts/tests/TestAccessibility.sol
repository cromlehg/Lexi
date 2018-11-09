pragma solidity ^0.4.24;

import "../utils/Accessibility.sol";


contract TestAccessibility is Accessibility {
  function accessOnlyOwner() public view onlyOwner {}
  function doDisown() public {
    disown();
  }
}
