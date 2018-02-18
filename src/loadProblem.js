const Worker = require('./worker');

module.exports = function handleLoadProblemClicked(arithmeticaContract,problemName,callback) {
    var instance;
    var code = "";

    arithmeticaContract.deployed().then(
        (_instance) => {instance = _instance; return _instance.getEvaluation(problemName);}
    ).then(
        (_code) => {code = code + _code; return instance.getAssertions(problemName);}
    ).then(
        (_code) => {code = code + " " + _code; return buildCode(code,problemName);}
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

function buildCode(_code, problemName) {
    return "class Problem extends Worker { constructor(){ super(\'" + problemName + "\'); }" + _code + "} module.exports = Problem;"
}
