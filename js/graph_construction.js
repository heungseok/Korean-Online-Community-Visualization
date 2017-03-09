/**
 * Created by heungseok2 on 2017-02-07.
 */


var $ = require("jquery");
var nGraph = require('ngraph.graph');
var http = require('http');
var elementClass = require('element-class');

var d3_chart = require('./../js/d3_chart.js');

// load renderer
var graphRenderer = require('./../js/index.js');

// load node UI
var createSettingsView = require('config.pixel');
var addCurrentNodeSettings = require('../nodeSettings.js');

// create Graph var
var graph = nGraph();
// create graph Renderer var
var renderer = graphRenderer(graph,{
    container: document.getElementById("container"),
    link: renderLink,
    node: renderNode
});


// variable for var chart
var chartDom;

// gui view, renderer setting
var settingsView = createSettingsView(renderer);
var gui = settingsView.gui();
var nodeSettings = addCurrentNodeSettings(gui, renderer);
var physicsSettings = {gravity: -5}; // construct physics simulator settings

var degreeThreshold_ToShowLabel = 30;


var currentName= "AhnCheolSoo"; // name of the current network (default as 안철수)
var targetName = "AhnCheolSoo"; // name of the target network (default as 안철수)


// load graph file remotely using GET method.
AjaxFileRead();


function AjaxFileRead() {

    var pathName = "./data/" + targetName + "_network.json";

    http.get({path : pathName, json: true }, function (res) {
        console.log("0. Load graph file start.");

        var body = '';
        res.on('data', function (buf) {
            body += buf;
        });
        res.on('end', function () {
            // Data reception is don, do whatever with it!
            var parsed = JSON.parse(body);
            console.log("1. Load the graph file completed.");
            // console.log(parsed);

            console.log("2. Start Initializing graph ");
            graph.beginUpdate();
            parsed['nodes'].forEach(function (node) {
                graph.addNode(node.id, {
                    label: node.label,
                    color: Number(rgb2hex(node.color)),
                    size: node.size,
                    activated: false
                });
            });
            parsed['edges'].forEach(function (edge) {
                graph.addLink(edge.source, edge.target, {
                    color: rgb2hex(edge.color),
                    activated: false
                });
            });
            graph.endUpdate();

            renderer.initLabels(degree = degreeThreshold_ToShowLabel);
            console.log("3. Finished graph construct");

            /*
             // pass it as second argument to layout:
             var layout = require('ngraph.forcelayout3d')(graph, physicsSettings);
             for (var i =0; i < 500; ++i) {
             layout.step();
             console.log(i);
             }
             // layout.dispose();
             */
            console.log("4. stop the layout after loading the data");
            window.setTimeout(function () {
                renderer.stable(true);
            }, 5000);

        });
    });


}


// d3 차트생성
var d3_ui = d3_chart('container2');
d3_ui.init();



// 후보자 클릭 이벤트.
$(".candidates").click(function () {
   targetName = $(this).attr("name");

   if(targetName != currentName){
       console.log("Switch Network! {current network: "+ currentName +
                    ", target network: " + targetName);

       graph.clear();
       renderer.clearHtmlLabels();
       // set renderer as unstable to enable 3d force-atlas Layout
       renderer.stable(false);

       // load other network
       AjaxFileRead();
       currentName = targetName;

   }else {
       console.log("current network is same with the target")
   }

});

// 커뮤니티 클릭 이벤트.

///
function renderNode(node) {
    if(node.data.activated) return{
        color: node.data.color,
        size: 10 + node.data.size * 0.5
    };

    return {
        color: node.data.color,
        size: 10 + node.data.size * 0.3
    };
}

function renderLink(link) {
    if(link.data.activated) return{
        fromColor: 0xFF0000,
        toColor: 0xFF0000
    };

    return {
        fromColor: link.data.color,
        toColor: 0x000000
    };
}



// 노드 이벤트.
function showNodeDetails(node) {
    var nodeUI = renderer.getNode(node.id);
    // console.log(node);
    nodeSettings.setUI(nodeUI, node.data.label);
    // 네트워크 노드 틀릭시 차트 변경에 대한 이벤트, 지금은 쓰지않음.(현재 후보 클릭시 커뮤니티별 언급량 시각화로 대체) 2017.03.08
    // d3_ui.updateData(node.data.label);

}

function getNumber(string, defaultValue) {
    var number = parseFloat(string);
    return (typeof number === 'number') && !isNaN(number) ? number : (defaultValue || 10);
}


renderer.on('nodeclick', showNodeDetails);
renderer.on('nodedblclick', function(node) {
    renderer.showNode(node.id, 300);
    renderer.setSelectedNode(node);
    // activeNeighbors(node);
    console.log(node);
    // console.log('Double clicked on ' + JSON.stringify(node));
});



function activeNeighbors(node){
    links = node.links;

    node.links.forEach(function (link) {
        var linkUI = renderer.getLink(link.id);
        linkUI.fromColor = 0xFF0000;
        linkUI.toColor = 0xFF0000;

    })
}


// the function is to change rgb(r, g, b, alpha) to '0xrrggbb' format
function rgb2hex(rgb){
    rgb = rgb.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);

    return (rgb && rgb.length === 4) ? "0x" +
        ("0" + parseInt(rgb[1],10).toString(16)).slice(-2) +
        ("0" + parseInt(rgb[2],10).toString(16)).slice(-2) +
        ("0" + parseInt(rgb[3],10).toString(16)).slice(-2) : '';
}


renderer.on('nodehover', function(node) {
    // console.log('Hover node ' + JSON.stringify(node));
});


// graph file load function using local fileSystem synchronously ( not recommend)
function filedRead() {
    var content = fs.readFileSync('./data/test2.json', 'utf8');
    graph.beginUpdate();
    JSON.parse(content)['nodes'].forEach(function (node) {
        graph.addNode(node.id, {
            label: node.label,
            color: Number(rgb2hex(node.color)),
            size: node.size,
            activated: false
        });
    });
    JSON.parse(content)['edges'].forEach(function (edge) {
        graph.addLink(edge.source, edge.target, {
            color: rgb2hex(edge.color),
            activated: false
        });
    });
    graph.endUpdate();
}