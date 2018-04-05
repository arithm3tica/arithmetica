'use strict'

const EventEmitter = require('events');
const IPFS = require('ipfs');
const Room = require('ipfs-pubsub-room');
const unique = require('array-unique');
const uuid = require('uuid/v4');

const STATES = Object.freeze({
  NEW_PEER: Symbol("FOUND_NEW_PEER"),
  RECEIVE_WORK: Symbol("RECEIVE_WORK"),
  LOAD_WORK: Symbol("LOAD_WORK"),
  GENERATE_WORK_SEQUENCE: Symbol("GENERATE_WORK_SEQUENCE"),
  WORK: Symbol("WORK"),
  WAIT: Symbol("WAIT")
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
    this._prevState = Worker.STATES.WAIT;
    this._state = Worker.STATES.GENERATE_WORK_SEQUENCE;
    this._states = [];
    this._work = 0;
    this._workSequence = [];
    this._workSequenceLength = 100;
    this._completedWork = {};
    this._numWorkReceived = 0;
    this._numWorkLoaded = 0;
    this._recentWorkSync = false;
    this._workSavedQueue = [];
    this._workRequestedQueue = [];
    this._workRequestSentTo = [];
    this._peerToRequest = {};
    this._epoch = 0;

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
    this._room.on('error',(err) => console.log('PubSubRoom ERROR: ' + err));
    this._room.on('subscribed',() => { console.log("Subscribed to room.") });
    //register events 
    //this._room.on('peer joined', (peer) => this.onPeerJoined(peer));
    //this._room.on('peer left', (peer) => this.onPeerLeft(peer));
    this._room.on('message', (message) => this.onMessage(message));
    this.emit('InitCompleted', {'peer':this._id});
    
  }

  onPeerJoined(peer){
    console.log('\nPeer: ' + peer + ' joined.\n');
    this.emit('PeerJoined', {'peer':peer});
  }

  onPeerLeft(peer){
    delete this._peerToHash[peer];
    console.log('\nPeer: ' + peer + ' left.\n');
    this.emit('PeerLeft', {'peer':peer});
  }

  onMessage(message){
    var messageData = this.parseMessage(message.data.toString());
    if(messageData.command === 'WORK_SAVED'){
      this._workSavedQueue.push({peer:message.from,requestID:messageData.data.requestID,epoch:messageData.data.epoch,hash:messageData.data.hash});
    }
    else if(messageData.command === 'WORK_REQUESTED'){
      if(this._workRequestedQueue.findIndex((element) => { return (element.peer == message.peer)}) === -1){
        this._workRequestedQueue.push({peer:message.from,requestID:messageData.data.requestID,epoch:messageData.data.epoch});
      }
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
    }));
  }

  stop(){
    console.log("Leaving Room");
    this._room.leave();
  }

  mainLoop(){

   setInterval(() => {
      this.checkForNewPeers();
      if(this._state == Worker.STATES.FOUND_NEW_PEER){
        console.log("***FOUND_NEW_PEER***");
        if(this._prevState == Worker.STATES.WORK || this._prevState == Worker.STATES.GENERATE_WORK_SEQUENCE){
          console.log("   Resetting all state variables");
          //the appearance of a new peer means that we need to reset all the state vars
          this._states = []; 
          this._peerToHash = {};
          this._workSavedQueue = [];
          this._peerToRequest = {};
        }

        console.log("   Old peer index: " + this._index);
        this.getPeers();
        console.log("   New peer index: " + this._index);
        
        console.log("   Saving work");
        this.saveWork(this._work,this._completedWork[this._work]);
        
        if(this._peers.length > 1){
          //don't need to receive/load work if no peers
          this._states.push(Worker.STATES.RECEIVE_WORK);
          this._states.push(Worker.STATES.LOAD_WORK)
        }
        this._states.push(Worker.STATES.GENERATE_WORK_SEQUENCE);
      }
      else if(this._state == Worker.STATES.RECEIVE_WORK){
        if(this._prevState == Worker.STATES.FOUND_NEW_PEER){
          console.log("***RECEIVE_WORK***");
          this.requestWork();
        }
        //process all the work saved messages
        while(this._workSavedQueue.length > 0){
          var message = this._workSavedQueue.shift();
          if(message.requestID == this._peerToRequest[message.peer].requestID){
            //the received work matches the latest request ID then update peerToHash
            this._peerToHash[message.peer] = message.hash;
            console.log("   Received WORK_SAVED from: " + message.peer);
            //console.log("   peerToHash: " + JSON.stringify(this._peerToHash));
            console.log("   Num work received: " + Object.keys(this._peerToHash).length);

            if(this._epoch < message.epoch){
              console.log("   Updating epoch from: " + this._epoch + " to: " + message.epoch);
              this._epoch = message.epoch;
            }
          }
        }
        if(Object.keys(this._peerToHash).length >= this._peers.length){
          console.log("   ALL WORK IS RECEIVED");
          let state;
          while(state != Worker.STATES.LOAD_WORK && this._states.length > 0){
            state = this._states.pop();
          }
          this._states.unshift(Worker.STATES.LOAD_WORK);
        }
        else{
          console.log("   Waiting on NumWorkReceived: " + Object.keys(this._peerToHash).length + " NumPeers: " + this._peers.length);
          this.requestWork();
          //put this at the beginning of the array so it ensures the state stays the same
          this._states.unshift(Worker.STATES.RECEIVE_WORK);
        }

      }
      else if(this._state == Worker.STATES.LOAD_WORK){
        if(this._prevState == Worker.STATES.RECEIVE_WORK){
          console.log("***LOAD_WORK***");
          this.loadWork();
          this._states.unshift(Worker.STATES.LOAD_WORK);
        }
        else if(this._numWorkLoaded >= this._peers.length-1){
              let state;
              while(state != Worker.STATES.GENERATE_WORK_SEQUENCE && this._states.length > 0){
                state = this._states.pop();
              }
              this._states.unshift(Worker.STATES.GENERATE_WORK_SEQUENCE);
              console.log("   ALL WORK IS LOADED: " + this._work);
              this._numWorkLoaded = 0
        }
        else{
            console.log("   Waiting on NumWorkLoaded: " + this._numWorkLoaded + " NumPeers: " + this._peers.length);
            //put this at the beginning of the array so it ensures the state stays the same
            this._states.unshift(Worker.STATES.LOAD_WORK);
        }
      }
      else if(this._state == Worker.STATES.GENERATE_WORK_SEQUENCE){
        console.log("***GENERATE_WORK_SEQUENCE***");
        this.generateWorkSequence();
        console.log("   Work sequence: " + this._workSequence);
        this._states.push(Worker.STATES.WORK);
      } 
      else if(this._state == Worker.STATES.WORK) {
        //if(this._prevState != Worker.STATES.WORK){
        //  console.log("***WORK***");
        //}
        this.doWork();
        //console.log("   Completed work: " + this._work);
        if(this._workSequence.length == 0){
          this._states.push(Worker.STATES.GENERATE_WORK_SEQUENCE);
        }
      }
      else {
        //do nothing
      }
      this.sendWork();
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

    if(peersJoined.length > 0 || peersLeft.length > 0){
      this._prevState = this._state;
      this._state = Worker.STATES.FOUND_NEW_PEER;
      this._states = [];
    }
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
    var start = this._work;
    this._workSequence = [];
    var length = this._workSequenceLength - this._workSequence.length;
    var offset = 0;

    if(this._prevState == Worker.STATES.WORK){
      offset = start + numPeers;
    }
    else{
      //when a new epoch begins, we check the completed work structure
      //for skipped work and add it to the work sequence
      //create a list: [1,...,N]
      var prevWork = Array.from(Array(this._work).keys(),i=>i+1);
      //create a list of work not found in completed work
      var incompleteWork = prevWork.filter((element)=>{
        return !this._completedWork.hasOwnProperty(element);
      });
      console.log("   Incomplete Work: " + incompleteWork);
      //divide the incomplete work among the peers, based on peer's index
      incompleteWork.forEach((element,index) => {
        if(index+1 === this._index + numPeers*this._workSequence.length){
          this._workSequence.push(element);
        }
        if(element > start) start = element;
      });
      console.log("   Assigned Incomplete Work: " + this._workSequence);
      offset = start + this._index;
    }
    //any remaining room in the work sequence is filled with the new work
    this._workSequence.push(...Array.from(Array(length).keys(), i => numPeers*i + offset));
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
      this._prevState = this._state;
      this._state = this._states.shift();
    }
  }

  //The problem definition MUST override these.
  evaluation(inputs) {}
  assertions(original, number, iterations) {}


  saveWork(work,result){
    var path = this._id;
    var output = JSON.stringify({work:this._work,completedWork:this._completedWork});  
    this._ipfs.files.add({path:path,content:Buffer.from(output)}, (err,file) => {
      console.log("   Added file: " + file[0].hash);
      this._peerToHash[this._id] = file[0].hash;
      this._epoch += 1;
      console.log("   Begin epoch: " + this._epoch);
    })
  }

  requestWork(){
    //recieved work from these peers already
    var receivedFrom = Object.keys(this._peerToHash);
    //decrement the timeout variable for the work requests we have sent
    this._workRequestSentTo.forEach(element => {
      element.timeout = element.timeout - 1;
    });
    //remove work requests that have timed out
    this._workRequestSentTo = this._workRequestSentTo.filter(element => element.timeout > 0);
    var temp = this._workRequestSentTo.map(element => element.peer);
    //add peers that you have requested work from to the list of received from 
    receivedFrom.push(...temp);
    //create list of peers that you haven't received work from
    var notReceivedFrom = this._peers.filter((peer) => !receivedFrom.includes(peer));
    //request work from the peers you haven't received work from
    var requestID = uuid();
    var message = this.constructMessage('WORK_REQUESTED',{requestID:requestID, epoch:this._epoch});
    notReceivedFrom.forEach(peer => { 
      console.log("   Requesting Work from: " + peer);
      this._room.sendTo(peer,message);
      this._workRequestSentTo.push({peer:peer,requestID:requestID,epoch:this._epoch,timeout:10});
      this._peerToRequest[peer]={requestID:requestID, epoch:this._epoch};
    });   
  }

  sendWork(){
    if(this._peerToHash[this._id] != 'undefined'){
      while(this._workRequestedQueue.length > 0){
        var request = this._workRequestedQueue.shift();
        //If the requestor's epoch is ahead of ours, then don't reply.  
        //This avoids an issue where we send old data because 
        //the requestor has quickly saved their work and incrememented 
        //their epoch and we haven't finished saving our work.
        if(request.epoch > this._epoch){
          console.log("   My Epoch is behind Thiers. Mine: " + this._epoch + " Theirs: " + request.epoch);
        }
        else{
          console.log("   Sending Work to: " + request.peer);
          var message = this.constructMessage('WORK_SAVED',{requestID:request.requestID,epoch:this._epoch,work:this._work,hash:this._peerToHash[this._id]});
          this._room.sendTo(request.peer,message);
          if(request.epoch < this._epoch) console.log("   Their Epoch is behind Mine. Mine: " + this._epoch + " Theirs: " + request.epoch);
        }
      }
    }
  }

  loadWork(){
    for(let peer of this._peers) {
      if( peer !== this._id ){
        var hash = this._peerToHash[peer];
        console.log("   Loading hash: " + hash + "\n   from peer: " + peer);
        if(hash !== 'undefined'){
          this._ipfs.files.cat(hash,(err,data)=>{
            if(err){console.log(err)}
            var temp = JSON.parse(data);
            if(parseInt(temp.work) > this._work){
              console.log("   " + parseInt(temp.work) + " > " + this._work);
              this._work = parseInt(temp.work);
            }
            this._completedWork = Object.assign(this._completedWork,temp.completedWork);
            this._numWorkLoaded += 1;
            console.log("   numWorkLoaded: " + this._numWorkLoaded);
          });
        }
        else{
          console.log("   ERROR: hash does not exist for worker!")
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
