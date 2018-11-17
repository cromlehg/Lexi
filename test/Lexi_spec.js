import increaseTime, { duration } from './helpers/increaseTime';
import checkPublicABI from './helpers/checkPublicABI';
import ether from './helpers/ether';
import latestGasUsed from './helpers/latestGasUsed';
import latestTime from './helpers/latestTime';
import latestBlock from './helpers/latestBlock';
import assertRevert from './helpers/assertRevert';
import BigNumber from 'bignumber.js';
import { ZERO_ADDRESS } from './helpers/zeroAddress';
import { gasPrice } from './helpers/gasPrice';
import getBalance from './helpers/getBalance';
import sendTransaction from './helpers/sendTransaction';
import waitEvents from './helpers/waitEvents';

const Lexi = artifacts.require('./contracts/Lexi.sol');
const TestLexi = artifacts.require('./contracts/tests/TestLexi.sol');
const MockDoInvest = artifacts.require('./contracts/mocks/MockDoInvest.sol');
const MockGetMyDividends = artifacts.require('./contracts/mocks/MockGetMyDividends.sol');
const MockStorage1 = artifacts.require('./contracts/mocks/MockStorage1.sol');

let instance, creationTime, investment, mockStorage;
let initContract = async function (owner) {
  instance = await Lexi.new({ from: owner });
  await instance.initOnce(200, 100, 1, 100, 3, 100, 1, 100, {from: owner});
  creationTime = await latestTime();
};

function Percent (num, den) {
  this.num = num;
  this.den = den;
  this.interval = duration.minutes(10);
}
Percent.prototype.calcDividends = function (inv, dur) {
  let r = new BigNumber(inv);
  return r
    .times(this.num)
    .dividedToIntegerBy(this.den)
    .times(Math.floor(dur / this.interval))
    .dividedToIntegerBy(144);
};
Percent.prototype.assertEqual = function (percent) {
  assert.equal(percent[0].toString(), '' + this.num);
  assert.equal(percent[1].toString(), '' + this.den);
};
Percent.prototype.mul = function (val) {
  return new BigNumber(val).times(this.num).dividedToIntegerBy(this.den);
};
Percent.prototype.string = function () {
  return `${(100 * this.num / this.den).toFixed(2)}%`;
};
const p1 = new Percent(1, 100);
const p3 = new Percent(3, 100);
const p7 = new Percent(7, 100);
const p15 = new Percent(15, 100);
const p200 = new Percent(200, 100);

let prepareToNextWave = async function (addr) {
  await instance.doInvest(ZERO_ADDRESS, { from: addr, value: ether(1) });
  await increaseTime(duration.days(14));
  await instance.getMyDividends({ from: addr });
  await increaseTime(duration.days(1));
};

