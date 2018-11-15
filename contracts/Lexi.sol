pragma solidity 0.4.24;

import './math/Percent.sol';
import './math/Math.sol';
import './math/SafeMath.sol';
import './utils/Address.sol';
import './RapidGrowthProtection.sol';
import './PrivateEntrance.sol';
import './InvestorsStorage.sol';
import './FeeWallets.sol';

contract Lexi is FeeWallets {

  bool private initialized;

  using RapidGrowthProtection for RapidGrowthProtection.rapidGrowthProtection;
  using PrivateEntrance for PrivateEntrance.privateEntrance;
  using Math for uint;

  // easy read for investors
  using Address for *;
  
  RapidGrowthProtection.rapidGrowthProtection private m_rgp;
  PrivateEntrance.privateEntrance private m_privEnter;
  mapping(address => bool) private m_referrals;
  InvestorsStorage private m_investors;

  // automatically generates getters
  uint public constant maxBalance = 333e5 ether; // 33 300 000 eth
  uint public investmentsNumber;
  uint public waveStartup;

  // percents 
  Percent.percent private m_referer_percent;
  Percent.percent private m_referal_percent;
  Percent.percent private m_common_percent;
  Percent.percent private m_payments_treshold;

  // more events for easy read from blockchain
  event LogPEInit(uint when, address specStorage, uint investorMaxInvestment, uint endTimestamp);
  event LogSendExcessOfEther(address indexed addr, uint when, uint value, uint investment, uint excess);
  event LogNewReferral(address indexed addr, address indexed referrerAddr, uint when, uint referalBonus, uint refererBonus);
  event LogRGPInit(uint when, uint startTimestamp, uint maxDailyTotalInvestment, uint activityDays);
  event LogRGPInvestment(address indexed addr, uint when, uint investment, uint indexed day);
  event LogNewInvesment(address indexed addr, uint when, uint investment, uint value);
  event LogAutomaticReinvest(address indexed addr, uint when, uint investment);
  event LogPayDividends(address indexed addr, uint when, uint dividends);
  event LogNewInvestor(address indexed addr, uint when);
  event LogBalanceChanged(uint when, uint balance);
  event LogInvestorDeleted(address addr, uint when);
  event LogNextWave(uint when);
  event LogDisown(uint when);


  modifier balanceChanged {
    _;
    emit LogBalanceChanged(now, address(this).balance);
  }

  modifier notFromContract() {
    require(msg.sender.isNotContract(), "only externally accounts");
    _;
  }

  function() public payable {
    // investor get him dividends
    if (msg.value.isZero()) {
      getMyDividends();
      return;
    }

    // sender do invest
    doInvest(msg.data.toAddress());
  }

  function doDisown() public onlyOwner {
    disown();
    emit LogDisown(now);
  }

  function init(uint timestamp, uint dailyLimit, uint8 activityDays, uint investorMaxLimit) public onlyOwner {
    // init Rapid Growth Protection
    m_rgp.startTimestamp = timestamp + 1;
    m_rgp.maxDailyTotalInvestment = dailyLimit;
    m_rgp.activityDays = activityDays;
    emit LogRGPInit(
      now, 
      m_rgp.startTimestamp,
      m_rgp.maxDailyTotalInvestment,
      m_rgp.activityDays
    );


    // init Private Entrance
    m_privEnter.specStorage = SpecStorage(address(m_investors));
    m_privEnter.investorMaxInvestment = investorMaxLimit;
    m_privEnter.endTimestamp = timestamp;
    emit LogPEInit(
      now, 
      address(m_privEnter.specStorage), 
      m_privEnter.investorMaxInvestment, 
      m_privEnter.endTimestamp
    );
  }

  function privateEntranceProvideAccessFor(address[] addrs) public onlyOwner {
    m_privEnter.provideAccessFor(addrs);
  }

  function rapidGrowthProtectionmMaxInvestmentAtNow() public view returns(uint investment) {
    investment = m_rgp.maxInvestmentAtNow();
  }

  function investorsNumber() public view returns(uint) {
    return m_investors.size();
  }

  function balanceETH() public view returns(uint) {
    return address(this).balance;
  }

  function investorInfo(address investorAddr) public view returns(uint investment, uint paymentTime, uint payOut, bool isReferral) {
    (investment, paymentTime, payOut) = m_investors.investorInfo(investorAddr);
    isReferral = m_referrals[investorAddr];
  }

  function investorDividendsAtNow(address investorAddr) public view returns(uint dividends) {
    dividends = calcDividends(investorAddr);
  }

  function getMyDividends() public notFromContract balanceChanged {
    // calculate dividends
    uint dividends = calcDividends(msg.sender);
    require (dividends.notZero(), "cannot to pay zero dividends");

    // update investor payment timestamp
    assert(m_investors.setPaymentTime(msg.sender, now));

    // check enough eth - goto next wave if needed
    if (address(this).balance <= dividends) {
      nextWave();
      dividends = address(this).balance;
    } 

    //
    uint canToPayOut = canPayOut(msg.sender);
    if(dividends > canToPayOut) {
      dividends = canToPayOut;
    } 
    
    // transfer dividends to investor
    msg.sender.transfer(dividends);
    emit LogPayDividends(msg.sender, now, dividends);

    if(dividends == canToPayOut) {
      assert(m_investors.deleteInvestor(msg.sender));
      emit LogInvestorDeleted(msg.sender, now);
    }
  }

  function doInvest(address referrerAddr) public payable notFromContract balanceChanged {
    uint investment = msg.value;
    uint receivedEther = msg.value;
    require(address(this).balance <= maxBalance, "the contract eth balance limit");

    if (m_rgp.isActive()) { 
      // use Rapid Growth Protection if needed
      uint rpgMaxInvest = m_rgp.maxInvestmentAtNow();
      rpgMaxInvest.requireNotZero();
      investment = Math.min(investment, rpgMaxInvest);
      assert(m_rgp.saveInvestment(investment));
      emit LogRGPInvestment(msg.sender, now, investment, m_rgp.currDay());
      
    } else if (m_privEnter.isActive()) {
      // use Private Entrance if needed
      uint peMaxInvest = m_privEnter.maxInvestmentFor(msg.sender);
      peMaxInvest.requireNotZero();
      investment = Math.min(investment, peMaxInvest);
    }

    // send excess of ether if needed
    if (receivedEther > investment) {
      uint excess = receivedEther - investment;
      msg.sender.transfer(excess);
      receivedEther = investment;
      emit LogSendExcessOfEther(msg.sender, now, msg.value, investment, excess);
    }

    // commission
    processFee(receivedEther);

    bool senderIsInvestor = m_investors.isInvestor(msg.sender);

    // ref system works only once and only on first invest
    if (referrerAddr.notZero() && !senderIsInvestor && !m_referrals[msg.sender] &&
      referrerAddr != msg.sender && m_investors.isInvestor(referrerAddr)) {
      
      m_referrals[msg.sender] = true;
      // add referral bonus to investor`s and referral`s investments
      uint refererBonus = m_referer_percent.mmul(investment);
      assert(m_investors.addInvestment(referrerAddr, refererBonus)); // add referrer bonus

      uint referalBonus = m_referer_percent.mmul(investment);
      investment += referalBonus;                                    // add referral bonus

      emit LogNewReferral(msg.sender, referrerAddr, now, referalBonus, refererBonus);
    }

    // automatic reinvest - prevent burning dividends
    uint dividends = calcDividends(msg.sender);
    if (senderIsInvestor && dividends.notZero()) {
      investment += dividends;
      emit LogAutomaticReinvest(msg.sender, now, dividends);
    }

    if (senderIsInvestor) {
      // update existing investor
      assert(m_investors.addInvestment(msg.sender, investment));
      assert(m_investors.setPaymentTime(msg.sender, now));
    } else {
      // create new investor
      assert(m_investors.newInvestor(msg.sender, investment, now));
      emit LogNewInvestor(msg.sender, now);
    }

    investmentsNumber++;
    emit LogNewInvesment(msg.sender, now, investment, receivedEther);
  }

  function getMemInvestor(address investorAddr) internal view returns(InvestorsStorage.Investor memory) {
    (uint investment, uint payOut, uint paymentTime) = m_investors.investorInfo(investorAddr);
    return InvestorsStorage.Investor(investment, payOut, paymentTime);
  }

  function canPayOut(address investorAddr) internal view returns(uint canPayOutDividents) {
    InvestorsStorage.Investor memory investor = getMemInvestor(investorAddr);

   
    Percent.percent memory p = m_payments_treshold;
    uint maxCanPayOut = p.mmul(investor.investment);
    return maxCanPayOut - investor.payOut;
  }

  function calcDividends(address investorAddr) internal view returns(uint dividends) {
    InvestorsStorage.Investor memory investor = getMemInvestor(investorAddr);

    // safe gas if dividends will be 0
    if (investor.investment.isZero() || now.sub(investor.paymentTime) < 10 minutes) {
      return 0;
    }
    
    // for prevent burning daily dividends if 24h did not pass - calculate it per 10 min interval
    // if daily percent is X, then 10min percent = X / (24h / 10 min) = X / 144

    // and we must to get numbers of 10 min interval after investor got payment:
    // (now - investor.paymentTime) / 10min 

    // finaly calculate dividends = ((now - investor.paymentTime) / 10min) * (X * investor.investment)  / 144) 

    Percent.percent memory p = m_common_percent;
    dividends = (now.sub(investor.paymentTime) / 10 minutes) * p.mmul(investor.investment) / 144;
  }

  function initOnce(
      uint paymentsThresholdPercent,
      uint paymentsThresholdPercentRate,
      uint commonPercent,
      uint commonPercentRate,
      uint referalPercent, 
      uint referalPercentRate, 
      uint refererPercent, 
      uint refererPercentRate) public onlyOwner {
    require(initialized == false, "Already initialized!");
    m_referer_percent = Percent.percent(refererPercent, refererPercentRate);
    m_referal_percent = Percent.percent(referalPercent, referalPercentRate);
    m_common_percent = Percent.percent(commonPercent, commonPercentRate);
    m_payments_treshold = Percent.percent(paymentsThresholdPercent, paymentsThresholdPercentRate);
    nextWave();
    initialized = true;
  }

  function nextWave() private {
    m_investors = new InvestorsStorage();
    investmentsNumber = 0;
    waveStartup = now;
    m_rgp.startAt(now);
    emit LogRGPInit(now , m_rgp.startTimestamp, m_rgp.maxDailyTotalInvestment, m_rgp.activityDays);
    emit LogNextWave(now);
  }
}
