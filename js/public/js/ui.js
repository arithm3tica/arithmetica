var steps = -1;
var totalSubmissions = 0;
var rebuildTable = false;
var leadPeer = '';
var id = '';

var submissionsContainer = document.getElementById('submissionsChart');
var submissionsWindow = {min: 0,max: 50};
var submissionsChartOptions = {
    min: 0,
    start: submissionsWindow.min,
    end: submissionsWindow.max,
    showCurrentTime: false,
    showMajorLabels: false,
    dataAxis: {
        left: {
          title:{
            text: 'Submissions'
          }
        }
    },
    format: {
      minorLabels: {
          millisecond: 'x',
          second: 'x',
          minute: 'x',
          hour: 'x',
          weekday: 'x',
          day: 'x',
          month: 'x',
          year: 'x'
      },
      majorLabels: {
          millisecond: '',
          second: '',
          minute: '',
          hour: '',
          weekday: '',
          day: '',
          month: '',
          year: ''
      }
    },
    sort: false,
    sampling:false,
    style:'line',
    zoomable: false,
    moveable: false,
    drawPoints: {
        enabled: false,
        size: 6,
        style: 'circle' // square,
    },
    height: '400px'
};

var submissionsData=[];
var submissionsDataset = new vis.DataSet(submissionsData,{});
var submissionsChart = new vis.Graph2d(submissionsContainer, submissionsDataset, submissionsChartOptions);


var iterationsContainer = document.getElementById('iterationsChart');
var iterationsData = [];
var xIterationsMax = 100;
var iterationsChartOptions = {
    min:0,
    start: 0,
    end: xIterationsMax,
    showCurrentTime: false,
    showMajorLabels: false,
    dataAxis: {
        left: {
          title:{
            text: 'Iterations'
          },
          range: {
            min: 0
          }
        }
    },
    format: {
      minorLabels: {
          millisecond: 'x',
          second: 'x',
          minute: 'x',
          hour: 'x',
          weekday: 'x',
          day: 'x',
          month: 'x',
          year: 'x'
      },
      majorLabels: {
          millisecond: '',
          second: '',
          minute: '',
          hour: '',
          weekday: '',
          day: '',
          month: '',
          year: ''
      }
    },
    sort: true,
    sampling:false,
    style:'points',
    zoomable: false,
    moveable: false,
    drawPoints: {
        enabled: true,
        size: 6,
        style: 'circle' // square, circle
    },
    defaultGroup: 'Scatterplot',
    height: '400px'
};
var iterationsData = [];
var iterationsDataset = new vis.DataSet(iterationsData,{});
var iterationsChart = new vis.Graph2d(iterationsContainer, iterationsDataset, iterationsChartOptions);

function workerEvent(eventName, data){
  if(eventName == 'CompletedWork'){
      totalSubmissions += 1;
      iterationsData.push({x:data.work,y:data.iterations});
      if(rebuildTable){
        buildTable(data);
        rebuildTable = false;
      }
      else{
        updateTableObject(data.peer, data.work);
      }
  }
  else if (eventName == 'PeerJoined'){
      addTableObject(data.peer, 0);
  }
  else if (eventName == 'PeerLeft'){
      deleteTableObject(data.peer);
  }
  else if (eventName == 'LeadPeerSelected'){
      leadPeer = data.peer;
  }
  else if (eventName == 'InitCompleted'){
      id = data.peer;
  }

}


setInterval(() => {
  steps++;
  var submissionItemToDelete = 0;
  if(submissionsDataset.length > 50){
    //only show 50 secs worth of submission rate data on chart
    submissionItemToDelete = submissionsDataset.min('x');
    submissionsDataset.remove(submissionItemToDelete);
    if(steps > submissionsWindow.max){
        submissionsWindow.min = steps-10;
        submissionsWindow.max = steps + 40;
        submissionsChart.setWindow(submissionsWindow.min,submissionsWindow.max);
    }

  }

  submissionsData.push({x:steps,y:totalSubmissions});  
  //submissionsChart.setItems(submissionsData);
  submissionsDataset.add(submissionsData);  
  //submissionsChart.fit();
  submissionsData = [];
  totalSubmissions = 0;
  var max = iterationsDataset.max('x');
  if(max !== null && max.x > xIterationsMax){
    xIterationsMax += xIterationsMax; 
    iterationsChart.setWindow(0,xIterationsMax);
  }
  //iterationsChart.setItems(iterationsData);
  iterationsDataset.add(iterationsData)
  iterationsData = [];
  //iterationsChart.fit();

  if(steps % 10 == 0){
    rebuildTable = true;
  }
}, 1000)

var participantTable = [];

function buildTable(data){
    var tempTable = [];
    for(var i = 0; i < data.peers.length; i++){
      tempTable.push({"id": data.peers[i], "count": 0});
    }
    function compare(a, b) {
      let comparison = 0;
      if (a.id > b.id) {
        comparison = 1;
      } else if (a.id < b.id) {
        comparison = -1;
      }
      return comparison;
    }
    var tempParticipantTable = participantTable;
    tempParticipantTable.sort(compare);
    tempTable.sort(compare);
    if(!(tempParticipantTable.length==tempTable.length && tempParticipantTable.every((v,i)=> v.id == tempTable[i].id))){
      participantTable = [];
      rebuildTbody();
    }
}

function addTableObject(workerId, count) {
    var index = participantTable.findIndex((element) => {
        return element.id == workerId;
    });
    if(index == -1){
        participantTable.push({"id": workerId, "count": count});
        rebuildTbody();
    }
}

function updateTableObject(workerId, count) {
  var index = participantTable.findIndex((element) => {
      return element.id == workerId;
  });
  if( index == -1 ){
      addTableObject(workerId, count);
  }
  else{
      participantTable[index] = {"id": workerId, "count": count};
      rebuildTbody();
  }
}

function deleteTableObject(workerId) {
  var index = participantTable.findIndex((element) => {
      return element.id == workerId;
  });
  participantTable = participantTable.splice(index,1);
  rebuildTbody();
}

function rebuildTbody() {
  $("#participant-table-body").html(generateTbodyString());
}

function generateTbodyString() {
  let innerHTML = "";
  let myHTML = "";
  let counter = 1;
  for(let party of participantTable) {
      if(party.id === leadPeer){
        role = 'Leader'
      }
      else{
        role = 'Worker'
      }

      if(party.id !== id){
        innerHTML = innerHTML + "<tr> <th scope=\\\"row\\\"> Peer " + counter + "</th><td>" + party.id + "</td><td>" + role + "</td><td>" + party.count + "</td></tr>";
        counter++;
      }
      else {
        myHTML = "<tr> <th scope=\\\"row\\\"> Me </th><td>" + party.id + "</td><td>" + role + "</td><td>" + party.count + "</td></tr>";
      }
  }
  innerHTML = myHTML + innerHTML;
  return innerHTML;
}

