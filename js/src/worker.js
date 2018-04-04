'use strict'

const EventEmitter = require('events');
const IPFS = require('ipfs');
const Room = require('ipfs-pubsub-room');
var unique = require('array-unique');

const STATES = Object.freeze({
  GENERATE_WORK_SEQUENCE: Symbol("GENERATE_WORK_SEQUENCE"),
  LOAD_WORK: Symbol("LOAD_WORK"),
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
    this._index = 1;
    this._peers = [];
    this._peerToHash = {};
    this._state = Worker.STATES.GENERATE_WORK_SEQUENCE;
    this._states = [];
    this._work = 0;
    this._workSequence = [];
    this._workSequenceLength = 10;
    this._completedWork = {};
    this._isWorkSaved = false;
    this._numWorkReceived = 0;
    this._numWorkLoaded = 0;
    this._recentWorkSync = false;
    this._workSavedQueue = [];

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
    });
   
    //define pubsub room
    this._room = Room(this._ipfs, roomName);
    //register events 
    //this._room.on('peer joined', (peer) => this.onPeerJoined(peer));
    //this._room.on('peer left', (peer) => this.onPeerLeft(peer));
    this._room.on('message', (message) => this.onMessage(message));
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

  onMessage(message){
    var messageData = this.parseMessage(message.data.toString());
    if(messageData.command === 'WORK_SAVED'){
      this._workSavedQueue.push({from:message.from,hash:messageData.data.hash});
    }
    else if(messageData.command === 'WORK_COMPLETED'){

    }
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
        console.log("Current peer index: " + this._index);
        //the appearance of a new peer means that we need to reset all the state vars
        this._allWorkReceived = false;
        this._isWorkSaved = false;
        this._states = []; 
        this._peerToHash = {};
        this.getPeers();
        console.log("New peer index: " + this._index);
        if(!this._isWorkSaved){
          console.log("Saving work");
          this.saveWork(this._work,this._completedWork[this._work]);
          this._isWorkSaved = true;
        }
        if(this._peers.length > 1){
          this._states.push(Worker.STATES.LOAD_WORK);  //don't need to load work if no peers
        }
        this._states.push(Worker.STATES.GENERATE_WORK_SEQUENCE);
      }
      else{
        if(this._state == Worker.STATES.LOAD_WORK){
          if(!this._allWorkReceived && Object.keys(this._peerToHash).length >= this._peers.length){
            this._allWorkReceived = true;
            //this means that we have received the work state from all peers
            this.loadWork();
            this._states.unshift(Worker.STATES.LOAD_WORK);
          }
          else{
            //process all the work saved messages
            while(this._workSavedQueue.length > 0){
              var message = this._workSavedQueue.shift();
              this._peerToHash[message.from] = message.hash;
              console.log("Received WORK_SAVED from: " + message.from);
              console.log("peerToHash: " + JSON.stringify(this._peerToHash));
              console.log("Num work received: " + Object.keys(this._peerToHash).length);
            }
            if(this._numWorkLoaded >= this._peers.length-1){
              let state;
              while(state != Worker.STATES.GENERATE_WORK_SEQUENCE){
                state = this._states.pop();
              }
              this._states.unshift(Worker.STATES.GENERATE_WORK_SEQUENCE);
              console.log("ALL WORK IS LOADED: " + this._work);
              this._numWorkLoaded = 0
              this._recentWorkSync = true;
            }
            else{
              console.log("Waiting...");
              //put this at the beginning of the array so it ensures the state stays the same
              this._states.unshift(Worker.STATES.LOAD_WORK);
            }
          }
        }
        else if(this._state == Worker.STATES.GENERATE_WORK_SEQUENCE){
          //console.log("Generating work sequence");
          this.generateWorkSequence();
          //console.log("Work sequence: " + this._workSequence);
          this._states.push(Worker.STATES.WORK);
          this._recentWorkSync = false;
        } 
        else if(this._state == Worker.STATES.WORK) {
          this.doWork();
          //console.log("Completed work: " + this._work);
          this._isWorkSaved = false;
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

    var peersLeft = prevPeers.filter((peer) => !peers.includes(peer));
    peersLeft.forEach(peer => this.onPeerLeft(peer));

    var peersJoined = peers.filter((peer) => !prevPeers.includes(peer));
    peersJoined.forEach(peer => this.onPeerJoined(peer));

    return (peersJoined.length > 0 || peersLeft.length > 0);
  }

  getPeers(){
    this._peers = this._room.getPeers();
    this._peers.push(this._id);
    this._peers.sort();
    this._peers.forEach((peer,index)=>{
      if(peer === this._id){ 
        this._index = index + 1;
      }
    });
  }

  generateWorkSequence(){
    //Work Sequence for a Peer:
    //Let N = peer index
    //Let i = sequence index
    //Let offset = W(N,0) + N
    //W(N,i) = Num(Peers)*i + offset

    var numPeers = this._peers.length;
    var length = this._workSequenceLength;
    var offset = 0;

    if(this._recentWorkSync){
      offset = this._work + this._index;
    }
    else{
      offset = this._work + numPeers;
    }
    this._workSequence = Array.from(Array(length).keys(), i => numPeers*i + offset);
    //this.emit('WorkSequenceGenerated', {});
  }

  doWork(){
    var input = this._workSequence.shift();
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
    this._completedWork[original]=iterations;
    this._work = original;
    this.emit('CompletedWork', {'peer':this._id,'peers':unique(this._peers),'work':original,'iterations':iterations});
  }

  updateState(){
    if(this._states.length > 0){
      this._state = this._states.shift();
    }
  }

  //The problem definition MUST override these.
  evaluation(inputs) {}
  assertions(original, number, iterations) {}


  saveWork(work,result){
    var path = this._id;
    var output = JSON.stringify({work:this._work ,completedWork:this._completedWork});  
    this._ipfs.files.add({path:path,content:Buffer.from(output)}, (err,file) => {
      console.log('Added file:',file[0].hash);
      var message = this.constructMessage('WORK_SAVED',{work:this._work,hash:file[0].hash});
      this._room.broadcast(message);
    })
  }

  loadWork(){
    for(let peer of this._peers) {
      if( peer !== this._id ){
        var hash = this._peerToHash[peer];
        if(hash !== 'undefined'){
          this._ipfs.files.cat(hash,(err,data)=>{
            var temp = JSON.parse(data);
            if(parseInt(temp.work) > this._work){
              console.log(parseInt(temp.work) + " > " + this._work);
              this._work = parseInt(temp.work);
            }
            this._completedWork = Object.assign(this._completedWork,temp.completedWork);
            this._numWorkLoaded += 1;
          });
        }
        else{
          console.log('ERROR: hash does not exist for worker!')
        }
      }
    }
  }

  parseMessage(message){
    return JSON.parse(message);
  }

  constructMessage(command, data){
    var message = {'command':command,'data':data}
    return JSON.stringify(message);
  }
}

module.exports = Worker;