contract('Lexi', function ([_, owner, addr1, addr2, addr3, addr4, addr5, addr6, addr7]) {
  describe('check initialization', () => {
    before(async () => {
      await initContract(owner);
    });
    it('has a limited public ABI', () => {
      let expectedABI = [
        'feeWalletPercent',
        'changeFeeWallet',
        'addFeeWallet',
        'transferOwnership',
        'investmentsNumber',
        'waveStartup',
        'maxBalance',
        'investorsNumber',
        'balanceETH',
        'investorInfo',
        'investorDividendsAtNow',
        'getMyDividends',
        'doInvest',
        'doDisown',
        'init',
        'initOnce',
        'privateEntranceProvideAccessFor',
        'rapidGrowthProtectionmMaxInvestmentAtNow',
      ];
      checkPublicABI(Lexi, expectedABI);
    });
    it('investmentsNumber', async () => {
      let a = await instance.investmentsNumber({ from: addr1 });
      assert.equal(a.toString(10), '0');
    });
    it('waveStartup', async () => {
      let a = await instance.waveStartup({ from: addr1 });
      assert.equal(a.toString(10), creationTime.toString(10));
    });
    it('maxBalance', async () => {
      let a = await instance.maxBalance({ from: addr1 });
      assert.equal(a.toString(10), ether(33300000).toString(10));
    });
    it('investorsNumber', async () => {
      let a = await instance.investorsNumber({ from: addr1 });
      assert.equal(a.toString(10), '0');
    });
    it('balanceETH', async () => {
      let a = await instance.balanceETH({ from: addr1 });
      assert.equal(a.toString(10), '0');
    });
  });

  describe('change state', () => {
    before(async () => {
      await initContract(owner);
    });
    context('init', () => {
      it('throw on access denied', async () => {
        await assertRevert(instance.init(10, ether(150), 14, ether(50), { from: addr1 }));
      });
      it('change state', async () => {
        let b = await latestBlock();
        await instance.init(b.timestamp - 10, ether(150), 14, ether(50), { from: owner });
        let r = await instance.rapidGrowthProtectionmMaxInvestmentAtNow({ from: addr1 });
        assert.equal(r.toString(10), ether(150).toString(10));
      });
      it('event LogPEInit', async () => {
        await instance.init(10, ether(150), 14, ether(50), { from: owner });
        let block = await latestBlock();
        let logPEInit = instance.LogPEInit({}, {
          fromBlock: block.number,
          toBlock: block.number,
        });
        const logs = await waitEvents(logPEInit);
        assert.equal(logs.length, 1);
        let e = logs[0];
        assert.equal(e.event, 'LogPEInit');
        assert.equal(e.args.when.toString(10), block.timestamp.toString(10));
        assert.equal(e.args.investorMaxInvestment.toString(10), ether(50).toString(10));
        assert.equal(e.args.endTimestamp.toString(10), '10');
      });
      it('event LogRGPInit', async () => {
        await instance.init(10, ether(150), 14, ether(50), { from: owner });
        let block = await latestBlock();
        let logRGPInit = instance.LogRGPInit({}, {
          fromBlock: block.number,
          toBlock: block.number,
        });
        const logs = await waitEvents(logRGPInit);
        assert.equal(logs.length, 1);
        let e = logs[0];
        assert.equal(e.event, 'LogRGPInit');
        assert.equal(e.args.when.toString(10), block.timestamp.toString(10));
        assert.equal(e.args.startTimestamp.toString(10), '11');
        assert.equal(e.args.maxDailyTotalInvestment.toString(10), ether(150).toString(10));
        assert.equal(e.args.activityDays.toString(10), '14');
      });
    });
    context('privateEntranceProvideAccessFor', () => {
      it('throw on access denied', async () => {
        await assertRevert(instance.privateEntranceProvideAccessFor([addr1], { from: addr1 }));
      });
    });
    context('doDisown', () => {
      it('throw on access denied', async () => {
        await assertRevert(instance.doDisown({ from: addr1 }));
      });
      it('change state', async () => {
        await instance.doDisown({ from: owner });
      });
      it('event LogDisown', async () => {
        let block = await latestBlock();
        let logDisown = instance.LogDisown({}, {
          fromBlock: block.number,
          toBlock: block.number,
        });
        const logs = await waitEvents(logDisown);
        assert.equal(logs.length, 1);
        let e = logs[0];
        assert.equal(e.event, 'LogDisown');
        assert.equal(e.args.when.toString(10), block.timestamp.toString(10));
      });
      it('access denied', async () => {
        await assertRevert(instance.doDisown({ from: owner }));
      });
    });
  });

  describe('test internal methods', () => {
    context('getMemInvestor', () => {
      before(async () => {
        instance = await TestLexi.new({ from: owner });
        await instance.initOnce(200, 100, 1, 100, 3, 100, 1, 100, {from: owner});
        await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: ether(1) });
      });
      it('return zero investor if not existing', async () => {
        let inv = await instance.testGetMemInvestor(addr2);
        assert.equal(inv[0].toString(10), '0');
        assert.equal(inv[1].toString(10), '0');
        assert.equal(inv[2].toString(10), '0');
      });
      it('return correct investor info', async () => {
        let inv = await instance.testGetMemInvestor(addr1);
        let ltime = await latestTime();
        assert.equal(inv[0].toString(10), ether(1).toString(10));
        assert.equal(inv[1].toString(10), '0');
        assert.equal(inv[2].toString(10), ltime.toString(10));
      });
    });
    context('canPayOut', () => {
      before(async () => {
        instance = await TestLexi.new({ from: owner });
        await instance.initOnce(200, 100, 1, 100, 3, 100, 1, 100, {from: owner});
        await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: ether(1) });
      });
      it('0 if not investor', async () => {
        let payOut = await instance.testCanPayOut(addr2, { from: owner });
        assert.equal(payOut.toString(10), '0');
      });
      it('return correct payOut info', async () => {
        let payOut = await instance.testCanPayOut(addr1, { from: owner });
        assert.equal(payOut.toString(10), p200.mul(ether(1)).toString(10));
      });
    });
    context('calcDividends', () => {
      beforeEach(async () => {
        instance = await TestLexi.new({ from: owner });
        await instance.initOnce(200, 100, 1, 100, 3, 100, 1, 100, {from: owner});
        investment = ether(1);
        await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: investment });
      });
      context(p1.string() + ' daily, investment 1 ETH', () => {
        beforeEach(async () => {
          await instance.receiveEther({ from: addr1, value: ether(999) });
        });
        it('0 if payment was less then 10 min', async () => {
          await increaseTime(duration.minutes(6));
          let r = await instance.investorDividendsAtNow(addr1);
          assert.equal(r.toString(10), '0');
        });
        it('0 if not investor', async () => {
          let r = await instance.investorDividendsAtNow(addr2);
          assert.equal(r.toString(10), '0');
        });
        it('after 1 day', async () => {
          let d = duration.days(1) + 100;
          await increaseTime(d);
          let r = await instance.investorDividendsAtNow(addr1);
          assert.equal(r.toString(10), p1.calcDividends(investment, d).toString(10));
        });
        it('after 15 min', async () => {
          let d = duration.minutes(15) + 100;
          await increaseTime(d);
          let r = await instance.investorDividendsAtNow(addr1);
          assert.equal(r.toString(10), p1.calcDividends(investment, d).toString(10));
        });
        it('after 5 days and 3 hours', async () => {
          let d = duration.hours(3) + duration.days(5) + 100;
          await increaseTime(d);
          let r = await instance.investorDividendsAtNow(addr1);
          assert.equal(r.toString(10), p1.calcDividends(investment, d).toString(10));
        });
      });
      context(p1.string() + ' daily, investment 1000 ETH', () => {
        beforeEach(async () => {
          await instance.receiveEther({ from: addr1, value: ether(1000) });
        });
        it('after 2 days and 3 hours', async () => {
          let d = duration.hours(3) + duration.days(2) + 100;
          await increaseTime(d);
          let r = await instance.investorDividendsAtNow(addr1);
          assert.equal(r.toString(10), p1.calcDividends(investment, d).toString(10));
        });
      });
      context(p1.string() + ' daily, investment 33334 ETH', () => {
        beforeEach(async () => {
          await instance.receiveEther({ from: addr2, value: ether(33334) });
        });
        it('after 3 hours', async () => {
          let d = duration.hours(3) + 100;
          await increaseTime(d);
          let r = await instance.investorDividendsAtNow(addr1);
          assert.equal(r.toString(10), p1.calcDividends(investment, d).toString(10));
        });
      });
    });
  });
  describe('doInvest(address referrerAddr)', () => {
    beforeEach(async () => {
      instance = await TestLexi.new({ from: owner });
      await instance.initOnce(200, 100, 1, 100, 3, 100, 1, 100, {from: owner});
      investment = ether(1);
    });
    it('throw on max balance limit', async () => {
      let max = await instance.maxBalance();
      max = max.dividedToIntegerBy(2);
      await instance.receiveEther({ from: addr3, value: max.plus(1) });
      await instance.receiveEther({ from: addr4, value: max.plus(1) });
      await assertRevert(instance.doInvest(ZERO_ADDRESS, { from: addr1, value: investment }));
    });
    it('throw if from contract', async () => {
      let mockDoInvest = await MockDoInvest.new({ from: owner });
      await assertRevert(mockDoInvest.doInvest(instance.address, ZERO_ADDRESS, { from: addr1, value: investment }));
    });
    it('success with valid msg.value', async () => {
      await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: investment });
    });
    context('Rapid Growth Protection', () => {
      beforeEach(async () => {
        let t = await latestTime();
        await instance.init(t, ether(150), 14, ether(50), { from: owner });
        await increaseTime(duration.minutes(1));
      });
      it('check if ivestment saved at some day', async () => {
        let r = await instance.rapidGrowthProtectionmMaxInvestmentAtNow();
        assert.equal(r.toString(10), ether(150).toString());

        await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: investment });

        r = await instance.rapidGrowthProtectionmMaxInvestmentAtNow();
        let mustBe = new BigNumber(ether(150).toString(10)).minus(investment);

        assert.equal(r.toString(10), mustBe.toString(10));
      });
      it('check if ivestment saved for correct day', async () => {
        let r = await instance.rapidGrowthProtectionmMaxInvestmentAtNow();
        assert.equal(r.toString(10), ether(150).toString());

        await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: investment });

        r = await instance.rapidGrowthProtectionmMaxInvestmentAtNow();
        let mustBe = new BigNumber(ether(150).toString(10)).minus(investment);
        assert.equal(r.toString(10), mustBe.toString(10));

        await increaseTime(duration.days(1));
        r = await instance.rapidGrowthProtectionmMaxInvestmentAtNow();
        assert.equal(r.toString(10), ether(150).toString());
      });
      it('throw if limit 150 eth passed', async () => {
        await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: ether(150) });

        let r = await instance.rapidGrowthProtectionmMaxInvestmentAtNow();
        assert.equal(r.toString(10), '0');

        await assertRevert(instance.doInvest(ZERO_ADDRESS, { from: addr2, value: investment }));
      });
      context('return excess of ether', () => {
        beforeEach(async () => {
          await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: ether(1) });
        });
        it('check correct investor info', async () => {
          let r = await instance.investorInfo(addr2);
          assert.equal(r[0].toString(), '0');
          await instance.doInvest(ZERO_ADDRESS, { from: addr2, value: ether(150) });
          r = await instance.investorInfo(addr2);
          assert.equal(r[0].toString(10), ether(149).toString(10));
        });
        it('is correct returned ether', async () => {
          let bb = await getBalance(addr2);
          await instance.doInvest(ZERO_ADDRESS, { from: addr2, value: ether(150) });
          let txCost = await latestGasUsed();
          txCost *= gasPrice;
          let ba = await getBalance(addr2);
          let mustBe = new BigNumber(bb.toString(10)).minus(ether(149)).minus(txCost);
          assert.equal(ba.toString(10), mustBe.toString(10));
        });
        it('event LogSendExcessOfEther', async () => {
          await instance.doInvest(ZERO_ADDRESS, { from: addr2, value: ether(150) });
          let block = await latestBlock();
          let logSendExcessOfEther = instance.LogSendExcessOfEther({}, {
            fromBlock: block.number,
            toBlock: block.number,
          });
          const logs = await waitEvents(logSendExcessOfEther);
          assert.equal(logs.length, 1);
          let e = logs[0];
        
          assert.equal(e.event, 'LogSendExcessOfEther');
          assert.equal(e.args.addr.toLowerCase(), addr2.toLowerCase());
          assert.equal(e.args.when.toString(10), block.timestamp.toString(10));
          assert.equal(e.args.value.toString(10), ether(150).toString(10));
          assert.equal(e.args.investment.toString(10), ether(149).toString(10));
          assert.equal(e.args.excess.toString(10), ether(1).toString(10));
        });
        it('correct event LogNewInvesment', async () => {
          await instance.doInvest(ZERO_ADDRESS, { from: addr2, value: ether(150) });
          let block = await latestBlock();
          let LogNewInvesment = instance.LogNewInvesment({}, {
            fromBlock: block.number,
            toBlock: block.number,
          });
          const logs = await waitEvents(LogNewInvesment);
          assert.equal(logs.length, 1);
          let e = logs[0];
          assert.equal(e.event, 'LogNewInvesment');
          assert.equal(e.args.addr.toLowerCase(), addr2.toLowerCase());
          assert.equal(e.args.when.toString(10), block.timestamp.toString(10));
          assert.equal(e.args.investment.toString(10), ether(149).toString(10));
          assert.equal(e.args.value.toString(10), ether(149).toString(10));
        });
        it('correct referrer event LogNewReferral', async () => {
          let mustBe = p1.mul(ether(149));
          await instance.doInvest(addr1, { from: addr2, value: ether(150) });
          let block = await latestBlock();
          let logNewReferral = instance.LogNewReferral({}, {
            fromBlock: block.number,
            toBlock: block.number,
          });
          const logs = await waitEvents(logNewReferral);
          assert.equal(logs.length, 1);
          let e = logs[0];          
          assert.equal(e.event, 'LogNewReferral');
          assert.equal(e.args.addr.toLowerCase(), addr2.toLowerCase());
          assert.equal(e.args.referrerAddr.toLowerCase(), addr1.toLowerCase());
          assert.equal(e.args.when.toString(10), block.timestamp.toString(10));
          assert.equal(e.args.referrerBonus.toString(10), mustBe.toString(10));
        });
      });
      it('not active if 14 days left', async () => {
        await increaseTime(duration.days(15));
        await instance.doInvest(ZERO_ADDRESS, { from: addr2, value: ether(151) });
        let r = await instance.investorInfo(addr2);
        assert.equal(r[0].toString(10), ether(151).toString(10));
      });
      it('event LogRGPInvestment', async () => {
        await instance.doInvest(ZERO_ADDRESS, { from: addr2, value: ether(150) });
        let block = await latestBlock();
        let logRGPInvestment = instance.LogRGPInvestment({}, {
          fromBlock: block.number,
          toBlock: block.number,
        });
        const logs = await waitEvents(logRGPInvestment);
        assert.equal(logs.length, 1);
        let e = logs[0];
        assert.equal(e.event, 'LogRGPInvestment');
        assert.equal(e.args.addr.toLowerCase(), addr2.toLowerCase());
        assert.equal(e.args.when.toString(10), block.timestamp.toString(10));
        assert.equal(e.args.investment.toString(10), ether(150).toString(10));
        assert.equal(e.args.day.toString(10), '1');
      });
    });
    context('Private Entrance', () => {
      beforeEach(async () => {
        let t = await latestTime();
        mockStorage = await MockStorage1.new({ from: owner });
        await instance.init(t + duration.days(1), ether(150), 14, ether(50), { from: owner });
      });
      it('throw if investor dont has access', async () => {
        await mockStorage.setInvestor(addr1, ether(100), 0);
        await assertRevert(instance.doInvest(ZERO_ADDRESS, { from: addr1, value: ether(50) }));
      });
      it('throw if investor dont to invest to Lexi', async () => {
        await instance.privateEntranceProvideAccessFor([addr1], { from: owner });
        await assertRevert(instance.doInvest(ZERO_ADDRESS, { from: addr1, value: ether(50) }));
      });
      it('success invest', async () => {
        await instance.privateEntranceProvideAccessFor([addr1], { from: owner });
        await mockStorage.setInvestor(addr1, ether(100), 0);
        await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: ether(5) });
        let r = await instance.investorInfo(addr1);
        assert.equal(r[0].toString(10), ether(5).toString(10));
      });
      it('throw if limit 50 eth passed', async () => {
        await instance.privateEntranceProvideAccessFor([addr1], { from: owner });
        await mockStorage.setInvestor(addr1, ether(100), 0);
        await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: ether(50) });
        await assertRevert(instance.doInvest(ZERO_ADDRESS, { from: addr1, value: ether(50) }));
        let r = await instance.investorInfo(addr1);
        assert.equal(r[0].toString(10), ether(50).toString(10));
      });
      it('check invest limit 50 eth', async () => {
        await instance.privateEntranceProvideAccessFor([addr1], { from: owner });
        await mockStorage.setInvestor(addr1, ether(100), 0);
        await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: ether(100) });
        let r = await instance.investorInfo(addr1);
        assert.equal(r[0].toString(10), ether(50).toString(10));
      });

      it('check invest limit Lexi', async () => {
        await instance.privateEntranceProvideAccessFor([addr1], { from: owner });
        await mockStorage.setInvestor(addr1, ether(20), 0);
        await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: ether(30) });
        let r = await instance.investorInfo(addr1);
        assert.equal(r[0].toString(10), ether(20).toString(10));
      });
      context('return excess of ether', () => {
        beforeEach(async () => {
          await instance.privateEntranceProvideAccessFor([addr2], { from: owner });
          await mockStorage.setInvestor(addr2, ether(20), 0);

          await instance.privateEntranceProvideAccessFor([addr1], { from: owner });
          await mockStorage.setInvestor(addr1, ether(20), 0);
          await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: ether(20) });
        });
        it('check correct investor info', async () => {
          let r = await instance.investorInfo(addr2);
          assert.equal(r[0].toString(), '0');
          await instance.doInvest(ZERO_ADDRESS, { from: addr2, value: ether(21) });
          r = await instance.investorInfo(addr2);
          assert.equal(r[0].toString(10), ether(20).toString(10));
        });
        it('is correct returned ether', async () => {
          let bb = await getBalance(addr2);
          await instance.doInvest(ZERO_ADDRESS, { from: addr2, value: ether(21) });
          let txCost = await latestGasUsed();
          txCost *= gasPrice;
          let ba = await getBalance(addr2);
          let mustBe = new BigNumber(bb.toString(10)).minus(ether(20)).minus(txCost);
          assert.equal(ba.toString(10), mustBe.toString(10));
        });
        it('event LogSendExcessOfEther', async () => {
          await instance.doInvest(ZERO_ADDRESS, { from: addr2, value: ether(21) });
          let block = await latestBlock();
          let logSendExcessOfEther = instance.LogSendExcessOfEther({}, {
            fromBlock: block.number,
            toBlock: block.number,
          });
          const logs = await waitEvents(logSendExcessOfEther);
          assert.equal(logs.length, 1);
          let e = logs[0];
        
          assert.equal(e.event, 'LogSendExcessOfEther');
          assert.equal(e.args.addr.toLowerCase(), addr2.toLowerCase());
          assert.equal(e.args.when.toString(10), block.timestamp.toString(10));
          assert.equal(e.args.value.toString(10), ether(21).toString(10));
          assert.equal(e.args.investment.toString(10), ether(20).toString(10));
          assert.equal(e.args.excess.toString(10), ether(1).toString(10));
        });
        it('correct event LogNewInvesment', async () => {
          await instance.doInvest(ZERO_ADDRESS, { from: addr2, value: ether(20) });
          let block = await latestBlock();
          let LogNewInvesment = instance.LogNewInvesment({}, {
            fromBlock: block.number,
            toBlock: block.number,
          });
          const logs = await waitEvents(LogNewInvesment);
          assert.equal(logs.length, 1);
          let e = logs[0];
          assert.equal(e.event, 'LogNewInvesment');
          assert.equal(e.args.addr.toLowerCase(), addr2.toLowerCase());
          assert.equal(e.args.when.toString(10), block.timestamp.toString(10));
          assert.equal(e.args.investment.toString(10), ether(20).toString(10));
          assert.equal(e.args.value.toString(10), ether(20).toString(10));
        });
        it('correct referrer event LogNewReferral', async () => {
          let mustBe = p1.mul(ether(20));
          await instance.doInvest(addr1, { from: addr2, value: ether(20) });
          let block = await latestBlock();
          let logNewReferral = instance.LogNewReferral({}, {
            fromBlock: block.number,
            toBlock: block.number,
          });
          const logs = await waitEvents(logNewReferral);
          assert.equal(logs.length, 1);
          let e = logs[0];
          assert.equal(e.event, 'LogNewReferral');
          assert.equal(e.args.addr.toLowerCase(), addr2.toLowerCase());
          assert.equal(e.args.referrerAddr.toLowerCase(), addr1.toLowerCase());
          assert.equal(e.args.when.toString(10), block.timestamp.toString(10));
          assert.equal(e.args.referralBonus.toString(10), mustBe.toString(10));
        });
      });
      it('not active if endTimestamp <= now', async () => {
        await increaseTime(duration.days(5));
        await instance.doInvest(addr1, { from: addr2, value: ether(55) });
        let r = await instance.investorInfo(addr2);
        assert.equal(r[0].toString(10), ether(55).toString(10));
      });
    });
    context('commission', () => {
    });
    it('sender balance', async () => {
      let bb = await getBalance(addr1);
      await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: investment });
      let txCost = await latestGasUsed();
      txCost *= gasPrice;
      let ba = await getBalance(addr1);
      assert.equal(bb.toString(10), ba.plus(investment).plus(txCost).toString(10));
    });
    it('contract balance', async () => {
      let bb = await getBalance(instance.address);
      await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: investment });
      let ba = await getBalance(instance.address);
      assert.equal(bb.toString(10), ba.minus(investment).toString(10));
    });
    it('event LogBalanceChanged', async () => {
      await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: investment });
      let block = await latestBlock();
      let logBalanceChanged = instance.LogBalanceChanged({}, {
        fromBlock: block.number,
        toBlock: block.number,
      });
      let mustBe = new BigNumber(investment.toString(10));
      const logs = await waitEvents(logBalanceChanged);
      assert.equal(logs.length, 1);
      let e = logs[0];

      assert.equal(e.event, 'LogBalanceChanged');
      assert.equal(e.args.when.toString(10), block.timestamp.toString(10));
      assert.equal(e.args.balance.toString(10), mustBe.toString(10));
    });
   
    context('newInvestment', () => {
      it('investmentsNumber', async () => {
        let nb = await instance.investmentsNumber();
        await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: investment });
        let na = await instance.investmentsNumber();
        assert.equal(nb.toString(10), na.minus(1).toString(10));
      });
      it('investorsNumber', async () => {
        let nb = await instance.investorsNumber();
        await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: investment });
        let na = await instance.investorsNumber();
        assert.equal(nb.toString(10), na.minus(1).toString(10));
      });
      it('dont increase investorsNumber on reinvest', async () => {
        await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: investment });
        let nb = await instance.investorsNumber();
        await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: investment });
        let na = await instance.investorsNumber();
        assert.equal(nb.toString(10), na.toString(10));
      });
      it('investor check info', async () => {
        let infob = await instance.investorInfo(addr1);
        assert.equal(infob[0].toString(10), '0');
        assert.equal(infob[1].toString(10), '0');
        assert.equal(infob[2].toString(10), '0');
        assert.equal(infob[3], false);
        await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: investment });
        let block = await latestBlock();
        let infoa = await instance.investorInfo(addr1);
        assert.equal(infoa[0].toString(10), investment.toString(10));
        assert.equal(infoa[1].toString(10), '0');
        assert.equal(infoa[2].toString(10), '' + block.timestamp);
        assert.equal(infoa[3], false);
      });
      it('event LogNewInvesment', async () => {
        await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: investment });
        let block = await latestBlock();
        let LogNewInvesment = instance.LogNewInvesment({}, {
          fromBlock: block.number,
          toBlock: block.number,
        });
        const logs = await waitEvents(LogNewInvesment);
        assert.equal(logs.length, 1);
        let e = logs[0];
        assert.equal(e.event, 'LogNewInvesment');
        assert.equal(e.args.addr.toLowerCase(), addr1.toLowerCase());
        assert.equal(e.args.when.toString(10), block.timestamp.toString(10));
        assert.equal(e.args.investment.toString(10), investment.toString(10));
        assert.equal(e.args.value.toString(10), investment.toString(10));
      });
      it('event LogNewInvestor', async () => {
        await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: investment });
        let block = await latestBlock();
        let logNewInvestor = instance.LogNewInvestor({}, {
          fromBlock: block.number,
          toBlock: block.number,
        });
        const logs = await waitEvents(logNewInvestor);
        assert.equal(logs.length, 1);
        let e = logs[0];
        assert.equal(e.event, 'LogNewInvestor');
        assert.equal(e.args.addr.toLowerCase(), addr1.toLowerCase());
        assert.equal(e.args.when.toString(10), block.timestamp.toString(10));
      });
      context('reinvest', () => {
        beforeEach(async () => {
          await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: investment });
        });
        it('check info', async () => {
          let infob = await instance.investorInfo(addr1);
          let block = await latestBlock();
          assert.equal(infob[0].toString(10), investment.toString(10));
          assert.equal(infob[1].toString(10), '0');
          assert.equal(infob[2].toString(10), '' + block.timestamp);
          assert.equal(infob[3], false);
          await increaseTime(duration.minutes(5));

          await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: investment });

          let infoa = await instance.investorInfo(addr1);
          block = await latestBlock();
          let totalInv = new BigNumber(investment.toString(10)).plus(investment);
          assert.equal(infoa[0].toString(10), totalInv.toString(10));
          assert.equal(infoa[1].toString(10), '0');
          assert.equal(infoa[2].toString(10), '' + block.timestamp);
          assert.equal(infoa[3], false);
        });
        context('automatic reinvest', () => {
          it('check info', async () => {
            let d = duration.minutes(125);
            await increaseTime(d);
            await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: investment });
            let info = await instance.investorInfo(addr1);
            let block = await latestBlock();
            let mustBe = p1.calcDividends(investment, d).plus(investment).plus(investment);
            assert.equal(info[0].toString(10), mustBe.toString(10));
            assert.equal(info[1].toString(10), '0');
            assert.equal(info[2].toString(10), '' + block.timestamp);
            assert.equal(info[3], false);
          });
          it('event LogNewInvesment', async () => {
            let d = duration.minutes(125);
            let mustBe = p1.calcDividends(investment, d).plus(investment);
            await increaseTime(d);
            await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: investment });
            let block = await latestBlock();
            let logNewInvesment = instance.LogNewInvesment({}, {
              fromBlock: block.number,
              toBlock: block.number,
            });
            const logs = await waitEvents(logNewInvesment);
            assert.equal(logs.length, 1);
            let e = logs[0];
            assert.equal(e.event, 'LogNewInvesment');
            assert.equal(e.args.addr.toLowerCase(), addr1.toLowerCase());
            assert.equal(e.args.when.toString(10), block.timestamp.toString(10));
            assert.equal(e.args.investment.toString(10), mustBe.toString(10));
            assert.equal(e.args.value.toString(10), investment.toString(10));
          });
          it('event LogAutomaticReinvest', async () => {
            let d = duration.minutes(125);
            await increaseTime(d);
            let mustBe = await instance.investorDividendsAtNow(addr1);
            await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: investment });
            let block = await latestBlock();
            let logAutomaticReinvest = instance.LogAutomaticReinvest({}, {
              fromBlock: block.number,
              toBlock: block.number,
            });
            const logs = await waitEvents(logAutomaticReinvest);
            assert.equal(logs.length, 1);
            let e = logs[0];
            assert.equal(e.event, 'LogAutomaticReinvest');
            assert.equal(e.args.addr.toLowerCase(), addr1.toLowerCase());
            assert.equal(e.args.when.toString(10), block.timestamp.toString(10));
            assert.equal(e.args.investment.toString(10), mustBe.toString(10));
          });
        });
      });
      context('ref system', () => {
        beforeEach(async () => {
          await instance.doInvest(ZERO_ADDRESS, { from: addr2, value: investment });
        });
        it('dont get bonus if referrer is sender', async () => {
          await instance.doInvest(addr1, { from: addr1, value: investment });
          let infoa = await instance.investorInfo(addr1);
          assert.equal(infoa[0].toString(10), investment.toString(10));
          assert.equal(infoa[3], false);
        });
        it('dont get bonus if referrer is zero', async () => {
          await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: investment });
          let infoa = await instance.investorInfo(addr1);
          assert.equal(infoa[0].toString(10), investment.toString(10));
          assert.equal(infoa[3], false);
        });
        it('dont get bonus if referrer is not investor', async () => {
          await instance.doInvest(addr3, { from: addr1, value: investment });
          let infoa = await instance.investorInfo(addr1);
          assert.equal(infoa[0].toString(10), investment.toString(10));
          assert.equal(infoa[3], false);
        });
        it('dont get bonus if sender already is investor', async () => {
          await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: investment });
          let infob = await instance.investorInfo(addr1);
          await instance.doInvest(addr2, { from: addr1, value: investment });
          let infoa = await instance.investorInfo(addr1);
          assert.equal(infoa[0].toString(10), infob[0].plus(investment).toString(10));
          assert.equal(infoa[3], false);
        });

        it('referrer check info', async () => {
          let mustBe = p1.mul(investment).plus(investment);
          await instance.doInvest(addr2, { from: addr1, value: investment });
          let infoa = await instance.investorInfo(addr2);
          assert.equal(infoa[0].toString(10), mustBe.toString(10));
          assert.equal(infoa[3], false);
        });
        it('investor check info', async () => {
          let mustBe = p1.mul(investment).plus(investment);
          await instance.doInvest(addr2, { from: addr1, value: investment });
          let block = await latestBlock();
          let infoa = await instance.investorInfo(addr1);
          assert.equal(infoa[0].toString(10), mustBe.toString(10));
          assert.equal(infoa[1].toString(10), '0');
          assert.equal(infoa[2].toString(10), '' + block.timestamp);
          assert.equal(infoa[3], true);
        });
        it('event LogNewInvesment', async () => {
          let mustBe = p1.mul(investment).plus(investment);
          await instance.doInvest(addr2, { from: addr1, value: investment });
          let block = await latestBlock();
          let logNewInvesment = instance.LogNewInvesment({}, {
            fromBlock: block.number,
            toBlock: block.number,
          });
          const logs = await waitEvents(logNewInvesment);
          assert.equal(logs.length, 1);
          let e = logs[0];
          assert.equal(e.event, 'LogNewInvesment');
          assert.equal(e.args.addr.toLowerCase(), addr1.toLowerCase());
          assert.equal(e.args.when.toString(10), block.timestamp.toString(10));
          assert.equal(e.args.investment.toString(10), mustBe.toString(10));
          assert.equal(e.args.value.toString(10), investment.toString(10));
        });
        it('event LogNewReferral', async () => {
          let mustBe = p1.mul(investment);
          await instance.doInvest(addr2, { from: addr1, value: investment });
          let block = await latestBlock();
          let logNewReferral = instance.LogNewReferral({}, {
            fromBlock: block.number,
            toBlock: block.number,
          });
          const logs = await waitEvents(logNewReferral);
          assert.equal(logs.length, 1);
          let e = logs[0];
          assert.equal(e.event, 'LogNewReferral');
          assert.equal(e.args.addr.toLowerCase(), addr1.toLowerCase());
          assert.equal(e.args.referrerAddr.toLowerCase(), addr2.toLowerCase());
          assert.equal(e.args.when.toString(10), block.timestamp.toString(10));
          assert.equal(e.args.referralBonus.toString(10), mustBe.toString(10));
        });
      });
    });
  });
  describe('getMyDividends()', () => {
    beforeEach(async () => {
      await initContract(owner);
      await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: investment });
    });
    it('throw if sender not investor', async () => {
      await increaseTime(duration.days(1));
      await assertRevert(instance.getMyDividends({ from: addr2 }));
    });
    it('throw if from contract', async () => {
      await increaseTime(duration.days(1));
      let mockGetMyDividends = await MockGetMyDividends.new({ from: owner });
      await assertRevert(mockGetMyDividends.getMyDividends(instance.address, { from: addr1 }));
    });
    it('throw if latest payment was earlier than 10 min', async () => {
      await increaseTime(duration.minutes(9));
      await assertRevert(instance.getMyDividends({ from: addr1 }));
    });
    it('check info', async () => {
      let infob = await instance.investorInfo(addr1);
      await increaseTime(duration.days(1));
      await instance.getMyDividends({ from: addr1 });
      let block = await latestBlock();
      let infoa = await instance.investorInfo(addr1);
      assert.equal(infoa[0].toString(10), infob[0].toString(10));
      assert.equal(infob[1].toString(10), '0');
      assert.equal(infoa[2].toString(10), '' + block.timestamp);
      assert.equal(infoa[3], false);
    });
    it('contract balance', async () => {
      let bb = await getBalance(instance.address);
      await increaseTime(duration.days(1));
      let div = await instance.investorDividendsAtNow(addr1);
      await instance.getMyDividends({ from: addr1 });
      let ba = await getBalance(instance.address);
      assert.equal(bb.toString(10), ba.plus(div).toString(10));
    });
    it('investor balance', async () => {
      let bb = await getBalance(addr1);
      await increaseTime(duration.days(1));
      let div = await instance.investorDividendsAtNow(addr1);
      await instance.getMyDividends({ from: addr1 });
      let txCost = await latestGasUsed();
      txCost *= gasPrice;
      let ba = await getBalance(addr1);
      assert.equal(bb.toString(10), ba.minus(div).plus(txCost).toString(10));
    });
    it('event LogPayDividends', async () => {
      await increaseTime(duration.days(1));
      let div = await instance.investorDividendsAtNow(addr1);
      await instance.getMyDividends({ from: addr1 });
      let block = await latestBlock();
      let logPayDividends = instance.LogPayDividends({}, {
        fromBlock: block.number,
        toBlock: block.number,
      });
      const logs = await waitEvents(logPayDividends);
      assert.equal(logs.length, 1);
      let e = logs[0];
      assert.equal(e.event, 'LogPayDividends');
      assert.equal(e.args.addr.toLowerCase(), addr1.toLowerCase());
      assert.equal(e.args.when.toString(10), block.timestamp.toString(10));
      assert.equal(e.args.dividends.toString(10), div.toString(10));
    });
    it('event LogBalanceChanged', async () => {
      await increaseTime(duration.days(1));
      let div = await instance.investorDividendsAtNow(addr1);
      let b = await getBalance(instance.address);
      await instance.getMyDividends({ from: addr1 });
      let block = await latestBlock();
      let logBalanceChanged = instance.LogBalanceChanged({}, {
        fromBlock: block.number,
        toBlock: block.number,
      });
      let mustBe = new BigNumber(b.toString(10)).minus(div);
      const logs = await waitEvents(logBalanceChanged);
      assert.equal(logs.length, 1);
      let e = logs[0];

      assert.equal(e.event, 'LogBalanceChanged');
      assert.equal(e.args.when.toString(10), block.timestamp.toString(10));
      assert.equal(e.args.balance.toString(10), mustBe.toString(10));
    });
    
    context('goto next wave', () => {
      beforeEach(async () => {
        await prepareToNextWave(addr1);
      });
      
      it('investmentsNumber = 0', async () => {
        await instance.getMyDividends({ from: addr1 });
        let a = await instance.investmentsNumber({ from: addr1 });
        assert.equal(a.toString(10), '0');
      });
      it('investorsNumber = 0', async () => {
        await instance.getMyDividends({ from: addr1 });
        let a = await instance.investorsNumber({ from: addr1 });
        assert.equal(a.toString(10), '0');
      });
      it('save referrals', async () => {
        investment = ether(1);
        await instance.doInvest(addr1, { from: addr2, value: investment });
        let r = await instance.investorInfo(addr2);
        assert.equal(r[3], true);
        await prepareToNextWave(addr2);
        await instance.getMyDividends({ from: addr1 });

        r = await instance.investorsNumber({ from: addr1 });
        assert.equal(r.toString(10), '0');
        r = await instance.investorInfo(addr2);
        assert.equal(r[3], true);

        await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: investment });
        await instance.doInvest(addr1, { from: addr2, value: investment });

        r = await instance.investorInfo(addr2);
        assert.equal(r[0].toString(10), investment.toString(10));
      });
      it('waveStartup', async () => {
        await instance.getMyDividends({ from: addr1 });
        let a = await instance.waveStartup({ from: addr1 });
        let ltime = await latestTime();
        assert.equal(a.toString(), ltime.toString(10));
      });
      it('emit LogNextWave', async () => {
        await instance.getMyDividends({ from: addr1 });
        let block = await latestBlock();
        let logNextWave = instance.LogNextWave({}, {
          fromBlock: block.number,
          toBlock: block.number,
        });
        const logs = await waitEvents(logNextWave);
        assert.equal(logs.length, 1);
        let e = logs[0];
        assert.equal(e.event, 'LogNextWave');
        assert.equal(e.args.when.toString(10), block.timestamp.toString(10));
      });
      it('TODO RGP', async () => {
      });
      it('contract balance', async () => {
        await instance.getMyDividends({ from: addr1 });
        let b = await getBalance(instance.address);
        assert.equal(b.toString(10), '0');
      });
      it('event LogPayDividends', async () => {
        let b = await getBalance(instance.address);
        await instance.getMyDividends({ from: addr1 });
        let block = await latestBlock();
        let logPayDividends = instance.LogPayDividends({}, {
          fromBlock: block.number,
          toBlock: block.number,
        });
        const logs = await waitEvents(logPayDividends);
        assert.equal(logs.length, 1);
        let e = logs[0];
        assert.equal(e.event, 'LogPayDividends');
        assert.equal(e.args.addr.toLowerCase(), addr1.toLowerCase());
        assert.equal(e.args.when.toString(10), block.timestamp.toString(10));
        assert.equal(e.args.dividends.toString(10), b.toString(10));
      });
    });
  });
    
  describe('fallback', () => {
    beforeEach(async () => {
      await initContract(owner);
      await instance.init(10, ether(150), 14, ether(50), { from: owner });
    });
    context('do invest if msg.value > 0', () => {
      it('success do inveset', async () => {
        let addGas = process.env.SOLIDITY_COVERAGE ? 100000 : 0;
        let infoB = await instance.investorInfo(addr1);
        assert.equal(infoB[0].toString(10), '0');
        await sendTransaction({
          from: addr1,
          to: instance.address,
          value: investment,
          gas: 200000 + addGas,
          gasPrice: gasPrice,
        });
        let infoA = await instance.investorInfo(addr1);
        assert.equal(infoA[0].toString(10), investment.toString(10));
      });
      it('check msg.data to address', async () => {
        let addGas = process.env.SOLIDITY_COVERAGE ? 100000 : 0;
        await instance.doInvest(ZERO_ADDRESS, { from: addr2, value: investment });
        
        let infoB = await instance.investorInfo(addr1);
        assert.equal(infoB[3], false);

        let mustBe = p1.mul(investment).plus(investment);

        await sendTransaction({
          from: addr1,
          to: instance.address,
          value: investment,
          gas: 200000 + addGas,
          data: addr2.toLowerCase(),
        });

        let infoA = await instance.investorInfo(addr1);
        assert.equal(infoA[0].toString(10), mustBe.toString(10));
        assert.equal(infoA[3], true);
      });
    });
    it('getMyDividends if msg.value = 0', async () => {
      let addGas = process.env.SOLIDITY_COVERAGE ? 100000 : 0;
      await instance.doInvest(ZERO_ADDRESS, { from: addr1, value: ether(1) });
      await increaseTime(duration.hours(24) + duration.seconds(100));

      let div = await instance.investorDividendsAtNow(addr1);
      let bb = await getBalance(addr1);
      await sendTransaction({
        from: addr1,
        to: instance.address,
        value: 0,
        gas: 200000 + addGas,
        gasPrice: gasPrice,
      });
        
      let cost = await latestGasUsed() * gasPrice;
      let ba = await getBalance(addr1);
      assert.equal(bb.toString(10), ba.minus(div).plus(cost).toString(10));
    });
  });
});
