const Worker = require('./worker');

module.exports = function handleLoadProblemClicked(arithmeticaContract,callback) {
    var instance;
    var code = "";

    arithmeticaContract.deployed().then(
        (_instance) => {instance = _instance; return _instance.getEvaluation("Collatz Conjecture");}
    ).then(
        (_code) => {code = code + _code; return instance.getAssertions("Collatz Conjecture");}
    ).then(
        (_code) => {code = code + " " + _code; return buildCode(code);}
    ).then(
        (arbitraryCode) => {return eval(arbitraryCode)}
    ).then(
        (Problem) => {return new Problem();}
    ).then(
        (worker) => {
            worker.on('PeerJoined',(data) => {
                callback(data);
            });
            worker.on('PeerLeft',(data) => {
                callback(data);
            });
            worker.on('CompletedWork',(data) => {
                callback(data);
            });
            worker.start();


        }
    );
}

function buildCode(_code) {
    return "class Problem extends Worker { constructor(){ super(\'OP2\'); }" + _code + "} module.exports = Problem;"
}

libInstance.on('data', (data) => {
    // Outputs : Received data: "Hello World, data test"
    console.log(`Received data: "${data}"`);
});

