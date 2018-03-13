'use strict'

const EventEmitter = require('events');
const IPFS = require('ipfs')
const Room = require('ipfs-pubsub-room')
var unique = require('array-unique');

class Worker extends EventEmitter{

  constructor(roomName='OPO'){
    super();

    this._id = ''
    this._leadPeer = ''
    this._peers = []
    this._state = 1
    this._state_latch = 1
    this._work = 0
    this._pendingWork = []
    this._completedWork = {}

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
    this._room = Room(this._ipfs, roomName)

    //register events 
    this._room.on('peer joined', (peer) => this.onPeerJoined(peer))
    this._room.on('peer left', (peer) => this.onPeerLeft(peer))
    this._room.on('message', (message) => this.onMessage(message))

  }

  onPeerJoined(peer){
    //console.log('peer ' + peer + ' joined')
    this._state_latch = -1
    this.requestWork()
    this.emit('PeerJoined', {'peer':peer});
  }

  onPeerLeft(peer){
    this._state_latch = -1
    //console.log('peer ' + peer + ' left')
    this.emit('PeerLeft', {'peer':peer});
  }

  onMessage(message){
    var messageData = this.parseMessage(message.data.toString())
    if(messageData.command === 'REQUEST_WORK'){
      //console.log("Sending Work: " + messageData.work)
      this.sendWork(message.from,this._work)
      this._work += 1
    }
    else if(messageData.command === 'SEND_WORK'){
      if(this.updateWork(messageData)){
        this._state_latch = 1
        //console.log("Received Work: " + messageData.work)
      }
      else{
        //console.log("Lead Peer is behind.  Sending the latest state.")
        this.sendWork(message.from,this._work)
      }
    }
    else if(messageData.command === 'SUBMIT_WORK'){
      this._completedWork[parseInt(messageData.work)]=0
      var peers = this._peers;
      peers.push(this._id);
      this.emit('CompletedWork', {'peer':message.from,'peers':unique(peers),'work':parseInt(messageData.work),'iterations':parseInt(messageData.result)});
    }
  }

  get peers() {
    return this._peers;
  }

    get leadPeer() {
    return this._leadPeer;
  }

  start(){
    this._ipfs.once('ready', () => this._ipfs.id((err, info) => {
      if (err) { throw err }
      this._id = info.id
      this._leadPeer = info.id
      console.log('IPFS node ready with address ' + info.id)

      this.workLoop()
    }))
  }

  workLoop(){
    setInterval(() => {

      this._peers = this._room.getPeers()
      
      if(this._state == -1){
        this.selectLeadPeer()
      } 
      else if( this._state == 0){
        this.requestWork()
      } 
      else if(this._state == 1) {
        this.doWork()
      }

      this.updateState()

    }, 100)
  }

  //The problem definition MUST override these.
  evaluation(inputs) {}
  assertions(original, number, iterations) {}

  calc(){
    var flag = true;
    var iterations;
    var input = this._pendingWork.pop()
    var original = input
    //console.log("Work: " + original.toString())
    for(iterations = 0; input > 1 && flag == true; iterations++){
      [input,iterations,flag] = this.evaluation([input,iterations,flag]);
      if(this.assertions(original, input, iterations)) {
        this.store(original, input, iterations, true);
      } else {
        this.store(original, input, iterations, false);
      }
    }
    if (!flag){
      //console.log("**Solution already found for Work: " + original.toString() + " Iterations: " + this._completedWork[input])
    }
    //console.log("**Work: " + original.toString() + " Current: " + input.toString() + " Iteration: " + iterations.toString())
    return iterations
  }

  store(original, input, iterations, flagged){
    //Call Storj
    if(flagged) {
       // console.log("***FLAGGED***: Number: " + original + " Chain Height: " + iterations);
    }
  }

  selectLeadPeer(){
    if(this._peers.length > 0)
    {
      var peers = this._peers
      peers.push(this._id)
      peers.sort()
      this._leadPeer = peers[0]
      //console.log("Lead peer is: " + this._leadPeer)
    }
  }

  requestWork(){
    var message = this.constructMessage('REQUEST_WORK','')
    this._room.sendTo(this._leadPeer,message)
  }

  doWork(){
    this._pendingWork.push(this._work)
    //You have no peers.
    if(this._peers.length == 0){
      this._completedWork[this._work]=this.calc()
      this._work+=1
      this.submitWork(this._work,result)
    }
    //Other peers have joined
    else{
      while(this._pendingWork.length > 0){
        var result = this.calc()
        this._work+=1
        this.submitWork(this._work,result)
      }
    }
  }

  updateState(){
    if(this._state != this._state_latch){
      this._state = this._state_latch
    } 
    else
    {
      this._state = 0
      if(this._peers.length == 0) this._leadPeer = this._id
      if(this._leadPeer == this._id) this._state = 1
      this._state_latch = this._state
    }
  }

  sendWork(peer,work){
    var message = this.constructMessage('SEND_WORK',work,0)
    this._room.sendTo(peer,message)
  }

  submitWork(work,result){
    var message = this.constructMessage('SUBMIT_WORK',work,result)
    this._room.broadcast(message)
  }

  updateWork(message){
    var result = false
    var temp = parseInt(message.work) 
    if(temp >= this._work){
      if(this._state == 1){
        if(this._id === this._leadPeer){
          this._pendingWork = []
          this._work = temp
        }
        this._pendingWork.push(temp)
        unique(this._pendingWork)
      }
      else{
        this._work = temp
      }
      result = true
    }
    return result
  }

  parseMessage(message){
    return JSON.parse(message)
  }

  constructMessage(command, work, result){
    var message = {'command':command,'work':work,'result':result}
    return JSON.stringify(message)
  }
}

module.exports = Worker;
