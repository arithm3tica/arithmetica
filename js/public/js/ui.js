setupEditor();

var steps = -1;
var totalSubmissions = 0;
var totalWorkLoaded = 0;
var avgWorkLoaded = 0;
var workLoaded = [];
var rebuildTable = false;
var id = '';

var submissionsContainer = document.getElementById('submissionsChart');
var submissionsWindow = {min: 0,max: 100};
var submissionsChartOptions = {
    min: 0,
    start: submissionsWindow.min,
    end: submissionsWindow.max,
    showCurrentTime: false,
    showMajorLabels: false,
    showMinorLabels: true,
    dataAxis: {
        left: {
          title:{
            text: 'Submissions Per Second'
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
          millisecond: 'x',
          second: 'x',
          minute: 'x',
          hour: 'x',
          weekday: 'x',
          day: 'x',
          month: 'x',
          year: 'x'
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
    showMinorLabels: true,
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
          millisecond: 'x',
          second: 'x',
          minute: 'x',
          hour: 'x',
          weekday: 'x',
          day: 'x',
          month: 'x',
          year: 'x'
      },

    },
    sort: true,
    sampling:false,
    style:'points',
    zoomable: false,
    moveable: false,
    drawPoints: {
        enabled: true,
        size: 3,
        style: 'circle' // square, circle
    },
    defaultGroup: 'Scatterplot',
    height: '400px'
};
var iterationsData = [];
var iterationsDataset = new vis.DataSet(iterationsData,{});
var iterationsChart = new vis.Graph2d(iterationsContainer, iterationsDataset, iterationsChartOptions);
var latestHash = '';
var updateTable = false;
var numPeers = 0;
var _data = {};

function workerEvent(eventName, data){
  if(eventName == 'CompletedWork'){
      totalSubmissions += 1;
      latestHash = data.hash;
      numPeers = data.peers.length
      _data = data;
      iterationsData.push({x:data.work,y:data.iterations})
      if(rebuildTable){
        buildTable(data);
        rebuildTable = false;
      }
      if(updateTable){
        updateTableObject(data.peer, data.work);
        updateTable = false;
      }
  }
  else if (eventName == 'WorkLoaded'){
      totalWorkLoaded += data.workSequenceLength;
      updateTableObject(data.peer, data.work);
      updateIterationsChart(data);
      _data = data;
  }
  else if (eventName == 'PeerJoined'){
      addTableObject(data.peer, 0);
  }
  else if (eventName == 'PeerLeft'){
      deleteTableObject(data.peer);
  }
  else if (eventName == 'InitCompleted'){
      id = data.peer;
  }

}


setInterval(() => {
  steps++;
  updateTable = true;
  updateLinktoLatestData();
  updateSubmissionsChart(steps);
  updateIterationsChart(_data);

}, 1000)

var participantTable = [];

function updateSubmissionsChart(steps){
  workLoaded.push(totalWorkLoaded);
  if(workLoaded.length > 20){
    workLoaded.shift();
  }
  totalWorkLoaded = 0;

  var submissionItemToDelete = 0;
  if(submissionsDataset.length > 100){
    //only show 50 secs worth of submission rate data on chart
    submissionItemToDelete = submissionsDataset.min('x');
    submissionsDataset.remove(submissionItemToDelete);
    if(steps > submissionsWindow.max){
        submissionsWindow.min = steps - 10;
        submissionsWindow.max = steps + 90;
        submissionsChart.setWindow(submissionsWindow.min,submissionsWindow.max);
    }

  }
  submissionsData.push({x:steps,y:totalSubmissions*numPeers});  
  submissionsDataset.add(submissionsData);  
  submissionsData = [];
  totalSubmissions = 0;
}

function updateIterationsChart(data){
    
    var shouldUpdate = false;
    var maxX = 0;
    if(iterationsDataset.length > 0) maxX = iterationsDataset.max('x').x;


    if(maxX < data.work * 0.75){
      shouldUpdate = true;
      console.log("Should update iterations chart. Max X: " + maxX)
    }

    //TODO: consider searching through the iterationsDataset for points not already added to 
    //the plot.  this would allow us to not have to clear the plot and reload it completely
    if(data.hasOwnProperty("completedWork")){
      iterationsData = [];
      for (var i=1;i<data.work;i++){
        if(data.completedWork.hasOwnProperty(i)){
          iterationsData.push({x:i,y:data.completedWork[i]});
        }
      }

      iterationsDataset.clear();
      iterationsDataset = new vis.DataSet(iterationsData,{});
      iterationsChart.destroy();
      iterationsChartOptions.end = maxX;
      iterationsChart = new vis.Graph2d(iterationsContainer, iterationsDataset, iterationsChartOptions);
      iterationsChart.fit();
    }
    else if(maxX < 500 || shouldUpdate){
      iterationsDataset.add(iterationsData);
      iterationsChartOptions.end = data.work;
      iterationsChart.fit();
      iterationsData = [];
    }
}

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
    if(index == -1 && workerId !== undefined && count !== undefined){
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
  if(index !== -1){
    participantTable.splice(index,1);
    rebuildTbody();
  }
}

function rebuildTbody() {
  $("#participant-table-body").html(generateTbodyString());
}

function generateTbodyString() {
  let innerHTML = "";
  let myHTML = "";
  let counter = 1;
  let link = "-";
  for(let party of participantTable) {

      if(party.id !== id){
        link = "-";
        innerHTML = innerHTML + "<tr> <th scope=\\\"row\\\"> Peer " + counter + "</th><td>" + party.id + "</td><td>" + link + "</td><td>" + party.count + "</td></tr>";
        counter++;
      }
      else {
        if(latestHash !== undefined && latestHash.length > 0){
          link = "<a id='latestData' href='https://ipfs.io/ipfs/"+latestHash+"' target='_blank'>here</a>"
        }
        myHTML = "<tr> <th scope=\\\"row\\\"> Me </th><td>" + party.id + "</td><td>" + link + "</td><td>" + party.count + "</td></tr>";
      }
  }
  innerHTML = myHTML + innerHTML;
  return innerHTML;
}

function updateLinktoLatestData(){
  $("#latestData").attr("href","https://ipfs.io/ipfs/" + latestHash);
}

function setupEditor(){
    var evaluationEditor = ace.edit("evaluation-input");
    evaluationEditor.setTheme("ace/theme/chrome");
    evaluationEditor.session.setMode("ace/mode/javascript");
    evaluationEditor.setOption("maxLines", 15);
    evaluationEditor.setOption("minLines", 15);
    evaluationEditor.setOption("highlightActiveLine", false);


    var assertionEditor = ace.edit("assertion-input");
    assertionEditor.setTheme("ace/theme/chrome");
    assertionEditor.session.setMode("ace/mode/javascript");
    assertionEditor.setOption("maxLines", 15);
    assertionEditor.setOption("minLines", 15);
    assertionEditor.setOption("highlightActiveLine", false);


    evaluationEditor.insert('function evaluation(input) {\n'+
        '\tinput += 1;\n'+
        '\treturn input;\n'+
        '}');
    assertionEditor.insert('function assertions(original, number, iterations) {\n'+
        '\tif(iterations > 10) return true;\n'+
        '}');
}

