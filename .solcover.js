let accs = "";
let balance = "0x1027e72f1f12813088000000"; // 500 000 000 ether
for (let i = 0; i < 10; i++) {
    accs += ` --account="${"0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b750120"+i}, ${balance}"`
}

module.exports = {
    norpc: false,
    testrpcOptions: `--port 8545 ${accs}`,
    port: 8545,
    testCommand: 'SOLIDITY_COVERAGE=true ../node_modules/.bin/truffle test --network coverage',
    skipFiles: [
        'Configurator.sol',
        // tests
        'tests/TestAccessibility.sol',
        'tests/TestAddress.sol',
        'tests/TestMath.sol',
        'tests/TestPercent.sol',
        'tests/TestRapidGrowthProtection.sol',
        'tests/TestPrivateEntrance.sol',
        'tests/TestZero.sol',
        'tests/TestLexi.sol',
        // mocks 
        'mocks/MockGetMyDividends.sol',
        'mocks/MockStorage1.sol',
        'mocks/MockStorage2.sol',
        'mocks/MockDoInvest.sol',
        // math
        'math/SafeMath.sol',
    ],
}