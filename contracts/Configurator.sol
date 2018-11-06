pragma solidity 0.4.24;

import './utils/Accessibility.sol';
import './Lexi.sol';

contract Configurator is Accessibility {

  Lexi public lexi;

  function configure() public onlyOwner {
    address manager = 0xabfcADb67Dc92A4bbcCC8bf32Fd25e2e86a2A870;

    lexi = new Lexi();
    lexi.addFeeWallet(0xabfcADb67Dc92A4bbcCC8bf32Fd25e2e86a2A870, 7, 100);
    lexi.addFeeWallet(0xabfcADb67Dc92A4bbcCC8bf32Fd25e2e86a2A870, 15, 1000);
    lexi.addFeeWallet(0xabfcADb67Dc92A4bbcCC8bf32Fd25e2e86a2A870, 15, 1000);
    lexi.initOnce(200, 100, 1, 100, 3, 100, 1, 100);
    lexi.init(now + 1, 150 ether, 14, 50 ether);
    lexi.transferOwnership(manager);
  }

}
