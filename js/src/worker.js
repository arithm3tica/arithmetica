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
    this._workSequenceLength = 250;
    this._completedWork = {};
    this._numWorkReceived = 0;
    this._numWorkLoaded = 0;
    this._recentWorkSync = false;
    this._workSavedQueue = [];
    this._workLoadQueue = [];
    this._workRequestedQueue = [];
    this._workRequestSentTo = [];
    this._peerToRequest = {};
    this._epoch = 0;
    this._broadcastWork = false;

    //load work timeout
    this._num_loadWorks = 1;
    this._num_timeouts = 0;
    this._timeout = 20000;

    //if signalling server is down check the url https://ws-star-signal-2.servep2p.com/ in chrome
    this._ipfs = new IPFS({
      //allows us to test using same browser instance, but different windows
      repo: 'ipfs/arithmetica/' + Math.random(),
      EXPERIMENTAL: {
        pubsub: true,
        relay:{
          enabled: true,  //dialer/listener -> allows us to use relayed connections.
          hop: {
            enabled: true //actual relay -> this option tells the node to relay connections.
          }
        }
      },
      config: {
        Addresses: {
          Swarm: [
            '/dns4/ws-star-signal-2.servep2p.com/tcp/443/wss/p2p-websocket-star',
            '/dns4/ws-star-signal-1.servep2p.com/tcp/443/wss/p2p-websocket-star',
            '/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star',
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
      if(message.from !== this._id){
        this._workSavedQueue.push({peer:message.from,requestID:messageData.data.requestID,epoch:messageData.data.epoch,hash:messageData.data.hash});
      }
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
        //only broadcast the work if an epoch has ended (not bc a new peer was found) and there are peers in the room
        let afterSave = (err,file) => {
          console.log("   Added file: " + file[0].hash);
          this._peerToHash[this._id] = file[0].hash;
          this._epoch += 1;
          console.log("   Begin epoch: " + this._epoch);
        }
        this.saveWork(afterSave);
               
        if(this._peers.length > 1){
          //don't need to receive/load work if no peers
          this._states.push(Worker.STATES.RECEIVE_WORK);
          this._states.push(Worker.STATES.LOAD_WORK);
        }
        this._states.push(Worker.STATES.GENERATE_WORK_SEQUENCE);
      }
      else if(this._state == Worker.STATES.RECEIVE_WORK){
        if(this._prevState == Worker.STATES.FOUND_NEW_PEER){
          console.log("***RECEIVE_WORK***");
          this.requestWork();
        }
        this.processWorkSaved();
        //TODO: Do we want to make sure that the values aren't undefined?
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
        let afterLoad = (data) => {
            if(data === "Timeout"){
              //TODDO: needs to be a sep function
              var ratio = this._num_timeouts/(this._num_loadWorks+this._num_timeouts);
              if(ratio > .50 && this._num_loadWorks + this._num_timeouts > 5){
                  console.log("timeout ratio is: " + ratio + " setting timeout to 60 secs")
                  this._num_timeouts = 0;
                  this._num_loadWorks = 1;
                  this._timeout = 60000
              }
              //if loading the file times out then repeat
              this.loadWork(afterLoad);
            }
            else{
              if(parseInt(data.work) > this._work){
                console.log("   " + parseInt(data.work) + " > " + this._work);
                this._work = parseInt(data.work);
              }
              this._completedWork = Object.assign(this._completedWork,data.completedWork);
              //emit this event to allow the UI to populate current submission immediately
              this.emit('WorkLoaded',{peer:data.peer,work:data.work, completedWork:this._completedWork, workSequenceLength: this._workSequenceLength});
              this._numWorkLoaded += 1;
              console.log("   numWorkLoaded: " + this._numWorkLoaded);
            }
        };
        if(this._prevState == Worker.STATES.RECEIVE_WORK){
          console.log("***LOAD_WORK***");
          this.loadWork(afterLoad);
          this._states.unshift(Worker.STATES.LOAD_WORK);
        }
        else if(this._numWorkLoaded >= this._peers.length-1){
              let state;
              while(state != Worker.STATES.GENERATE_WORK_SEQUENCE && this._states.length > 0){
                state = this._states.pop();
              }
              this._states.unshift(Worker.STATES.GENERATE_WORK_SEQUENCE);
              this.emit('WorkLoaded',{peer: this._id, work:this._work, completedWork:this._completedWork, workSequenceLength: this._workSequenceLength});
              console.log("   ALL WORK IS LOADED: " + this._work);
              this._numWorkLoaded = 0;
              this._peerToHash = {};
        }
        else{
            console.log("   Waiting on NumWorkLoaded: " + this._numWorkLoaded + " NumPeers: " + this._peers.length);
            
            //put this at the beginning of the array so it ensures the state stays the same
            this._states.unshift(Worker.STATES.LOAD_WORK);
        }
      }
      else if(this._state == Worker.STATES.GENERATE_WORK_SEQUENCE){
        //console.log("***GENERATE_WORK_SEQUENCE***");
        this.generateWorkSequence();
        //console.log("   Work sequence: " + this._workSequence);
        this._states.push(Worker.STATES.WORK);
      } 
      else if(this._state == Worker.STATES.WORK) {
        //if(this._prevState != Worker.STATES.WORK){
        //  console.log("***WORK***");
        //}
        this.doWork();
        this.processWorkSaved();
        let afterLoad = (data) => {
          if(data === "Timeout"){
              console.log("Do work timeout on workload");
          }
          else{
            this._completedWork = Object.assign(this._completedWork,data.completedWork);
            this.emit('WorkLoaded',{peer:data.peer,work:data.work, completedWork:this._completedWork, workSequenceLength: this._workSequenceLength});
            console.log("   Finished loading saved work." );
          }
        };
        this.loadWork(afterLoad);
        //console.log("   Completed work: " + this._work);
        if(this._workSequence.length == 0){
          let afterSave = (err,file) => {
            console.log("   Added file: " + file[0].hash);
            this._peerToHash[this._id] = file[0].hash;
            this._broadcastWork = (this._peers.length > 1);
          }
          this.saveWork(afterSave);
          this._states.push(Worker.STATES.GENERATE_WORK_SEQUENCE);
        }
      }
      else {
        //do nothing
      }
      this.sendWork();
      this.updateState();
      this.checkTimeout();

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
      //console.log("   Incomplete Work: " + incompleteWork);
      //divide the incomplete work among the peers, based on peer's index
      incompleteWork.forEach((element,index) => {
        if(index+1 === this._index + numPeers*this._workSequence.length){
          this._workSequence.push(element);
        }
        if(element > start) start = element;
      });
      //console.log("   Assigned Incomplete Work: " + this._workSequence);
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
    this.emit('CompletedWork', {'peer':this._id,'peers':unique(this._peers),'work':original,'iterations':iterations,'hash':this._peerToHash[this._id]});
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

  saveWork(callback){
    var path = this._id;
    var output = JSON.stringify({peer: this._id,work:this._work,completedWork:this._completedWork});  
    this._ipfs.files.add({path:path,content:Buffer.from(output)}, (err,file) => callback(err,file));
  }

  processWorkSaved(){
    //process all the work saved messages
    while(this._workSavedQueue.length > 0){
      var message = this._workSavedQueue.shift();
      //requestID tells us that this work was requested by us for sync
      //if there is no requestID, then process it as a normal work sync between peers
      if(message.requestID == -1){
        //the peer sending this message is in state == WORK
        this._workLoadQueue.unshift(message);
        console.log("   Received WORK_SAVED from: " + message.peer);
      }
      else if(message.requestID == this._peerToRequest[message.peer].requestID){
        if(message.hash === undefined){
          console.log(message.peer + " send an undefined message.hash");
        }
        else{
          //the received work matches the latest request ID then update peerToHash
          this._peerToHash[message.peer] = message.hash;
          console.log("   Received WORK_SAVED from: " + message.peer);
          console.log("   Num work received: " + Object.keys(this._peerToHash).length);

          if(this._epoch < message.epoch){
            console.log("   Updating epoch from: " + this._epoch + " to: " + message.epoch);
            this._epoch = message.epoch;
          }
        }
      }
    }
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
      this._workRequestSentTo.push({peer:peer,requestID:requestID,epoch:this._epoch,timeout:100});
      this._peerToRequest[peer]={requestID:requestID, epoch:this._epoch};
    });   
  }

  sendWork(){
    if(this._peerToHash[this._id] !== undefined){
      console.log
      //the work has finished saving
      if(this._broadcastWork){
        console.log("   Broadcasting work to room");
        var message = this.constructMessage('WORK_SAVED',{requestID:-1,epoch:this._epoch,work:this._work,hash:this._peerToHash[this._id]});
        this._room.broadcast(message);
        this._broadcastWork = false;
      }
      else{
        if(this._workRequestedQueue.length > 0){
          //send saved work to each requestor in the queue
          var request = this._workRequestedQueue.shift();
          var message = this.constructMessage('WORK_SAVED',{requestID:request.requestID,epoch:this._epoch,work:this._work,hash:this._peerToHash[this._id]});
          //If the requestor's epoch is ahead of ours, then don't reply.  
          //This avoids an issue where we send old data because 
          //the requestor has quickly saved their work and incrememented 
          //their epoch and we haven't finished saving our work.
          if(request.epoch > this._epoch){
            console.log("   My Epoch is behind Thiers. Mine: " + this._epoch + " Theirs: " + request.epoch);
            this._epoch = request.epoch;
          }
          else{
            console.log("   Sending Work to: " + request.peer);
            this._room.sendTo(request.peer,message);
            if(request.epoch < this._epoch) console.log("   Their Epoch is behind Mine. Mine: " + this._epoch + " Theirs: " + request.epoch);
          }
        }
      }
    }
  }

  loadWork(callback){
    var getFile = (hash,peer) => {
      console.log("   Loading hash: " + hash + "\n   from peer: " + peer);
      var cat = this._ipfs.files.cat(hash).then((data) => {
        return new Promise((resolve,reject) => { resolve(data) });
      });

      var timeout = new Promise((resolve,reject)=>{
        let id = setTimeout(()=>{
          clearTimeout(id);
          reject('Load Work Timed Out.')

        },this._timeout);
      });

      Promise.race([cat,timeout]).then((result) => {
        this._num_loadWorks += 1;
        callback(JSON.parse(result));
      }).catch(error => {
        console.log(error);
        this._num_timeouts += 1;
        callback("Timeout");
        //console.log('Trying the HTTP gateway');
        //jsonp('https://ipfs.io/ipfs/'+hash,'callback',(data)=>{
        //  console.log("Retrieved hash: " + hash + " from HTTP Gateway");
        //  callback(JSON.stringify(data));
        });
        //this.getJSONP('https://ipfs.io/ipfs/'+hash, (data)=>{
        //  console.log(JSON.parse(data));
        //  callback(JSON.parse(data));
        //});  
      //});
      
    }
    if(this._state == Worker.STATES.LOAD_WORK){
      for(let peer of this._peers) {
        if( peer !== this._id ){
          let hash = this._peerToHash[peer];
          console.log("    Loading Peer,Hash: " + peer + " " + hash);
          if(this._peerToHash.hasOwnProperty(peer) && hash !== undefined){
            getFile(hash,peer);
          }
        }
      }
    }
    else{ // this._state == Worker.STATES.WORK
      if(this._workLoadQueue.length > 0){
        var message = this._workLoadQueue.shift();
        console.log("    " + this._workLoadQueue.length + " work objects pending load from ipfs.")
        getFile(message.hash,message.peer);
      }
    }
  }

  checkTimeout(){
    var ratio = this._num_timeouts/(this._num_loadWorks+this._num_timeouts);
    if(ratio > .50 && this._num_loadWorks + this._num_timeouts > 5){
      console.log("timeout ratio is: " + ratio + " setting timeout to 60 secs")
      this._num_timeouts = 0;
      this._num_loadWorks = 1;
      this._timeout = 60000
    }

    if(this._num_loadWorks + this._num_timeouts > 10){
      this._num_timeouts = 0;
      this._num_loadWorks = 1;
    }
  }
  parseMessage(message){
    return JSON.parse(message);
  }

  constructMessage(command, data){
    var message = {'command':command,'data':data}
    return JSON.stringify(message);
  }

  getJSONP(url, success) {

    var ud = '_' + +new Date,
        script = document.createElement('script'),
        head = document.getElementsByTagName('head')[0] 
               || document.documentElement;

    window[ud] = function(data) {
        head.removeChild(script);
        success && success(data);
    };

    script.src = url.replace('callback=?', 'callback=' + ud);
    head.appendChild(script);

   }
}

module.exports = Worker;
