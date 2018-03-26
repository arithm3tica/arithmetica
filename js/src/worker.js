'use strict'

const EventEmitter = require('events');
const IPFS = require('ipfs');
const Room = require('ipfs-pubsub-room');
const OrbitDB = require('orbit-db');
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
    this._index = 1; //1 based
    this._workIndex = 0; 
    this._peers = [];
    this._state = Worker.STATES.GENERATE_WORK_SEQUENCE;
    this._state_latch = Worker.STATES.GENERATE_WORK_SEQUENCE;
    this._workSequence = [];
    this._currentWork = 0;
    this._workSequenceLength = 10;

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

    this._ipfs.on('ready', async () => {

      this._ipfs.id((err, info) => {
        this._id = info.id;
      })

      this._orbitdb = new OrbitDB(this._ipfs,'./test');
      const dbConfig = { replicate: true, create: true, sync: true, overwrite: false, write: ['*'], localOnly: false };
      this._workCompleted = await this._orbitdb.keyvalue(this._roomName,dbConfig);
      //this._workCompleted = await orbitdb.open('/orbitdb/QmbLUdHKozxBDeKsDKyGEKeLUyi7YhVxiVo7VJMrCPqrvq/Collatz Conjecture',{ sync: true});
      
      this._workCompleted.events.on('replicate', (address) => console.log('db - replicate', address ) );
      this._workCompleted.events.on('replicate.progress', (address) => console.log('db - replicate progress', address) );
      this._workCompleted.events.on('write', (res) => {console.log(res)});
      await this._workCompleted.load();
      console.log('OrbitDB ready with address ' + this._workCompleted.address);

      this.emit('InitCompleted', {'peer':this._id});

      //define pubsub room
      this._room = Room(this._ipfs, roomName);

      //register events 
      this._room.on('peer joined', (peer) => this.onPeerJoined(peer));
      this._room.on('peer left', (peer) => this.onPeerLeft(peer));

      
      this.mainLoop();
    })

  }

  onPeerJoined(peer){
    console.log('peer ' + peer + ' joined')
    this._state_latch = Worker.STATES.GENERATE_WORK_SEQUENCE;
    this.emit('PeerJoined', {'peer':peer});
  }

  onPeerLeft(peer){
    console.log('peer ' + peer + ' left')
    this._state_latch = Worker.STATES.GENERATE_WORK_SEQUENCE;
    this.emit('PeerLeft', {'peer':peer});
  }

  onMessage(db){

    console.log('replicated event received');
    console.log(db);
    
  }

  start(){
    
  }

  mainLoop(){

   setInterval(() => {
      this._peers = this._room.getPeers();
      if(this._state == Worker.STATES.GENERATE_WORK_SEQUENCE){
        this.assignPeerIndexes();
        this.generateWorkSequence();
      } 
      else if(this._state == Worker.STATES.WORK) {
        this.doWork();
      }
      this.updateState();
    }, 100)

  }

  assignPeerIndexes(){
    var peers = this._peers;
    var numPeers = peers.length;

    peers.push(this._id);
    peers.sort();

    this._index = peers.indexOf(this._id) + 1;
  }

  generateWorkSequence(){
    //Work Sequence for a Peer:
    //Let N = peer index
    //Let i = sequence index
    //Let offset = W(N,0) + N
    //W(N,i) = Num(Peers)*i + offset

    var numPeers = this._peers.length;
    var length = this._workSequenceLength;
    var offset = this._currentWork + this._index;
    this._workSequence = Array.from(Array(length).keys(), i => numPeers*i + offset);

    //this.emit('WorkSequenceGenerated', {});
  }

  doWork(){
    var result = this.calc(this._workSequence.shift());
    async () => {
      await this._workCompleted.put(result[0],{iterations:result[1],workIndex:this._workIndex,peer:this._id});
    }
    var peers = [];
    if(this._peers.length > 0){
      peers = this._peers;
    }
    peers.push(this._id);
    this._currentWork = result[0];
    this.emit('CompletedWork', {'peer':this._id,'peers':unique(peers),'work':result[0],'iterations':result[1]});
    this._workIndex += 1;
  }

  updateState(){
    if(this._workSequence.length > 0){
      this._state = Worker.STATES.WORK;
    }
    else {
      this._state = Worker.STATES.GENERATE_WORK_SEQUENCE;
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

  parseMessage(message){
    return JSON.parse(message);
  }

  constructMessage(command, work, result){
    var message = {'command':command,'work':work,'result':result}
    return JSON.stringify(message);
  }
}

module.exports = Worker;
