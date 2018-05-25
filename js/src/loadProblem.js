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
            
            window.addEventListener("beforeunload", () => worker.stop());

            worker.on('InitCompleted',(data) => {
                callback('InitCompleted',data);
            });           
            worker.on('PeerJoined',(data) => {
                callback('PeerJoined',data);
            });
            worker.on('PeerLeft',(data) => {
                callback('PeerLeft',data);
            });
            worker.on('CompletedWork',(data) => {
                callback('CompletedWork',data);
            });
            worker.on('WorkLoaded',(data) => {
                callback('WorkLoaded',data);
            });
            worker.on('WorkSaved',(data) => {
                callback('WorkSaved',data);
            });
            worker.start();


        }
    );
}

function buildCode(_code, problemName) {
    problemName += 1;
    return "class Problem extends Worker { constructor(){ super(\'" + problemName + "\'); }" + _code + "} module.exports = Problem;"
}
