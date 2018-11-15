pragma solidity ^0.4.24;

import "../FeeWallets.sol";

contract TestFeeWallets is FeeWallets {
  function doProcessFee(uint base) public {
    processFee(base);
  }
  function () public payable {}
}
