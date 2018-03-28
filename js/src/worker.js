'use strict'

const EventEmitter = require('events');
const IPFS = require('ipfs');
const Room = require('ipfs-pubsub-room');
var unique = require('array-unique');

const STATES = Object.freeze({
  SYNC: Symbol("SYNC"),
  GENERATE_WORK_SEQUENCE: Symbol("GENERATE_WORK_SEQUENCE"),
  WORK: Symbol("WORK")
});

class Worker extends EventEmitter{

  static get STATES() {
    return STATES;
  }

  constructor(roomName='OPO'){
    super();
    this._roomName = roomName;
    this._id = '';
    this._index = 0;
    this._peers = [];
    this._peerToIndex = {};
    this._state = Worker.STATES.GENERATE_WORK_SEQUENCE;
    this._states =[];
    this._workSequence = [];
    this._workSequenceLength = 10;
    this._allCompletedWork = { 0: { currentWork: 0, results:{} } };
    this._completedWork = {};

    this._ipfs = new IPFS({
      //allows us to test using same browser instance, but different windows
      repo: 'ipfs/arithmetica/' + Math.random(),
      EXPERIMENTAL: {
        pubsub: true
      },
      config: {
        Addresses: {
          Swarm: [
            '/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star'
          ]
        }
      }
    })
   
    //define pubsub room
    this._room = Room(this._ipfs, roomName);
    //register events 
    this._room.on('peer joined', (peer) => this.onPeerJoined(peer));
    this._room.on('peer left', (peer) => this.onPeerLeft(peer));
    //this._room.on('message', (message) => this.onMessage(message));
    this.emit('InitCompleted', {'peer':this._id});
    
  }

  onPeerJoined(peer){
    console.log('peer ' + peer + ' joined')
    this._states.push(Worker.STATES.GENERATE_WORK_SEQUENCE);
    this.emit('PeerJoined', {'peer':peer});
  }

  onPeerLeft(peer){
    console.log('peer ' + peer + ' left')
    this._states.push(Worker.STATES.GENERATE_WORK_SEQUENCE);
    this.emit('PeerLeft', {'peer':peer});
  }

  onMessage(db){

    console.log('replicated event received');
    console.log(db);
    
  }

  start(){
    this._ipfs.once('ready', () => this._ipfs.id((err, info) => {
      if (err) { throw err }
      this._id = info.id;
      console.log('IPFS node ready');
      this.emit('InitCompleted', {'peer':this._id});
      this._peers[this._id];
      this.mainLoop();
    }))
  }

  mainLoop(){

   setInterval(() => {
      if(this.checkForNewPeers()){
        this.getPeers();
      }
      else{
        if(this._state == Worker.STATES.GENERATE_WORK_SEQUENCE){
          this.generateWorkSequence();
          if(this._workSequence.length > 0){
            this._states.push(Worker.STATES.WORK);
          }
        } 
        else if(this._state == Worker.STATES.WORK) {
          this.doWork();
          if(this._workSequence.length == 0){
            this._states.push(Worker.STATES.GENERATE_WORK_SEQUENCE);
          }
        }
      }
      this.updateState();

    }, 100)

  }

  checkForNewPeers(){
    var prevPeers = this._peers;
    var peers = this._room.getPeers();
    peers.push(this._id);
    return peers.filter((peer) => !prevPeers.includes(peer)).length > 0;
  }
  getPeers(){
    this._peers = this._room.getPeers();
    this._peers.push(this._id);
    this._peers.sort();
    this._peers.forEach((peer,index)=>{
      this._peerToIndex[peer] = index;
      if(peer === this._id){ 
        this._index = index;
      }
      if(!this._allCompletedWork.hasOwnProperty(index)){
        this._allCompletedWork[index] = {
            currentWork: this._allCompletedWork[index-1].currentWork + 1,
            results:{}
        };
      }
    });
    this._completedWork = this._allCompletedWork[this._index].results;
    this._states.push(Worker.STATES.GENERATE_WORK_SEQUENCE);
  }

  generateWorkSequence(){
    //Work Sequence for a Peer:
    //Let N = peer index
    //Let i = sequence index
    //Let offset = W(N,0) + N
    //W(N,i) = Num(Peers)*i + offset

    var numPeers = this._peers.length;
    var length = this._workSequenceLength;
    var currentWork = this._allCompletedWork[this._index].currentWork;
    var offset = currentWork + numPeers + this._index;
    this._workSequence = Array.from(Array(length).keys(), i => numPeers*i + offset);
    console.log("Index: " + this._index + " Current Work: " + currentWork.toString());
    console.log(this._workSequence);
    //this.emit('WorkSequenceGenerated', {});
  }

  doWork(){
    var result = this.calc(this._workSequence.shift());
    var message = this.constructMessage('SUBMIT_WORK',result[0],result[1]);
    if(this._peers.length == 1){
      message = {from:this._id,data:message};
      this.onMessage(message);
    }
    else{
      this._room.broadcast(message);
    }
  }

  updateState(){
    if(this._states.length > 0){
      this._state = this._states.shift();
    }
  }

    //The problem definition MUST override these.
  evaluation(inputs) {}
  assertions(original, number, iterations) {}

  calc(input){
    var flag = true;
    var iterations = 0;
    var original = input
    //console.log("Work: " + original.toString())
    for(iterations = 0; input > 1 && flag == true; iterations++){
      [input,iterations,flag] = this.evaluation([input,iterations,flag]);
      if(this.assertions(original, input, iterations)) {
        //this.store(original, input, iterations, true);
      } else {
        //this.store(original, input, iterations, false);
      }
    }
     //console.log("**Work: " + original.toString() + " Current: " + input.toString() + " Iteration: " + iterations.toString())
    /*if (!flag){
      console.log("**Solution already found for Work: " + original.toString() + " Iterations: " + this._workCompleted[input])
    }
    else{
      console.log("**Work: " + original.toString() + " Current: " + input.toString() + " Iteration: " + iterations.toString())
    }*/
    return [original,iterations];
  }

  onMessage(message){
    var messageData = this.parseMessage(message.data.toString());
    console.log(messageData);
    if(messageData.command === 'SUBMIT_WORK'){
      var currentWork = parseInt(messageData.work);
      var iter = parseInt(messageData.result);
      var peerIndex = this._peerToIndex[message.from]

      if(this._allCompletedWork.hasOwnProperty(peerIndex)){
        //Save the currentWork if it is the latest
        if(currentWork > this._allCompletedWork[peerIndex].currentWork){
          this._allCompletedWork[peerIndex].currentWork = currentWork;
        }
        //always add the work to the results object
        this._allCompletedWork[peerIndex].results[currentWork]=iter;
      }
      else{
        this._allCompletedWork[peerIndex] = {
            currentWork: currentWork,
            results:{ currentWork:iter }
        };
      }

      this.emit('CompletedWork', {'peer':message.from,'peers':unique(this._peers),'work':currentWork,'iterations':iter});
    }
  }

  parseMessage(message){
    return JSON.parse(message);
  }

  constructMessage(command, work, result){
    var message = {'command':command,'work':work,'result':result}
    return JSON.stringify(message);
  }
}

module.exports = Worker;
