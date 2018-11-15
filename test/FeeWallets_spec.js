import getAccounts from './helpers/getAccounts';
import assertRevert from './helpers/assertRevert';
import { ZERO_ADDRESS } from './helpers/zeroAddress';
import ether from './helpers/ether';
import getBalance from './helpers/getBalance';
import BigNumber from 'bignumber.js';
const FeeWallets = artifacts.require('./contracts/test/TestFeeWallets.sol');

let instance, owner, addr1, addr2, addr3;

let initContract = async function () {
  instance = await FeeWallets.new({ from: owner });
};

contract('FeeWallets', () => {
  before(async function () {
    let accs = await getAccounts();
    owner = accs[0];
    addr1 = accs[1];
    addr2 = accs[2];
    addr3 = accs[3];
    await initContract();
  });
  describe('addFeeWallet', () => {
    it('throw if not owner', async () => {
      await assertRevert(instance.addFeeWallet(addr1, 7, 100, { from: addr1 }));
    });
    it('success if owner', async () => {
      await instance.addFeeWallet(addr1, 7, 100, { from: owner });
    });
  });
  describe('feeWalletPercent view', () => {
    it('throw if not exists', async () => {
      await assertRevert(instance.feeWalletPercent(3, { from: owner }));
    });
    it('success if exists', async () => {
      await instance.addFeeWallet(addr1, 15, 100, { from: owner });
      let percent = await instance.feeWalletPercent(1, { from: owner });
      assert.equal(percent[0].toString(10), '15');
      assert.equal(percent[1].toString(10), '100');
    });
  });
  describe('changeFeeWallet', () => {
    it('throw if not owner', async () => {
      await assertRevert(instance.changeFeeWallet(1, addr2, { from: addr2 }));
    });
    it('throw if zero', async () => {
      await assertRevert(instance.changeFeeWallet(1, ZERO_ADDRESS, { from: owner }));
    });
    it('throw if wallet not exists', async () => {
      await assertRevert(instance.changeFeeWallet(2, addr2, { from: owner }));
    });
    it('success if owner', async () => {
      await instance.changeFeeWallet(1, addr2, { from: owner });
    });
  });
  describe('processFee', () => {
    it('throw if no funds', async () => {
      await assertRevert(instance.doProcessFee(ether(1), { from: owner }));
    });
    it('success', async () => {
      let preBalance1 = await getBalance(addr1);
      let preBalance2 = await getBalance(addr2);
      await instance.sendTransaction({value: ether(1), from: addr3});
      await instance.doProcessFee(ether(1), { from: owner });
      let postBalance1 = await getBalance(addr1);
      let postBalance2 = await getBalance(addr2);
      let diff1 = new BigNumber(postBalance1.toString(10)).minus(preBalance1);
      let diff2 = new BigNumber(postBalance2.toString(10)).minus(preBalance2);
      assert.equal(diff1.toString(10), ether(0.07).toString(10));
      assert.equal(diff2.toString(10), ether(0.15).toString(10));
    });
  });
});
