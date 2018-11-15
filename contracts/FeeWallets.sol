pragma solidity ^0.4.24;

import './utils/Accessibility.sol';
import './math/Percent.sol';
import './math/SafeMath.sol';

contract FeeWallets is Accessibility {

  using Percent for Percent.percent;
  using SafeMath for uint;

  uint private feeWalletsCount;

  Percent.percent[] private feePercents; 
  
  address[] private feeWallets;

  function feeWalletPercent(uint i) public view returns(uint numerator, uint denominator) {
    require(i < feeWalletsCount, "wallet not exists");
    (numerator, denominator) = (feePercents[i].num, feePercents[i].den);
  }

  function changeFeeWallet(uint i, address wallet) public onlyOwner {
    wallet.requireNotZero();
    feeWallets[i] = wallet;
  }
 
  function addFeeWallet(address wallet, uint percent, uint percentRate) public onlyOwner {
    feePercents.push(Percent.percent(percent, percentRate));
    feeWallets.push(wallet);
    feeWalletsCount = feeWalletsCount.add(1);
  }

  function processFee(uint base) internal {
    for(uint i = 0; i < feeWallets.length; i++) {
      feeWallets[i].transfer(feePercents[i].mul(base)); 
    }
  }

}
